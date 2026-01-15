
import { GoogleGenAI, Type } from "@google/genai";
import { CellData, HintResponse } from "../types";

export const getGeminiHint = async (board: CellData[][]): Promise<HintResponse | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Create a textual representation of the board for the AI
  const boardString = board.map(row => 
    row.map(cell => {
      if (cell.isFlagged) return 'F';
      if (!cell.isRevealed) return '?';
      if (cell.isMine) return 'M';
      return cell.neighborCount.toString();
    }).join(' ')
  ).join('\n');

  const prompt = `You are a Minesweeper expert. Here is the current state of a board (Rows x Cols):
  '?' = hidden cell
  'F' = flagged cell
  Numbers 0-8 = number of adjacent mines
  
  Board state:
  ${boardString}
  
  Identify a single coordinate (x, y) that is definitely NOT a mine based on logic. 
  x is the column index (0-based, left to right).
  y is the row index (0-based, top to bottom).
  
  Return the coordinate and a short explanation of your reasoning.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            x: { type: Type.INTEGER },
            y: { type: Type.INTEGER },
            reason: { type: Type.STRING },
          },
          required: ["x", "y", "reason"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
  } catch (error) {
    console.error("Gemini Hint Error:", error);
  }
  return null;
};
