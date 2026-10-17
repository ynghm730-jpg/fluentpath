import type { AiReviewResult, AiReviewRequest, ConversationTopic, ConversationLevel, ConversationTurn, ConversationFeedback } from '../types';

export const DEFAULT_WORKER_URL = 'https://fluentpath-ai.y-n-g-h-m-730.workers.dev';

const SESSION_TOKEN_KEY = 'fluentpath_ai_token';
const PERSIST_TOKEN_KEY = 'fluentpath_ai_token_persistent';
const WORKER_URL_KEY = 'fluentpath_worker_url';

/**
 * Worker URLの取得
 */
export function getWorkerUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_WORKER_URL;
  return localStorage.getItem(WORKER_URL_KEY) || DEFAULT_WORKER_URL;
}

/**
 * Worker URLの保存
 */
export function setWorkerUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = url.trim().replace(/\/+$/, '');
  localStorage.setItem(WORKER_URL_KEY, trimmed || DEFAULT_WORKER_URL);
}

/**
 * アクセストークンの取得
 * sessionStorageを優先し、永続保存が許可されている場合はlocalStorageからも確認
 */
export function getAiToken(): string {
  if (typeof window === 'undefined') return '';
  const sessionToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (sessionToken) return sessionToken;
  return localStorage.getItem(PERSIST_TOKEN_KEY) || '';
}

/**
 * アクセストークンの保存
 * @param token トークン文字列
 * @param rememberMe trueの場合はlocalStorageにも保存（デフォルトはfalseでsessionStorageのみ）
 */
export function setAiToken(token: string, rememberMe = false): void {
  if (typeof window === 'undefined') return;
  const trimmed = token.trim();
  if (!trimmed) {
    clearAiToken();
    return;
  }
  sessionStorage.setItem(SESSION_TOKEN_KEY, trimmed);
  if (rememberMe) {
    localStorage.setItem(PERSIST_TOKEN_KEY, trimmed);
  } else {
    localStorage.removeItem(PERSIST_TOKEN_KEY);
  }
}

/**
 * アクセストークンの削除
 */
export function clearAiToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(PERSIST_TOKEN_KEY);
}

/**
 * Workerとの接続テスト
 */
