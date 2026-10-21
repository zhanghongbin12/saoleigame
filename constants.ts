
import { Difficulty, DifficultySettings } from './types';

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultySettings> = {
  [Difficulty.BEGINNER]: { rows: 9, cols: 9, mines: 10 },
  [Difficulty.INTERMEDIATE]: { rows: 16, cols: 16, mines: 40 },
  [Difficulty.EXPERT]: { rows: 16, cols: 30, mines: 99 },
};
