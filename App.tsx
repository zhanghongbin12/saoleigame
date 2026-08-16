import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus, Difficulty, CellData, HintResponse } from './types';
import { DIFFICULTY_CONFIG } from './constants';
import { createEmptyBoard, placeMines, revealCell, checkWin } from './services/gameLogic';
import { getSmartHint } from './services/hintService';
import Board from './components/Board';
import {
  AlertCircle,
  Clock,
  Cpu,
  Flag,
  KeyRound,
  RefreshCw,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react';

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
  const [showSettings, setShowSettings] = useState(false);
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
    initGame();
  }, [difficulty, initGame]);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      timerRef.current = window.setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
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

    if (status === GameStatus.IDLE) {
      currentBoard = placeMines(currentBoard, settings, x, y);
      setStatus(GameStatus.PLAYING);
    }

    if (currentBoard[y][x].isMine) {
      const revealedBoard = currentBoard.map(row =>
        row.map(cell => cell.isMine ? { ...cell, isRevealed: true } : cell)
      );
      setBoard(revealedBoard);
      setStatus(GameStatus.LOST);
      return;
    }

    const nextBoard = revealCell(currentBoard, x, y);
    setBoard(nextBoard);

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
    setShowSettings(false);
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
  const remainingMines = settings.mines - flagCount;
  const isExpert = difficulty === Difficulty.EXPERT;
  const statusLabel = status === GameStatus.PLAYING
    ? '扫描中'
    : status === GameStatus.WON
      ? '已通关'
      : status === GameStatus.LOST
        ? '警报'
        : '待启动';

  return (
    <div className="min-h-screen relative overflow-hidden px-4 py-6 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(45,212,191,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,191,0.05)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.12),rgba(3,7,18,0.95))]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-48px)] max-w-[1500px] flex-col">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.16)]">
              <Zap size={28} />
            </div>
            <div>
              <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.32em] text-cyan-200/80">
                AI Mine Lab
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.9)]" />
              </div>
              <h1 className="text-3xl font-black text-white sm:text-5xl">
                探雷特工
              </h1>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex rounded-2xl border border-white/10 bg-black/30 p-1.5 shadow-2xl shadow-black/30 backdrop-blur">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  className={`min-w-20 rounded-xl px-4 py-2 text-sm font-black transition-all duration-200 sm:min-w-24 ${
                    difficulty === diff
                      ? 'bg-amber-300 text-slate-950 shadow-[0_0_22px_rgba(252,211,77,0.3)]'
                      : 'text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {DIFFICULTY_LABELS[diff]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSettings(prev => !prev)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-300/20"
            >
              {showSettings ? <X size={18} /> : <Settings size={18} />}
              AI 设置
            </button>
          </div>
        </header>

        <main className="grid flex-1 gap-6 md:grid-cols-[320px_minmax(0,1fr)] md:items-start">
          <aside className="flex w-full flex-col gap-4">
            <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200/70">Mission HUD</div>
                  <div className="mt-1 text-2xl font-black text-white">{statusLabel}</div>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-black ${
                  status === GameStatus.LOST
                    ? 'bg-rose-400/15 text-rose-200'
                    : status === GameStatus.WON
                      ? 'bg-emerald-400/15 text-emerald-200'
                      : 'bg-cyan-400/15 text-cyan-200'
                }`}>
                  {settings.cols} x {settings.rows}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-cyan-200/10 bg-cyan-200/5 p-4">
                  <label className="mb-2 flex items-center gap-2 text-xs font-black text-cyan-100/70">
                    <Clock size={14} /> 用时
                  </label>
                  <div className="font-mono text-4xl font-black tabular-nums text-cyan-200">
                    {String(Math.floor(timer / 60)).padStart(2, '0')}:{String(timer % 60).padStart(2, '0')}
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-200/10 bg-rose-200/5 p-4">
                  <label className="mb-2 flex items-center gap-2 text-xs font-black text-rose-100/70">
                    <Flag size={14} /> 剩余雷
                  </label>
                  <div className="font-mono text-4xl font-black tabular-nums text-rose-200">
                    {remainingMines}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm font-bold text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs text-slate-500">已标记</div>
                  <div className="mt-1 text-2xl text-amber-200">{flagCount}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs text-slate-500">总地雷</div>
                  <div className="mt-1 text-2xl text-white">{settings.mines}</div>
                </div>
              </div>

              <button
                onClick={initGame}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200/30 bg-amber-300 px-4 py-3 font-black text-slate-950 shadow-[0_0_28px_rgba(252,211,77,0.18)] transition hover:-translate-y-0.5 hover:bg-amber-200 active:translate-y-0"
              >
                <RefreshCw size={20} />
                重新开始
              </button>
            </section>

            <button
              onClick={requestHint}
              disabled={status !== GameStatus.PLAYING || isHintLoading}
              className={`
                group relative overflow-hidden rounded-3xl border p-5 text-left transition-all duration-300
                ${status === GameStatus.PLAYING && !isHintLoading
                  ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-50 shadow-[0_0_34px_rgba(16,185,129,0.12)] hover:-translate-y-0.5 hover:border-emerald-200/60'
                  : 'cursor-not-allowed border-white/10 bg-slate-950/50 text-slate-500'}
              `}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/60 to-transparent" />
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-200/20 bg-emerald-200/10">
                  {isHintLoading ? <ScanLine size={28} className="animate-pulse" /> : <Cpu size={28} />}
                </div>
                <div>
                  <div className="text-xl font-black">下一步建议</div>
                  <div className="text-xs font-bold opacity-70">{isHintLoading ? '正在分析下一步' : '先本地分析，再用 AI'}</div>
                </div>
              </div>
            </button>

            {hint && (
              <div className="rounded-3xl border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.1)]">
                <div className="mb-2 flex items-center gap-2 font-black">
                  <Sparkles size={16} />
                  排雷建议
                </div>
                <p className="leading-6 opacity-85">
                  {hint.action === 'flag' ? '标记' : '点击'}（{hint.x}，{hint.y}）：{hint.reason}
                </p>
              </div>
            )}

            {hintError && (
              <div className="rounded-3xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm font-bold text-rose-100">
                {hintError}
              </div>
            )}

            {showSettings && (
              <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-black text-slate-200">
                    <KeyRound size={16} /> OpenRouter
                  </label>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${hasApiKey ? 'bg-emerald-400/15 text-emerald-200' : 'bg-slate-700/70 text-slate-300'}`}>
                    {hasApiKey ? '已连接' : '未配置'}
                  </span>
                </div>
                <div className="space-y-3">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(event) => setApiKeyInput(event.target.value)}
                    placeholder="sk-or-..."
                    className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:bg-black/50"
                  />
                  <input
                    type="text"
                    value={modelInput}
                    onChange={(event) => setModelInput(event.target.value)}
                    placeholder="openai/gpt-4o-mini"
                    className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:bg-black/50"
                  />
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <input
                      type="checkbox"
                      checked={rememberApiKey}
                      onChange={(event) => setRememberApiKey(event.target.checked)}
                      className="h-4 w-4 accent-cyan-300"
                    />
                    在此浏览器记住
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={saveApiKey}
                      className="rounded-2xl bg-cyan-300 px-3 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                    >
                      保存
                    </button>
                    <button
                      onClick={clearApiKey}
                      className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.1]"
                    >
                      清除
                    </button>
                  </div>
                  <p className="truncate text-xs font-bold text-slate-500">
                    {hasApiKey ? model : '未配置时仍会优先尝试本地推理。'}
                  </p>
                </div>
              </section>
            )}
          </aside>

          <section className="flex min-w-0 flex-col items-center">
            {status === GameStatus.WON && (
              <div className="mb-4 flex w-fit max-w-full items-center gap-3 rounded-3xl border border-emerald-300/40 bg-emerald-300/10 p-4 font-black text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.16)]">
                <Trophy size={24} /> 任务完成，成功排雷！
              </div>
            )}
            {status === GameStatus.LOST && (
              <div className="mb-4 flex w-fit max-w-full items-center gap-3 rounded-3xl border border-rose-300/40 bg-rose-300/10 p-4 font-black text-rose-100 shadow-[0_0_30px_rgba(244,63,94,0.16)]">
                <AlertCircle size={24} /> 踩到地雷，任务失败。
              </div>
            )}

            <div className={`relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 p-4 shadow-2xl shadow-black/40 ${isExpert ? '' : 'backdrop-blur-xl'} sm:p-6 ${status === GameStatus.LOST ? 'alarm-shake' : ''}`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm font-black text-slate-300">
                  <ShieldCheck className="text-emerald-200" size={20} />
                  雷区控制台
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-300 shadow-[0_0_14px_rgba(253,164,175,0.9)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.9)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
                </div>
              </div>

              <div className="relative mx-auto flex w-full justify-center">
                <Board
                  board={board}
                  onCellClick={handleCellClick}
                  onCellContextMenu={handleContextMenu}
                  gameOver={status === GameStatus.LOST || status === GameStatus.WON}
                  hint={hint}
                />

                {status === GameStatus.IDLE && (
                  <div className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-slate-950/65 transition-opacity ${isExpert ? '' : 'backdrop-blur-sm'}`}>
                    <div className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-5 py-2 text-xl font-black text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
                      点击开局
                    </div>
                    <div className="mt-3 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Minefield Ready</div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-auto pt-8 pb-2 text-center text-xs font-bold uppercase tracking-[0.24em] text-slate-600">
          OpenRouter / React / Minesweeper
        </footer>
      </div>
    </div>
  );
};

export default App;
