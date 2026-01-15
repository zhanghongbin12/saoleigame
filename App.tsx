
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus, Difficulty, CellData, HintResponse } from './types';
import { DIFFICULTY_CONFIG } from './constants';
import { createEmptyBoard, placeMines, revealCell, checkWin } from './services/gameLogic';
import { getGeminiHint } from './services/geminiService';
import Board from './components/Board';
import { Trophy, Clock, Flag, RefreshCw, Cpu, Settings, AlertCircle, ChevronDown } from 'lucide-react';

const App: React.FC = () => {
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.BEGINNER);
  const [board, setBoard] = useState<CellData[][]>(() => createEmptyBoard(DIFFICULTY_CONFIG[Difficulty.BEGINNER]));
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [timer, setTimer] = useState(0);
  const [flagCount, setFlagCount] = useState(0);
  const [hint, setHint] = useState<HintResponse | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
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
  };

  const requestHint = async () => {
    if (status !== GameStatus.PLAYING) return;
    setIsHintLoading(true);
    const result = await getGeminiHint(board);
    setHint(result);
    setIsHintLoading(false);
  };

  const settings = DIFFICULTY_CONFIG[difficulty];

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4">
      {/* Header */}
      <div className="max-w-4xl w-full flex flex-col items-center mb-10 gap-6">
        <h1 className="text-5xl font-extrabold tracking-tighter bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent text-center">
          GEMINI MINESWEEPER
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
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* Game Stats & Controls */}
      <div className="max-w-screen-xl w-full flex flex-col lg:flex-row items-start justify-center gap-8">
        
        {/* Sidebar Info */}
        <div className="w-full lg:w-64 flex flex-col gap-4">
          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Clock size={12} /> Time Elapsed
              </label>
              <div className="text-3xl font-mono text-blue-400 tabular-nums">
                {String(Math.floor(timer / 60)).padStart(2, '0')}:{String(timer % 60).padStart(2, '0')}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Flag size={12} /> Flags / Mines
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
              Restart
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
              <div className="font-bold">Ask Gemini AI</div>
              <div className="text-[10px] opacity-70 uppercase font-bold tracking-wider">Analyze Board</div>
            </div>
          </button>

          {hint && (
            <div className="bg-blue-950/40 border border-blue-500/20 p-4 rounded-2xl text-sm text-blue-200 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="font-bold flex items-center gap-2 mb-2">
                <AlertCircle size={16} /> 
                Gemini's Hint
              </div>
              <p className="opacity-80">Suggesting ({hint.x}, {hint.y}): {hint.reason}</p>
            </div>
          )}
        </div>

        {/* The Board */}
        <div className="flex-1 flex flex-col items-center overflow-auto max-w-full">
          {status === GameStatus.WON && (
            <div className="mb-4 p-4 bg-emerald-950/50 border border-emerald-500/50 rounded-2xl text-emerald-400 font-bold flex items-center gap-3 animate-bounce">
              <Trophy size={24} /> MISSION ACCOMPLISHED! YOU WON!
            </div>
          )}
          {status === GameStatus.LOST && (
            <div className="mb-4 p-4 bg-rose-950/50 border border-rose-500/50 rounded-2xl text-rose-400 font-bold flex items-center gap-3">
              <AlertCircle size={24} /> KABOOM! MISSION FAILED.
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
                <div className="text-2xl font-black text-slate-300 animate-pulse">CLICK ANYWHERE TO START</div>
                <div className="text-xs text-slate-500 mt-2 font-mono uppercase tracking-widest">Random Minefield generation enabled</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-auto pt-10 pb-6 text-slate-600 text-sm">
        Powered by Gemini 3 Flash & React 18
      </footer>
    </div>
  );
};

export default App;
