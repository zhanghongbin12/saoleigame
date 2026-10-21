import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus, Difficulty, CellData, HintResponse } from './types';
import { DIFFICULTY_CONFIG } from './constants';
import { createEmptyBoard, placeMines, revealCell, checkWin } from './services/gameLogic';
import { getSmartHint } from './services/hintService';
import Board from './components/Board';
import {
  AlertCircle, ArrowUpRight, Bomb, Check, ChevronRight, Clock3, Flag,
  Grid2X2, Lightbulb, LoaderCircle, MousePointer2, RefreshCw,
  Settings2, ShieldCheck, Sparkles, Trophy, X,
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
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const settingsRef = useRef<HTMLDialogElement>(null);
  // Discard hint responses when the board changes before analysis finishes.
  const hintRequestRef = useRef(0);
  const [inputMode, setInputMode] = useState<'reveal' | 'flag'>('reveal');

  useEffect(() => {
    const dialog = settingsRef.current;
    if (showSettings) {
      setSettingsError(null);
      setSettingsNotice(null);
      dialog?.showModal();
    } else dialog?.close();
  }, [showSettings]);

  const initGame = useCallback(() => {
    const settings = DIFFICULTY_CONFIG[difficulty];
    setBoard(createEmptyBoard(settings));
    setStatus(GameStatus.IDLE);
    setTimer(0);
    setFlagCount(0);
    setHint(null);
    setHintError(null);
    setIsHintLoading(false);
    hintRequestRef.current += 1;
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

    if (board[y][x].isRevealed) return;
    hintRequestRef.current += 1;
    setIsHintLoading(false);
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

    hintRequestRef.current += 1;
    setIsHintLoading(false);
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
      setSettingsError('请输入有效的 OpenRouter API 密钥。');
      return;
    }
    if (!trimmedModel) {
      setSettingsError('请输入有效的 OpenRouter 模型 ID。');
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
    setSettingsError(null);
    setHintError(null);
    setSettingsNotice('OpenRouter 设置已清除，仍可使用本地推理。');
  };

  const requestHint = async () => {
    if (status !== GameStatus.PLAYING) return;
    const requestId = ++hintRequestRef.current;
    setIsHintLoading(true);
    setHintError(null);
    try {
      const result = await getSmartHint(board, apiKey, model);
      if (requestId !== hintRequestRef.current) return;
      if (!result) {
        setHintError('没有找到有效提示，请多翻开一些格子或尝试其他模型。');
        return;
      }
      setHint(result);
    } catch (error) {
      if (requestId !== hintRequestRef.current) return;
      const message = error instanceof Error ? error.message : '未知错误';
      setHintError(`OpenRouter 请求失败：${message}`);
    } finally {
      if (requestId === hintRequestRef.current) setIsHintLoading(false);
    }
  };

  const settings = DIFFICULTY_CONFIG[difficulty];
  const hasApiKey = apiKey.length > 0;
  const remainingMines = settings.mines - flagCount;
  const revealedCount = board.flat().filter(cell => cell.isRevealed && !cell.isMine).length;
  const safeCells = settings.rows * settings.cols - settings.mines;
  const progress = Math.round(revealedCount / safeCells * 100);
  const gameOver = status === GameStatus.WON || status === GameStatus.LOST;
  const statusLabel = status === GameStatus.WON ? '所有安全格已找到，漂亮！'
    : status === GameStatus.LOST ? '碰到地雷了，再来一次吧。'
      : status === GameStatus.PLAYING ? '慢慢来，每一步都算数。' : '点击任意格子，开始探索';

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="./" aria-label="扫雷首页">
          <span className="brand-mark" aria-hidden="true"><Grid2X2 size={27} /><span /></span>
          <span>扫雷<span className="brand-caption">给大脑一点游乐时间</span></span>
        </a>
        <button className="settings-button" onClick={() => setShowSettings(true)}>
          <Settings2 size={17} /><span>AI 设置</span>
        </button>
      </header>

      <main>
        <section className="page-intro">
          <div><h1>小小雷区，大大挑战<span>。</span></h1><p>观察、推理，再勇敢点开下一格。</p></div>
          <div className="safe-note"><ShieldCheck size={17} />第一步，总是安全的</div>
        </section>

        <div className={`game-layout ${difficulty === Difficulty.EXPERT ? 'game-layout-expert' : ''}`}>
          <section className="game-panel" aria-label="扫雷游戏">
            <div className="game-heading">
              <h2><Grid2X2 size={18} />经典扫雷</h2>
              <span className={`game-state state-${status.toLowerCase()}`}><i />{status === GameStatus.IDLE ? '准备就绪' : status === GameStatus.PLAYING ? '进行中' : status === GameStatus.WON ? '已通关' : '本局结束'}</span>
            </div>

            <div className="difficulty-tabs" role="group" aria-label="游戏难度">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(diff => (
                <button key={diff} aria-pressed={difficulty === diff} onClick={() => setDifficulty(diff)}>
                  <span className="difficulty-name">{DIFFICULTY_LABELS[diff]}</span>
                  <span className="difficulty-detail">{DIFFICULTY_CONFIG[diff].cols} × {DIFFICULTY_CONFIG[diff].rows}<span> / {DIFFICULTY_CONFIG[diff].mines} 雷</span></span>
                </button>
              ))}
            </div>

            <div className="game-stats">
              <div className="stat"><span><Flag size={15} />剩余地雷</span><strong>{String(remainingMines).padStart(2, '0')}<small> / {settings.mines}</small></strong></div>
              <div className="stat"><span><Clock3 size={15} />本局用时</span><strong>{String(Math.floor(timer / 60)).padStart(2, '0')}<b>:</b>{String(timer % 60).padStart(2, '0')}</strong></div>
              <button className="restart-button" onClick={initGame} title="重新开始"><RefreshCw size={17} /><span>重新开始</span></button>
            </div>

            <div className={`board-stage ${difficulty !== Difficulty.BEGINNER ? 'board-stage-large' : ''}`}>
              <div className="board-scroll" tabIndex={difficulty !== Difficulty.BEGINNER ? 0 : undefined} aria-label="雷区，使用方向键移动焦点，回车翻开，F 键插旗">
                <Board key={difficulty} board={board}
                  onCellClick={inputMode === 'flag' ? handleContextMenu : handleCellClick}
                  onCellContextMenu={handleContextMenu} gameOver={gameOver} hint={hint} />
              </div>
              <div className={`board-message ${status === GameStatus.LOST ? 'message-lost' : ''} ${status === GameStatus.WON ? 'message-won' : ''}`} role="status">
                {status === GameStatus.WON ? <Trophy size={17} /> : status === GameStatus.LOST ? <Bomb size={17} /> : <MousePointer2 size={16} />}
                {statusLabel}
              </div>
              {difficulty !== Difficulty.BEGINNER && <p className="scroll-note">雷区较大，小屏幕可左右滑动查看</p>}
            </div>

            <div className="board-toolbar">
              <div className="input-toggle" role="group" aria-label="点击操作">
                <button aria-pressed={inputMode === 'reveal'} onClick={() => setInputMode('reveal')}><MousePointer2 size={15} />翻开</button>
                <button aria-pressed={inputMode === 'flag'} onClick={() => setInputMode('flag')}><Flag size={15} />插旗</button>
              </div>
              <span className="desktop-tip">左键翻开 · 右键插旗</span>
              <span className="mobile-tip">选择模式后点击格子</span>
            </div>
          </section>

          <aside className="sidebar">
            <section className="assistant-panel">
              <div className="assistant-heading"><span className="assistant-icon"><Sparkles size={22} /></span><div><h2>你的推理搭档</h2><p>卡住了？换个思路试试。</p></div></div>
              <div className="assistant-content" aria-live="polite">
                {hint ? <><span className="hint-action">{hint.action === 'flag' ? <Flag size={16} /> : <MousePointer2 size={16} />}{hint.action === 'flag' ? '建议插旗' : '建议翻开'} · 第 {hint.y + 1} 行，第 {hint.x + 1} 列</span><p>{hint.reason}</p><span className="hint-legend"><i />对应格子已在棋盘中标出</span></>
                  : <><div className="hint-illustration" aria-hidden="true"><span>1</span><span><Flag size={20} /></span><span>1</span><span /><span><Sparkles size={22} /></span><span /></div><h3>{status === GameStatus.IDLE ? '先迈出你的第一步' : gameOver ? '下一局，继续探索' : '每一个数字都是线索'}</h3><p>{status === GameStatus.IDLE ? '翻开几个格子后，我会帮你一起分析棋盘。' : gameOver ? '重新开始一局，试试不一样的解法。' : '需要一点帮助时，看看下一步有哪些可能。'}</p></>}
              </div>
              <button className="hint-button" onClick={requestHint} disabled={status !== GameStatus.PLAYING || isHintLoading}>
                {isHintLoading ? <LoaderCircle size={17} className="loading-spinner" /> : <Lightbulb size={17} />}{isHintLoading ? '正在分析棋盘…' : '给我一点提示'}{!isHintLoading && <ArrowUpRight size={16} />}
              </button>
              {hintError && <p className="inline-error" role="alert"><AlertCircle size={16} />{hintError}</p>}
              <p className="assistant-footnote">先用本地规则推理，必要时交给 AI</p>
            </section>

            <section className="rules-panel"><h2>扫雷，其实很简单</h2><ul>
              <li><span className="rule-symbol number-symbol">1</span><div><h3>数字是线索</h3><p>代表周围八个格子中的地雷数量。</p></div></li>
              <li><span className="rule-symbol flag-symbol"><Flag size={18} /></span><div><h3>可疑的地方，插面旗</h3><p>右键标记地雷，手机可切换插旗模式。</p></div></li>
              <li><span className="rule-symbol win-symbol"><Check size={20} /></span><div><h3>找到所有安全格</h3><p>避开地雷，翻开其余格子就能获胜。</p></div></li>
            </ul></section>

            <section className="progress-panel"><div><span>本局探索进度</span><strong>{progress}<small>%</small></strong></div><div className="progress-track" role="progressbar" aria-label="本局探索进度" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div><p>已翻开 {revealedCount} / {safeCells} 个安全格</p></section>
          </aside>
        </div>
      </main>
      <footer className="site-footer"><span><Grid2X2 size={13} />扫雷</span><span>不急，想清楚再点。</span><span className="keyboard-tip">方向键移动 · Enter 翻开 · F 插旗</span></footer>

      <dialog ref={settingsRef} className="settings-dialog" aria-labelledby="settings-title" onClose={() => setShowSettings(false)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setShowSettings(false); } }}>
        <div className="dialog-heading"><div><span className="dialog-icon"><Settings2 size={20} /></span><h2 id="settings-title">AI 助手设置</h2></div><button className="icon-button" aria-label="关闭设置" onClick={() => setShowSettings(false)}><X size={20} /></button></div>
        <p className="dialog-description">本地推理无需配置。连接 OpenRouter 后，可在没有确定解时让模型协助分析。</p>
        <form onSubmit={event => { event.preventDefault(); saveApiKey(); }}>
          <label className="field-label" htmlFor="api-key">OpenRouter API 密钥<span>{hasApiKey ? '已配置' : '未配置'}</span></label>
          <input id="api-key" type="password" autoComplete="off" value={apiKeyInput} onChange={event => setApiKeyInput(event.target.value)} placeholder="sk-or-…" />
          <label className="field-label" htmlFor="model-id">模型 ID</label>
          <input id="model-id" value={modelInput} onChange={event => setModelInput(event.target.value)} placeholder="openai/gpt-4o-mini" />
          <label className="remember-label"><input type="checkbox" checked={rememberApiKey} onChange={event => setRememberApiKey(event.target.checked)} />在此浏览器记住设置</label>
          <p className="storage-note">密钥仅保存在当前设备；未勾选时，关闭浏览器会话后清除。</p>
          {settingsError && <p className="inline-error" role="alert">{settingsError}</p>}
          {settingsNotice && <p className="settings-notice" role="status">{settingsNotice}</p>}
          <div className="dialog-actions"><button type="button" className="secondary-button" onClick={clearApiKey}>清除配置</button><button type="submit" className="primary-button">保存设置<ChevronRight size={16} /></button></div>
        </form>
      </dialog>
    </div>
  );
};

export default App;
