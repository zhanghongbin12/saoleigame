import { CellData, HintResponse } from '../types';
import { getOpenRouterHint } from './openRouterService';

const getNeighbors = (board: CellData[][], x: number, y: number): CellData[] => {
  const neighbors: CellData[] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      const nextY = y + dy;
      const nextX = x + dx;
      if (nextY >= 0 && nextY < board.length && nextX >= 0 && nextX < board[nextY].length) {
        neighbors.push(board[nextY][nextX]);
      }
    }
  }

  return neighbors;
};

const getCellKey = (cell: CellData): string => `${cell.x},${cell.y}`;

export const getLocalHint = (board: CellData[][]): HintResponse | null => {
  const knownMineKeys = new Set<string>();

  for (const row of board) {
    for (const cell of row) {
      if (cell.isFlagged) knownMineKeys.add(getCellKey(cell));
    }
  }

  for (const row of board) {
    for (const cell of row) {
      if (!cell.isRevealed || cell.isMine || cell.neighborCount === 0) continue;

      const neighbors = getNeighbors(board, cell.x, cell.y);
      const hiddenCells = neighbors.filter(neighbor => !neighbor.isRevealed && !neighbor.isFlagged);
      const knownMineCount = neighbors.filter(neighbor => neighbor.isFlagged || knownMineKeys.has(getCellKey(neighbor))).length;
      const unknownHiddenCells = hiddenCells.filter(neighbor => !knownMineKeys.has(getCellKey(neighbor)));
      const remainingMineCount = cell.neighborCount - knownMineCount;

      if (remainingMineCount === unknownHiddenCells.length && unknownHiddenCells.length > 0) {
        const mineCell = unknownHiddenCells[0];
        return {
          action: 'flag',
          x: mineCell.x,
          y: mineCell.y,
          reason: `本地规则判断：数字 ${cell.neighborCount} 周围剩下的隐藏格都必须是雷，建议先标记这个格子。`
        };
      }
    }
  }

  for (const row of board) {
    for (const cell of row) {
      if (!cell.isRevealed || cell.isMine || cell.neighborCount === 0) continue;

      const neighbors = getNeighbors(board, cell.x, cell.y);
      const hiddenCells = neighbors.filter(neighbor => !neighbor.isRevealed && !neighbor.isFlagged);
      const knownMineCount = neighbors.filter(neighbor => neighbor.isFlagged || knownMineKeys.has(getCellKey(neighbor))).length;
      const unknownHiddenCells = hiddenCells.filter(neighbor => !knownMineKeys.has(getCellKey(neighbor)));

      if (unknownHiddenCells.length > 0 && knownMineCount === cell.neighborCount) {
        const safeCell = unknownHiddenCells[0];
        return {
          action: 'reveal',
          x: safeCell.x,
          y: safeCell.y,
          reason: `本地规则判断：数字 ${cell.neighborCount} 周围的雷已经全部确认，所以这个相邻格可以安全点击。`
        };
      }
    }
  }

  return null;
};

export const getSmartHint = async (
  board: CellData[][],
  apiKey: string,
  model: string
): Promise<HintResponse | null> => {
  const localHint = getLocalHint(board);
  if (localHint) return localHint;

  if (!apiKey) {
    throw new Error('本地规则暂时找不到确定安全格子，请配置 OpenRouter API 密钥后再让模型分析。');
  }

  if (!model) {
    throw new Error('请先设置 OpenRouter 模型 ID。');
  }

  return getOpenRouterHint(board, apiKey, model);
};