export async function testWorkerConnection(
  workerUrl = getWorkerUrl(),
  token = getAiToken()
): Promise<{ success: boolean; message: string; models?: any[] }> {
  const cleanUrl = workerUrl.trim().replace(/\/+$/, '');

  try {
    // 1. まずパブリックなヘルスチェック
    const healthRes = await fetch(`${cleanUrl}/api/health`, {
      method: 'GET',
    });
    if (!healthRes.ok) {
      return {
        success: false,
        message: `Workerへの接続に失敗しました (HTTP ${healthRes.status})。URLをご確認ください。`,
      };
    }

    // 2. トークンがある場合は認証付きでモデル一覧を確認
    if (token) {
      const modelsRes = await fetch(`${cleanUrl}/api/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (modelsRes.status === 401) {
        return {
          success: false,
          message: 'Workerとの通信は成功しましたが、アクセストークンが一致しません（401 Unauthorized）。',
        };
      }

      if (modelsRes.ok) {
        const data = await modelsRes.json();
        return {
          success: true,
          message: 'Workerおよびアクセストークンの認証に成功しました！Gemini APIキーや実際の添削まで成功するかは、まだ未確認です。',
          models: data.models,
        };
      }
    }

    return {
      success: true,
      message: 'Workerのヘルスチェックは成功しました。アクセストークンを入力して認証してください。',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `通信エラー: Workerに接続できませんでした (${err.message || 'CORSまたはネットワーク切断'})`,
    };
  }
}

/**
 * Gemini AIによる英文添削リクエスト
 */
export async function requestAiReview(params: AiReviewRequest): Promise<AiReviewResult> {
  const token = getAiToken();
  if (!token) {
    throw new Error('NO_TOKEN: アクセストークンが設定されていません。');
  }

  const workerUrl = getWorkerUrl();
  const endpoint = `${workerUrl}/api/review`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
  } catch (networkError: any) {
    throw new Error(
      `Workerとの通信に失敗しました。インターネット接続またはCORS設定をご確認ください (${networkError.message || 'NetworkError'})`
    );
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      // no-op
    }

    if (response.status === 401) {
      throw new Error(`認証エラー (401): ${errorDetail}`);
    }
    if (response.status === 429) {
      throw new Error(`無料枠超過・頻度制限 (429): ${errorDetail}`);
    }
    throw new Error(`AI添削エラー (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  if (!data?.result) {
    throw new Error('添削結果のフォーマットが不正です。');
  }

  const fields: (keyof AiReviewResult)[] = ['original', 'revised', 'revisedJapanese', 'grammarExplanation', 'naturalPhrasing', 'positiveFeedback'];
  if (fields.some(k => typeof data.result[k] !== 'string')) {
    throw new Error('添削結果に必要な項目が不足しています。');
  }
  return data.result as AiReviewResult;
}


// AI英会話は添削と同じWorker・AUTH_TOKENを使用する。
async function callConversationEndpoint(path: string, payload: unknown): Promise<unknown> {
  const token = getAiToken();
  if (!token) throw new Error('認証トークン未設定：瞬間英作文のAI添削と同じAUTH_TOKENを入力してください。');
  let response: Response;
  try {
    response = await fetch(`${getWorkerUrl().replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch { throw new Error('Workerへ接続できません。ネットワークを確認してください。'); }
  let data: unknown;
  try { data = await response.json(); } catch { throw new Error('Workerからの応答を読み取れませんでした。'); }
  if (!response.ok) {
    const error = (data as { error?: { message?: string } })?.error?.message;
    throw new Error(error || `AI通信エラー（HTTP ${response.status}）`);
  }
  return data;
}

export async function requestConversationReply(topic: ConversationTopic, level: ConversationLevel, turns: ConversationTurn[]): Promise<string> {
  const data = await callConversationEndpoint('/api/conversation', { topic, level, turns }) as { reply?: unknown };
  if (typeof data?.reply !== 'string' || !data.reply.trim()) throw new Error('AIの返答が空です。');
  return data.reply;
}

/** Show the reply as it arrives rather than waiting for Gemini to finish.
 * Falls back to the existing endpoint when an older Worker lacks streaming.
 */
export async function requestConversationReplyStreaming(
  topic: ConversationTopic, level: ConversationLevel, turns: ConversationTurn[],
  onPartial: (text: string) => void,
): Promise<string> {
  const token = getAiToken();
  if (!token) throw new Error('認証トークンが未設定です。');
  let response: Response;
  try {
    response = await fetch(`${getWorkerUrl().replace(/\/+$/, '')}/api/conversation/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ topic, level, turns }),
    });
  } catch { throw new Error('Workerへ接続できません。ネットワークを確認してください。'); }

  if (response.status === 404 || response.status === 405) {
    const oldReply = await requestConversationReply(topic, level, turns);
    onPartial(oldReply);
    return oldReply;
  }
  if (!response.ok) {
    let err: { error?: { message?: string } } = {};
    try { err = await response.json(); } catch { /* keep HTTP fallback */ }
    throw new Error(err.error?.message || `AI通信エラー（HTTP ${response.status}）`);
  }
  if (!response.body) throw new Error('この環境ではストリーミング応答を読み取れません。');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let allText = '';
  let finished = false;
  function consume(block: string) {
    const lines = block.split('\n');
    const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
    const json = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!json) return;
    let parsed: { text?: unknown; message?: unknown };
    try { parsed = JSON.parse(json); } catch { throw new Error('AIストリームの形式が不正です。'); }
    if (event === 'error') throw new Error(typeof parsed.message === 'string' ? parsed.message : 'AIの応答が途中で停止しました。');
    if (event === 'chunk' && typeof parsed.text === 'string') {
      allText += parsed.text;
      onPartial(allText);
    }
    if (event === 'done') finished = true;
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) consume(block);
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
  } catch (e) {
    throw e instanceof Error ? e : new Error('AIとのストリーミング接続が切断されました。');
  } finally { reader.releaseLock(); }
  if (!finished || !allText.trim()) throw new Error('AIの応答を最後まで受信できませんでした。');
  return allText.trim();
}

export async function requestConversationFeedback(topic: ConversationTopic, level: ConversationLevel, turns: ConversationTurn[]): Promise<ConversationFeedback> {
  const data = await callConversationEndpoint('/api/conversation/feedback', { topic, level, turns }) as { feedback?: ConversationFeedback };
  const f = data?.feedback;
  if (!f || !Array.isArray(f.positive) || !Array.isArray(f.corrections) || typeof f.summary !== 'string' || typeof f.nextStep !== 'string') {
    throw new Error('AIからのフィードバックの形式が正しくありません。');
  }
  return f;
}
