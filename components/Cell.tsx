
import React from 'react';
import { CellData, HintResponse } from '../types';
import { COLORS } from '../constants';

interface CellProps {
  cell: CellData;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  gameOver: boolean;
  dense?: boolean;
  performanceMode?: boolean;
  isHinted?: boolean;
  hintAction?: HintResponse['action'];
}

const Cell: React.FC<CellProps> = ({ cell, onClick, onContextMenu, gameOver, dense, performanceMode, isHinted, hintAction }) => {
  const hintClass = isHinted
    ? hintAction === 'flag'
      ? 'ai-hint-cell ai-hint-flag'
      : 'ai-hint-cell ai-hint-reveal'
    : '';

  const getCellContent = () => {
    if (cell.isFlagged) return '🚩';
    if (!cell.isRevealed) return '';
    if (cell.isMine) return '💣';
    return cell.neighborCount > 0 ? cell.neighborCount : '';
  };

  const getCellStyles = () => {
    const hintStyles = isHinted
      ? hintAction === 'flag'
        ? 'ring-4 ring-amber-300'
        : 'ring-4 ring-cyan-200'
      : '';

    if (!cell.isRevealed) {
      if (performanceMode) {
        return `bg-[linear-gradient(145deg,#253247,#111827)] border border-slate-950 shadow-[inset_1px_1px_0_rgba(255,255,255,0.07),inset_-2px_-2px_0_rgba(0,0,0,0.36)] hover:border-cyan-200/35 active:scale-95 ${hintStyles}`;
      }
      return `bg-[linear-gradient(145deg,#2b3a52,#111827)] border border-slate-950 shadow-[inset_2px_2px_0_rgba(255,255,255,0.08),inset_-3px_-3px_0_rgba(0,0,0,0.42),0_7px_12px_rgba(0,0,0,0.22)] hover:-translate-y-0.5 hover:border-cyan-200/40 hover:shadow-[inset_2px_2px_0_rgba(255,255,255,0.12),inset_-3px_-3px_0_rgba(0,0,0,0.35),0_0_18px_rgba(34,211,238,0.14)] active:translate-y-0 active:scale-95 ${hintStyles}`;
    }
    if (cell.isMine) {
      if (performanceMode) {
        return 'cell-pop bg-rose-950/80 border border-rose-300/25 shadow-[inset_0_0_10px_rgba(0,0,0,0.45)]';
      }
      return 'cell-pop bg-[radial-gradient(circle_at_50%_42%,rgba(251,113,133,0.45),rgba(127,29,29,0.88))] border border-rose-300/30 shadow-[inset_0_0_18px_rgba(0,0,0,0.45),0_0_22px_rgba(244,63,94,0.22)]';
    }
    if (performanceMode) {
      return 'cell-pop bg-slate-950/85 border border-slate-700/35 shadow-[inset_0_2px_7px_rgba(0,0,0,0.32)]';
    }
    return 'cell-pop bg-slate-950/80 border border-slate-700/40 shadow-[inset_0_3px_10px_rgba(0,0,0,0.35)]';
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`
        relative flex h-8 w-8 items-center justify-center overflow-visible rounded-[7px]
        font-black transition-all duration-150
        ${dense ? 'h-6 w-6 text-sm sm:h-7 sm:w-7 md:h-7 md:w-7' : 'text-lg sm:h-9 sm:w-9 md:h-10 md:w-10'}
        ${gameOver ? 'cursor-default' : 'cursor-pointer'}
        ${getCellStyles()}
        ${hintClass}
        ${cell.isRevealed && cell.neighborCount > 0 ? `${COLORS[cell.neighborCount as keyof typeof COLORS]} drop-shadow-[0_0_10px_currentColor]` : ''}
      `}
      aria-label={`cell-${cell.x}-${cell.y}`}
    >
      <span className="relative z-10 leading-none">{getCellContent()}</span>
      {isHinted && (
        <>
          <span className="ai-hint-target" />
          <span className="ai-hint-badge">
            {hintAction === 'flag' ? '标' : '点'}
          </span>
        </>
      )}
    </div>
  );
};

export default Cell;
