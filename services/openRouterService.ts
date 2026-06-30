
import { CellData, HintResponse } from "../types";

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
}

const boardToString = (board: CellData[][]): string => (
  board
    .map(row =>
      row
        .map(cell => {
          if (cell.isFlagged) return 'F';
          if (!cell.isRevealed) return '?';
          if (cell.isMine) return 'M';
          return cell.neighborCount.toString();
        })
        .join(' ')
    )
    .join('\n')
);

const parseHintResponse = (text: string): HintResponse | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as HintResponse;
  } catch {
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return null;
    try {
      return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as HintResponse;
    } catch {
      return null;
    }
  }
};

const isValidHint = (hint: HintResponse | null, board: CellData[][]): hint is HintResponse => {
  if (!hint) return false;
  if (!Number.isInteger(hint.x) || !Number.isInteger(hint.y)) return false;
  if (typeof hint.reason !== 'string' || !hint.reason.trim()) return false;
  if (hint.y < 0 || hint.y >= board.length) return false;
  if (hint.x < 0 || hint.x >= board[hint.y].length) return false;
  return true;
};

export const getOpenRouterHint = async (
  board: CellData[][],
  apiKey: string,
  model: string = DEFAULT_OPENROUTER_MODEL
): Promise<HintResponse | null> => {
  const boardString = boardToString(board);
  const referer = typeof window !== 'undefined' ? window.location.origin : undefined;

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(referer ? { 'HTTP-Referer': referer } : {}),
      'X-Title': 'Minesweeper BYOK'
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a Minesweeper expert. Return JSON only: {"x": number, "y": number, "reason": string}.'
        },
        {
          role: 'user',
          content: `Board rules:
'?' = hidden cell
'F' = flagged cell
0-8 = adjacent mine count

Board state:
${boardString}

Pick one coordinate (x, y) that is very likely safe to click. x is column index (0-based), y is row index (0-based).`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content;
  const contentText = Array.isArray(content)
    ? content.map(part => part.text || '').join('')
    : (content || '');
  const hint = parseHintResponse(contentText);

  if (!isValidHint(hint, board)) {
    return null;
  }

  return hint;
};
