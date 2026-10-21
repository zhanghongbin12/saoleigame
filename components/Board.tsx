import React, { useRef, useState } from 'react';
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
  const [activeCell, setActiveCell] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  if (!board.length || !board[0]) return null;
  const cols = board[0].length;
  const rows = board.length;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    let next = activeCell;
    const x = activeCell % cols;
    const y = Math.floor(activeCell / cols);
    switch (event.key) {
      case 'ArrowRight': next = y * cols + Math.min(cols - 1, x + 1); break;
      case 'ArrowLeft': next = y * cols + Math.max(0, x - 1); break;
      case 'ArrowDown': next = Math.min(rows - 1, y + 1) * cols + x; break;
      case 'ArrowUp': next = Math.max(0, y - 1) * cols + x; break;
      case 'Home': next = y * cols; break;
      case 'End': next = y * cols + cols - 1; break;
      case 'f': case 'F': event.preventDefault(); onCellContextMenu(x, y); return;
      default: return;
    }
    event.preventDefault();
    setActiveCell(next);
    boardRef.current?.querySelectorAll<HTMLButtonElement>('.cell')[next]?.focus();
  };

  return (
    <div ref={boardRef} className={`mine-board ${cols > 9 ? 'mine-board-large' : ''}`}
      style={{ gridTemplateColumns: `repeat(${cols}, var(--cell-size))` }}
      onKeyDown={handleKeyDown} role="group" aria-label={`${rows} 行 ${cols} 列雷区`}>
      {board.flatMap((row, y) => row.map((cell, x) => (
        <Cell key={`${x}-${y}`} cell={cell} onClick={() => onCellClick(x, y)}
          onContextMenu={event => { event.preventDefault(); onCellContextMenu(x, y); }}
          tabIndex={activeCell === y * cols + x ? 0 : -1}
          onFocus={() => setActiveCell(y * cols + x)} gameOver={gameOver}
          isHinted={hint?.x === x && hint?.y === y} hintAction={hint?.action} />
      )))}
    </div>
  );
};

export default Board;
