
import React from 'react';
import { CellData, HintResponse } from '../types';
import { COLORS } from '../constants';

interface CellProps {
  cell: CellData;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  gameOver: boolean;
  isHinted?: boolean;
  hintAction?: HintResponse['action'];
}

const Cell: React.FC<CellProps> = ({ cell, onClick, onContextMenu, gameOver, isHinted, hintAction }) => {
  const getCellContent = () => {
    if (cell.isFlagged) return '🚩';
    if (!cell.isRevealed) return '';
    if (cell.isMine) return '💣';
    return cell.neighborCount > 0 ? cell.neighborCount : '';
  };

  const getCellStyles = () => {
    const hintStyles = isHinted
      ? hintAction === 'flag'
        ? 'ring-2 ring-rose-400 animate-pulse'
        : 'ring-2 ring-blue-400 animate-pulse'
      : '';

    if (!cell.isRevealed) {
      return `bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border-t-2 border-l-2 border-slate-700 border-b-2 border-r-2 border-slate-900 ${hintStyles}`;
    }
    if (cell.isMine) {
      return 'bg-rose-900/40 border-slate-800 shadow-inner';
    }
    return 'bg-slate-900 border border-slate-800/50 shadow-inner';
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`
        w-8 h-8 md:w-10 md:h-10 flex items-center justify-center 
        cursor-pointer transition-all duration-100 font-bold text-lg
        ${getCellStyles()}
        ${cell.isRevealed && cell.neighborCount > 0 ? COLORS[cell.neighborCount as keyof typeof COLORS] : ''}
      `}
    >
      {getCellContent()}
    </div>
  );
};

export default Cell;
