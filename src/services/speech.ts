let cachedVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

// 音声読み上げ（TTS: Text-to-Speech）
export function speakText(
  text: string,
  rate = 1.0,
  pitch = 1.0,
  onEnd?: () => void
): boolean {
  if (!('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis is not supported in this browser.');
    return false;
  }

  try {
    // 進行中の読み上げがあればキャンセル
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = pitch;

    // 利用可能なen-USボイスの選定
    const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
    const usVoice = voices.find(
      (v) => v.lang === 'en-US' && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.default)
    ) || voices.find((v) => v.lang.startsWith('en'));

    if (usVoice) {
      utterance.voice = usVoice;
    }

    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd();
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error('Speech synthesis error:', err);
    if (onEnd) onEnd();
    return false;
  }
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/** Spoken sentence queue for AI streaming replies.
 * The stream callback supplies cumulative text. Speak only complete sentences,
 * never restart or overlap utterances; flush the final fragment on completion.
 * Browser Web Speech voices and their startup delay can vary by device.
 */
export class StreamingSpeechQueue {
  private lastText = '';
  private buffer = '';
  private sentences: string[] = [];
  private speaking = false;
  private cancelled = false;
  private generation = 0;
  private rate: number;
  constructor(rate = 0.9) {
    this.rate = rate;
    stopSpeaking();
  }

  public push(cumulativeText: string): void {
    if (this.cancelled || !cumulativeText.startsWith(this.lastText)) return;
    this.buffer += cumulativeText.slice(this.lastText.length);
    this.lastText = cumulativeText;
    this.extractCompleteSentences();
  }

  private extractCompleteSentences(): void {
    // A sentence boundary is followed by whitespace. A decimal number like 3.1
    // or a partially streamed token will not be spoken prematurely.
    while (true) {
      const match = /[.!?]["'’”]?\s+/.exec(this.buffer);
      if (!match) break;
      const boundary = match.index + match[0].length;
      const sentence = this.buffer.slice(0, boundary).trim();
      this.buffer = this.buffer.slice(boundary);
      if (sentence) this.sentences.push(sentence);
    }
    this.playNext();
  }

  public finish(fullText: string): void {
    if (this.cancelled) return;
    this.push(fullText);
    // All remaining text is safe to read once the stream is complete.
    if (this.buffer.trim()) this.sentences.push(this.buffer.trim());
    this.buffer = '';
    this.playNext();
  }

  private playNext(): void {
    if (this.cancelled || this.speaking || this.sentences.length === 0) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const next = this.sentences.shift()!;
    this.speaking = true;
    const generation = this.generation;
    try {
      const utterance = new SpeechSynthesisUtterance(next);
      utterance.lang = 'en-US';
      utterance.rate = this.rate;
      const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang === 'en-US' && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.default))
        || voices.find(v => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;
      const done = () => {
        if (this.cancelled || generation !== this.generation) return;
        this.speaking = false;
        this.playNext();
      };
      utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
    } catch {
      this.speaking = false;
      this.playNext();
    }
  }

  public cancel(): void {
    this.cancelled = true;
    this.generation++;
    this.sentences = [];
    this.buffer = '';
    this.speaking = false;
    stopSpeaking();
  }
}

// 音声認識（STT: Speech-to-Text）のインターフェース
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionType = any;

function getSpeechRecognitionClass(): SpeechRecognitionType | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return !!getSpeechRecognitionClass();
}

export class SpeechRecognizer {
  private recognition: SpeechRecognitionType | null = null;
  private isListening = false;

  constructor() {
    const RecognitionClass = getSpeechRecognitionClass();
    if (RecognitionClass) {
      this.recognition = new RecognitionClass();
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = true;
      this.recognition.continuous = false;
      this.recognition.maxAlternatives = 3;
    }
  }

  public start(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (errorMsg: string) => void,
    onEnd: () => void
  ): boolean {
    if (!this.recognition) {
      onError('このブラウザは音声認識に対応していません。テキスト入力をご利用ください。');
      return false;
    }

    if (this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // no-op
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      if (finalTranscript) {
        onResult(finalTranscript.trim(), true);
      } else if (interimTranscript) {
        onResult(interimTranscript.trim(), false);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      let msg = '音声認識中にエラーが発生しました。';
      if (event.error === 'not-allowed') {
        msg = 'マイクのアクセスが許可されていません。ブラウザ設定でマイクを許可するか、テキストで入力してください。';
      } else if (event.error === 'no-speech') {
        msg = '音声が検出されませんでした。もう一度お試しください。';
      } else if (event.error === 'network') {
        msg = '音声認識ネットワークエラーが発生しました。テキスト入力もお使いいただけます。';
      }
      onError(msg);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };

    try {
      this.isListening = true;
      this.recognition.start();
      return true;
    } catch (err) {
      this.isListening = false;
      onError('音声認識の開始に失敗しました。');
      return false;
    }
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // no-op
      }
      this.isListening = false;
    }
  }
}

// テキスト正規化と類似度判定（固定解と一致しないだけで不正解にしない設計）
export function normalizeSentence(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

export function evaluateSimilarity(
  userText: string,
  modelText: string,
  acceptableAnswers: string[] = []
): { score: number; matchedTarget: string } {
  const userWords = normalizeSentence(userText);
  if (userWords.length === 0) {
    return { score: 0, matchedTarget: modelText };
  }

  const targets = [modelText, ...acceptableAnswers];
  let bestScore = 0;
  let bestTarget = modelText;

  for (const target of targets) {
    const targetWords = normalizeSentence(target);
    if (targetWords.length === 0) continue;

    // 単語の一致度（Jaccard風オーバーラップ）
    let matchCount = 0;
    const targetWordsCopy = [...targetWords];

    for (const uw of userWords) {
      const idx = targetWordsCopy.indexOf(uw);
      if (idx !== -1) {
        matchCount++;
        targetWordsCopy.splice(idx, 1);
      }
    }

    const recall = matchCount / targetWords.length;
    const precision = matchCount / userWords.length;
    const f1 = (precision + recall > 0) ? (2 * precision * recall) / (precision + recall) : 0;
    const score = Math.round(f1 * 100);

    if (score > bestScore) {
      bestScore = score;
      bestTarget = target;
    }
  }

  return { score: bestScore, matchedTarget: bestTarget };
}
