
import { Difficulty, DifficultySettings } from './types';

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultySettings> = {
  [Difficulty.BEGINNER]: { rows: 9, cols: 9, mines: 10 },
  [Difficulty.INTERMEDIATE]: { rows: 16, cols: 16, mines: 40 },
  [Difficulty.EXPERT]: { rows: 16, cols: 30, mines: 99 },
};

export const COLORS = {
  1: 'text-blue-400',
  2: 'text-emerald-400',
  3: 'text-rose-400',
  4: 'text-indigo-400',
  5: 'text-amber-400',
  6: 'text-cyan-400',
  7: 'text-purple-400',
  8: 'text-stone-400',
};
