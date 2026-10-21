import React from 'react';
import { Bomb, Flag } from 'lucide-react';
import { CellData, HintResponse } from '../types';

interface CellProps {
  cell: CellData;
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onFocus: () => void;
  tabIndex: number;
  gameOver: boolean;
  isHinted?: boolean;
  hintAction?: HintResponse['action'];
}

const Cell: React.FC<CellProps> = ({ cell, onClick, onContextMenu, onFocus, tabIndex, gameOver, isHinted, hintAction }) => {
  const stateLabel = cell.isRevealed ? cell.isMine ? '地雷' : cell.neighborCount ? `周围 ${cell.neighborCount} 个地雷` : '空白' : cell.isFlagged ? '已插旗' : '未翻开';
  return (
    <button type="button" onClick={onClick} onContextMenu={onContextMenu} onFocus={onFocus}
      tabIndex={tabIndex} aria-disabled={gameOver || cell.isRevealed}
      aria-label={`第 ${cell.y + 1} 行，第 ${cell.x + 1} 列，${stateLabel}`}
      data-x={cell.x} data-y={cell.y}
      className={`cell ${cell.isRevealed ? 'cell-revealed' : 'cell-hidden'} ${cell.isFlagged ? 'cell-flagged' : ''} ${cell.isRevealed && cell.isMine ? 'cell-mine' : ''} ${isHinted ? `cell-hinted hint-${hintAction}` : ''} ${gameOver ? 'cell-game-over' : ''}`}
      data-number={cell.isRevealed && !cell.isMine ? cell.neighborCount : undefined}>
      {cell.isFlagged ? <Flag className="cell-flag" size={19} fill="currentColor" strokeWidth={1.8} />
        : cell.isRevealed && cell.isMine ? <Bomb size={21} strokeWidth={2} />
          : cell.isRevealed && cell.neighborCount > 0 ? cell.neighborCount : null}
      {isHinted && <span className="cell-hint-dot" aria-hidden="true" />}
    </button>
  );
};

export default Cell;
