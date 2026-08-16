
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

  return (
    <div 
      className="inline-grid gap-px p-4 bg-slate-950/80 backdrop-blur-md rounded-xl shadow-2xl border border-slate-800"
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
            isHinted={hint?.x === x && hint?.y === y}
            hintAction={hint?.action}
          />
        ))
      )}
    </div>
  );
};

export default Board;
