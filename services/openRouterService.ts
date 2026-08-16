
import { CellData, HintResponse } from "../types";

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const OPENROUTER_TIMEOUT_MS = 18000;

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
}

const normalizeHintResponse = (value: unknown): HintResponse | null => {
  if (!value || typeof value !== 'object') return null;

  const hint = value as Partial<HintResponse>;
  return {
    action: hint.action === 'flag' ? 'flag' : 'reveal',
    x: hint.x as number,
    y: hint.y as number,
    reason: hint.reason as string
  };
};

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
    return normalizeHintResponse(JSON.parse(trimmed));
  } catch {
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return null;
    try {
      return normalizeHintResponse(JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)));
    } catch {
      return null;
    }
  }
};

const isValidHint = (hint: HintResponse | null, board: CellData[][]): hint is HintResponse => {
  if (!hint) return false;
  if (!Number.isInteger(hint.x) || !Number.isInteger(hint.y)) return false;
  if (typeof hint.reason !== 'string' || !hint.reason.trim()) return false;
  if (hint.action !== 'reveal' && hint.action !== 'flag') return false;
  if (hint.y < 0 || hint.y >= board.length) return false;
  if (hint.x < 0 || hint.x >= board[hint.y].length) return false;
  if (board[hint.y][hint.x].isRevealed || board[hint.y][hint.x].isFlagged) return false;
  return true;
};

export const getOpenRouterHint = async (
  board: CellData[][],
  apiKey: string,
  model: string = DEFAULT_OPENROUTER_MODEL
): Promise<HintResponse | null> => {
  const boardString = boardToString(board);
  const referer = typeof window !== 'undefined' ? window.location.origin : undefined;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(referer ? { 'HTTP-Referer': referer } : {}),
        'X-OpenRouter-Title': 'AI Minesweeper'
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a Minesweeper expert. Return JSON only: {"action": "reveal" | "flag", "x": number, "y": number, "reason": string}. Use action="flag" when the cell is likely a mine and action="reveal" when the cell is likely safe. The reason must be written in Simplified Chinese.'
          },
          {
            role: 'user',
            content: `扫雷规则：
'?' = hidden cell
'F' = flagged cell
0-8 = adjacent mine count

当前棋盘：
${boardString}

请选择一个最有价值的建议：如果能判断某格是雷，返回 action="flag"；如果能判断某格安全，返回 action="reveal"。x 是从 0 开始的列索引，y 是从 0 开始的行索引。`
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
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('OpenRouter 响应超时，请稍后重试或换一个更快的模型。');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
