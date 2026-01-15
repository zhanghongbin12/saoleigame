
import { CellData, DifficultySettings } from '../types';

export const createEmptyBoard = (settings: DifficultySettings): CellData[][] => {
  const { rows, cols } = settings;
  const board: CellData[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: CellData[] = [];
    for (let x = 0; x < cols; x++) {
      row.push({
        x,
        y,
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborCount: 0,
      });
    }
    board.push(row);
  }
  return board;
};

export const placeMines = (
  board: CellData[][], 
  settings: DifficultySettings, 
  safeX: number, 
  safeY: number
): CellData[][] => {
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));
  let minesPlaced = 0;
  const { rows, cols, mines } = settings;

  while (minesPlaced < mines) {
    const x = Math.floor(Math.random() * cols);
    const y = Math.floor(Math.random() * rows);

    // Don't place mine on safe zone (clicked cell and its immediate neighbors)
    const isSafe = Math.abs(x - safeX) <= 1 && Math.abs(y - safeY) <= 1;

    if (!newBoard[y][x].isMine && !isSafe) {
      newBoard[y][x].isMine = true;
      minesPlaced++;
    }
  }

  // Calculate neighbor counts
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!newBoard[y][x].isMine) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && newBoard[ny][nx].isMine) {
              count++;
            }
          }
        }
        newBoard[y][x].neighborCount = count;
      }
    }
  }

  return newBoard;
};

export const revealCell = (board: CellData[][], x: number, y: number): CellData[][] => {
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));
  const rows = newBoard.length;
  const cols = newBoard[0].length;

  const revealRecursive = (cx: number, cy: number) => {
    if (cy < 0 || cy >= rows || cx < 0 || cx >= cols || newBoard[cy][cx].isRevealed || newBoard[cy][cx].isFlagged) {
      return;
    }

    newBoard[cy][cx].isRevealed = true;

    if (newBoard[cy][cx].neighborCount === 0 && !newBoard[cy][cx].isMine) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx !== 0 || dy !== 0) {
            revealRecursive(cx + dx, cy + dy);
          }
        }
      }
    }
  };

  revealRecursive(x, y);
  return newBoard;
};

export const checkWin = (board: CellData[][], settings: DifficultySettings): boolean => {
  let revealedCount = 0;
  const totalCells = settings.rows * settings.cols;
  for (const row of board) {
    for (const cell of row) {
      if (cell.isRevealed && !cell.isMine) {
        revealedCount++;
      }
    }
  }
  return revealedCount === totalCells - settings.mines;
};
