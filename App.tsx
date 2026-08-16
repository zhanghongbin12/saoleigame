
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus, Difficulty, CellData, HintResponse } from './types';
import { DIFFICULTY_CONFIG } from './constants';
import { createEmptyBoard, placeMines, revealCell, checkWin } from './services/gameLogic';
import { getSmartHint } from './services/hintService';
import Board from './components/Board';
import { Trophy, Clock, Flag, RefreshCw, Cpu, AlertCircle, KeyRound } from 'lucide-react';

const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const LOCAL_KEY_STORAGE = 'openrouter_api_key';
const SESSION_KEY_STORAGE = 'openrouter_api_key_session';
const LOCAL_MODEL_STORAGE = 'openrouter_model';
const SESSION_MODEL_STORAGE = 'openrouter_model_session';
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  [Difficulty.BEGINNER]: '初级',
  [Difficulty.INTERMEDIATE]: '中级',
  [Difficulty.EXPERT]: '高级',
};

const App: React.FC = () => {
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.BEGINNER);
  const [board, setBoard] = useState<CellData[][]>(() => createEmptyBoard(DIFFICULTY_CONFIG[Difficulty.BEGINNER]));
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [timer, setTimer] = useState(0);
  const [flagCount, setFlagCount] = useState(0);
  const [hint, setHint] = useState<HintResponse | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [model, setModel] = useState(DEFAULT_OPENROUTER_MODEL);
  const [modelInput, setModelInput] = useState(DEFAULT_OPENROUTER_MODEL);
  const [rememberApiKey, setRememberApiKey] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const initGame = useCallback(() => {
    const settings = DIFFICULTY_CONFIG[difficulty];
    setBoard(createEmptyBoard(settings));
    setStatus(GameStatus.IDLE);
    setTimer(0);
    setFlagCount(0);
    setHint(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [difficulty]);

  useEffect(() => {
    // Only re-init if the board size needs to change due to difficulty
    // or when explicitly requested.
    initGame();
  }, [difficulty]);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      timerRef.current = window.setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  useEffect(() => {
    const localApiKey = localStorage.getItem(LOCAL_KEY_STORAGE);
    const sessionApiKey = sessionStorage.getItem(SESSION_KEY_STORAGE);
    const localModel = localStorage.getItem(LOCAL_MODEL_STORAGE);
    const sessionModel = sessionStorage.getItem(SESSION_MODEL_STORAGE);
    const storedApiKey = localApiKey || sessionApiKey || '';
    const storedModel = localModel || sessionModel || DEFAULT_OPENROUTER_MODEL;
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setApiKeyInput(storedApiKey);
      setRememberApiKey(Boolean(localApiKey));
    }
    setModel(storedModel);
    setModelInput(storedModel);
  }, []);

  const handleCellClick = (x: number, y: number) => {
    if (status === GameStatus.WON || status === GameStatus.LOST || board[y][x].isFlagged) return;

    let currentBoard = [...board];
    const settings = DIFFICULTY_CONFIG[difficulty];

    // First move: place mines and ensure safety
    if (status === GameStatus.IDLE) {
      currentBoard = placeMines(currentBoard, settings, x, y);
      setStatus(GameStatus.PLAYING);
    }

    if (currentBoard[y][x].isMine) {
      // Reveal all mines
      const revealedBoard = currentBoard.map(row => 
        row.map(cell => cell.isMine ? { ...cell, isRevealed: true } : cell)
      );
      setBoard(revealedBoard);
      setStatus(GameStatus.LOST);
      return;
    }

    const nextBoard = revealCell(currentBoard, x, y);
    setBoard(nextBoard);
    
    // Clear hint if revealed
    if (hint && hint.x === x && hint.y === y) {
      setHint(null);
    }

    if (checkWin(nextBoard, settings)) {
      setStatus(GameStatus.WON);
    }
  };

  const handleContextMenu = (x: number, y: number) => {
    if (status === GameStatus.WON || status === GameStatus.LOST || board[y][x].isRevealed) return;

    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    const isNowFlagged = !newBoard[y][x].isFlagged;
    newBoard[y][x].isFlagged = isNowFlagged;
    
    setBoard(newBoard);
    setFlagCount(prev => isNowFlagged ? prev + 1 : prev - 1);

    if (hint && hint.x === x && hint.y === y) {
      setHint(null);
    }
  };

  const saveApiKey = () => {
    const trimmedKey = apiKeyInput.trim();
    const trimmedModel = modelInput.trim();
    if (!trimmedKey) {
      setHintError('请输入有效的 OpenRouter API 密钥。');
      return;
    }
    if (!trimmedModel) {
      setHintError('请输入有效的 OpenRouter 模型 ID。');
      return;
    }

    setApiKey(trimmedKey);
    setModel(trimmedModel);
    if (rememberApiKey) {
      localStorage.setItem(LOCAL_KEY_STORAGE, trimmedKey);
      localStorage.setItem(LOCAL_MODEL_STORAGE, trimmedModel);
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
      sessionStorage.removeItem(SESSION_MODEL_STORAGE);
    } else {
      sessionStorage.setItem(SESSION_KEY_STORAGE, trimmedKey);
      sessionStorage.setItem(SESSION_MODEL_STORAGE, trimmedModel);
      localStorage.removeItem(LOCAL_KEY_STORAGE);
      localStorage.removeItem(LOCAL_MODEL_STORAGE);
    }
    setHintError(null);
  };

  const clearApiKey = () => {
    setApiKey('');
    setApiKeyInput('');
    setModel(DEFAULT_OPENROUTER_MODEL);
    setModelInput(DEFAULT_OPENROUTER_MODEL);
    localStorage.removeItem(LOCAL_KEY_STORAGE);
    localStorage.removeItem(LOCAL_MODEL_STORAGE);
    sessionStorage.removeItem(SESSION_KEY_STORAGE);
    sessionStorage.removeItem(SESSION_MODEL_STORAGE);
    setHintError('OpenRouter 设置已清除。');
  };

  const requestHint = async () => {
    if (status !== GameStatus.PLAYING) return;
    setIsHintLoading(true);
    setHintError(null);
    try {
      const result = await getSmartHint(board, apiKey, model);
      if (!result) {
        setHintError('没有找到有效提示，请多翻开一些格子或尝试其他模型。');
        return;
      }
      setHint(result);
    } catch (error) {
      console.error('OpenRouter Hint Error:', error);
      const message = error instanceof Error ? error.message : '未知错误';
      setHintError(`OpenRouter 请求失败：${message}`);
    } finally {
      setIsHintLoading(false);
    }
  };

  const settings = DIFFICULTY_CONFIG[difficulty];
  const hasApiKey = apiKey.length > 0;

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4">
      {/* Header */}
      <div className="max-w-4xl w-full flex flex-col items-center mb-10 gap-6">
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent text-center">
          AI 扫雷
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
          {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((diff) => (
            <button
              key={diff}
              onClick={() => setDifficulty(diff)}
              className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                difficulty === diff 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              {DIFFICULTY_LABELS[diff]}
            </button>
          ))}
        </div>
      </div>

      {/* Game Stats & Controls */}
      <div className="max-w-screen-xl w-full flex flex-col lg:flex-row items-start justify-center gap-8">
        
        {/* Sidebar Info */}
        <div className="w-full lg:w-64 flex flex-col gap-4">
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-xl space-y-3">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-2">
              <KeyRound size={12} /> OpenRouter API 密钥（自备）
            </label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
              placeholder="sk-or-..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-sm outline-none focus:border-blue-500"
            />
            <input
              type="text"
              value={modelInput}
              onChange={(event) => setModelInput(event.target.value)}
              placeholder="openai/gpt-4o-mini"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-sm outline-none focus:border-blue-500"
            />
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={rememberApiKey}
                onChange={(event) => setRememberApiKey(event.target.checked)}
              />
              在此浏览器记住
            </label>
            <div className="flex gap-2">
              <button
                onClick={saveApiKey}
                className="flex-1 px-3 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                保存密钥
              </button>
              <button
                onClick={clearApiKey}
                className="flex-1 px-3 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                清除
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              {hasApiKey ? `已就绪：${model}` : '需要密钥才能启用 AI 提示。'}
            </p>
          </div>

          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <Clock size={12} /> 用时
              </label>
              <div className="text-3xl font-mono text-blue-400 tabular-nums">
                {String(Math.floor(timer / 60)).padStart(2, '0')}:{String(timer % 60).padStart(2, '0')}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <Flag size={12} /> 标记 / 地雷
              </label>
              <div className="text-3xl font-mono text-rose-400 tabular-nums">
                {flagCount} <span className="text-slate-700">/</span> {settings.mines}
              </div>
            </div>

            <button
              onClick={initGame}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-slate-700"
            >
              <RefreshCw size={18} className={status === GameStatus.IDLE ? '' : 'animate-spin-once'} />
              重新开始
            </button>
          </div>

            <button
              onClick={requestHint}
              disabled={status !== GameStatus.PLAYING || isHintLoading}
              className={`
                w-full flex flex-col items-center gap-2 p-6 rounded-2xl border transition-all duration-300
              ${status === GameStatus.PLAYING && !isHintLoading
                ? 'bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border-blue-500/30 hover:border-blue-400 text-blue-100 shadow-lg shadow-blue-900/20' 
                : 'bg-slate-900/30 border-slate-800 text-slate-600 cursor-not-allowed'}
            `}
          >
            <Cpu size={32} className={`${isHintLoading ? 'animate-pulse text-blue-400' : ''}`} />
            <div className="text-center">
              <div className="font-bold">智能提示</div>
              <div className="text-[10px] opacity-70 font-bold">{isHintLoading ? '正在分析' : '本地优先，AI 兜底'}</div>
            </div>
          </button>

          {hint && (
            <div className="bg-blue-950/40 border border-blue-500/20 p-4 rounded-2xl text-sm text-blue-200 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="font-bold flex items-center gap-2 mb-2">
                <AlertCircle size={16} /> 
                AI 提示
              </div>
              <p className="opacity-80">
                {hint.action === 'flag' ? '建议标记' : '建议点击'}（{hint.x}，{hint.y}）：{hint.reason}
              </p>
            </div>
          )}

          {hintError && (
            <div className="bg-rose-950/40 border border-rose-500/20 p-4 rounded-2xl text-sm text-rose-200">
              {hintError}
            </div>
          )}
        </div>

        {/* The Board */}
        <div className="flex-1 flex flex-col items-center overflow-x-auto overflow-y-visible max-w-full pt-2">
          {status === GameStatus.WON && (
            <div className="relative z-10 mb-4 w-fit max-w-full p-4 bg-emerald-950/50 border border-emerald-500/50 rounded-2xl text-emerald-400 font-bold flex items-center gap-3">
              <Trophy size={24} /> 任务完成，成功排雷！
            </div>
          )}
          {status === GameStatus.LOST && (
            <div className="mb-4 p-4 bg-rose-950/50 border border-rose-500/50 rounded-2xl text-rose-400 font-bold flex items-center gap-3">
              <AlertCircle size={24} /> 踩到地雷，任务失败。
            </div>
          )}
          
          <div className="relative group">
            <Board 
              board={board} 
              onCellClick={handleCellClick}
              onCellContextMenu={handleContextMenu}
              gameOver={status === GameStatus.LOST || status === GameStatus.WON}
              hint={hint}
            />
            
            {status === GameStatus.IDLE && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm rounded-xl pointer-events-none transition-opacity group-hover:opacity-0">
                <div className="text-2xl font-black text-slate-300 animate-pulse">点击任意位置开始</div>
                <div className="text-xs text-slate-500 mt-2 font-mono">已启用随机雷区生成</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-auto pt-10 pb-6 text-slate-600 text-sm">
        由 OpenRouter 与 React 18 驱动
      </footer>
    </div>
  );
};

export default App;
