
import React from 'react';
import { CellData, HintResponse } from '../types';
import Cell from './Cell';

interface BoardProps {
  board: CellData[][];
  onCellClick: (x: number, y: number) => void;
  onCellContextMenu: (x: number, y: number) => void;
  gameOver: boolean;
  hint: HintResponse | null;
}

const Board: React.FC<BoardProps> = ({ board, onCellClick, onCellContextMenu, gameOver, hint }) => {
  if (!board || board.length === 0 || !board[0]) {
    return null;
  }

  const performanceMode = board[0].length >= 16;
  const dense = board[0].length >= 30;

  return (
    <div className={`relative inline-block max-w-full rounded-2xl border border-cyan-200/15 bg-slate-950/85 shadow-[inset_0_0_30px_rgba(15,23,42,0.95),0_0_36px_rgba(34,211,238,0.09)] ${performanceMode ? 'board-performance' : ''} ${dense ? 'board-dense p-2' : 'p-3'}`}>
      <div className="board-scan pointer-events-none absolute inset-0 rounded-2xl" />
      <div 
        className={`relative inline-grid ${dense ? 'gap-0.5' : 'gap-1'}`}
        style={{ gridTemplateColumns: `repeat(${board[0].length}, minmax(0, 1fr))` }}
      >
        {board.map((row, y) => 
          row.map((cell, x) => (
            <Cell 
              key={`${x}-${y}`} 
              cell={cell} 
              onClick={() => onCellClick(x, y)}
              onContextMenu={(e) => {
                e.preventDefault();
                onCellContextMenu(x, y);
              }}
              gameOver={gameOver}
              dense={dense}
              performanceMode={performanceMode}
              isHinted={hint?.x === x && hint?.y === y}
              hintAction={hint?.action}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Board;
