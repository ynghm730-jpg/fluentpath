import { useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import { BookMarked, CheckCircle2, KeyRound, LoaderCircle, Mic, MicOff, RotateCcw, Send, Volume2 } from 'lucide-react';
import type { ConversationFeedback, ConversationLevel, ConversationMode, ConversationSession, ConversationTopic, ConversationTurn } from '../types';
import { db } from '../services/db';
import { getAiToken, requestConversationFeedback, requestConversationReply, setAiToken } from '../services/ai';
import { SpeechRecognizer, speakText, stopSpeaking } from '../services/speech';

interface Props { onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void; }
interface Scenario { label: string; greeting: string; scripted: string[]; examples: string[]; }
const SCENARIOS: Record<ConversationTopic, Scenario> = {
  cafe: {
    label: 'カフェ', greeting: 'Hi there! What can I get for you today?',
    scripted: ['What size would you like?', 'Would you like anything to eat?', 'Is that for here or to go?', 'Can I have your name for the order?', 'That will be ready in a few minutes. Anything else?'],
    examples: ["I'd like a black coffee, please.", "A medium would be great.", "No thanks, just the coffee.", "To go, please.", "It's Yuu. Thank you!"],
  },
  airport: {
    label: '空港', greeting: 'Hello! Where are you flying today?',
    scripted: ['Could I see your passport, please?', 'Do you have any bags to check?', 'Would you prefer a window or aisle seat?', 'Your flight leaves from gate B12. Do you have any questions?', 'Have a great flight!'],
    examples: ["I'm flying to Los Angeles.", 'Sure, here you are.', "I just have a carry-on.", 'An aisle seat, please.', 'Where is gate B12?'],
  },
  hotel: {
    label: 'ホテル', greeting: 'Welcome! Are you checking in today?',
    scripted: ['What name is your reservation under?', 'How many nights will you be staying?', 'Would you like breakfast included?', 'Your room is on the fifth floor. Is there anything else?', 'Enjoy your stay!'],
    examples: ["Yes, I have a reservation.", "It's under Yuu.", "I'll stay for three nights.", 'Yes, please.', 'What time is breakfast served?'],
  },
  meeting: {
    label: '英語会議', greeting: 'Good morning. Could you give us a quick update on your project?',
    scripted: ['What is the biggest issue right now?', 'What have you tried so far?', 'Do you need any support from our team?', 'When do you expect the next results?', 'Thanks for the update. Any final questions?'],
    examples: ["We're making progress, but we have one issue.", 'The schedule is a little tight.', "We've tried two different conditions.", 'Could you help us review the data?', 'We expect the results by Friday.'],
  },
  intro: {
    label: '自己紹介', greeting: 'Nice to meet you! Could you tell me a little about yourself?',
    scripted: ['What do you do for work?', 'What do you enjoy doing outside of work?', 'Why are you learning English?', 'Have you traveled abroad before?', 'That sounds interesting. Anything else you would like to share?'],
    examples: ["I'm an engineer from Japan.", 'I work on semiconductor development.', 'I enjoy baseball and traveling.', 'I want to speak more confidently at work.', "I'd love to visit New York someday."],
  },
  travel: {
    label: '旅行', greeting: 'Hi! Is this your first time visiting our city?',
    scripted: ['What places would you like to see?', 'Are you interested in museums or outdoor activities?', 'How long are you staying?', 'Would you like a restaurant recommendation?', 'Hope you have a wonderful trip!'],
    examples: ["Yes, it's my first visit.", "I'd love to see the famous sights.", 'I prefer outdoor activities.', "I'm staying for four days.", 'Do you know a good place for lunch?'],
  },
};
const topicKeys = Object.keys(SCENARIOS) as ConversationTopic[];
const MAX_TURNS = 5;

export const ConversationView: FC<Props> = ({ onShowToast }) => {
  const [mode, setMode] = useState<ConversationMode>('ai');
  const [level, setLevel] = useState<ConversationLevel>('B1');
  const [topic, setTopic] = useState<ConversationTopic>('cafe');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [isTokenOpen, setIsTokenOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState<ConversationFeedback | null>(null);
  const [savedCorrections, setSavedCorrections] = useState<number[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [sessionCount, setSessionCount] = useState(0);
  const [recentSessions, setRecentSessions] = useState<ConversationSession[]>([]);
  const recognizer = useRef<SpeechRecognizer | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    recognizer.current = new SpeechRecognizer();
    db.conversations.orderBy('startedAt').reverse().limit(5).toArray()
      .then(async rows => { setRecentSessions(rows); setSessionCount(await db.conversations.count()); })
      .catch(() => {});
    return () => { recognizer.current?.stop(); stopSpeaking(); };
  }, []);

  const currentScenario = SCENARIOS[topic];
  const replies = turns.filter(t => t.role === 'user').length;
  const example = currentScenario.examples[Math.min(Math.max(0, replies), currentScenario.examples.length - 1)];

  const start = () => {
    if (pending.current) return;
    if (active && !finished && !window.confirm('現在の会話を終了して、新しく始めますか？（未終了の会話は保存されません）')) return;
    const first = SCENARIOS[topic].greeting;
    const nextId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    stopSpeaking();
    recognizer.current?.stop();
    setIsListening(false);
    setTurns([{ role: 'assistant', text: first }]);
    setDraft(''); setFinished(false); setFeedback(null); setError(''); setSavedCorrections([]);
    setActive(true); setSessionId(nextId); setStartedAt(new Date().toISOString());
    speakText(first, 0.9);
    if (mode === 'ai' && !getAiToken()) setIsTokenOpen(true);
  };

  const toggleMic = () => {
    if (busy || finished) return;
    if (isListening) { recognizer.current?.stop(); setIsListening(false); return; }
    stopSpeaking();
    const ok = recognizer.current?.start(
      (transcript) => setDraft(transcript),
      (message) => { setIsListening(false); onShowToast(message, 'error'); },
      () => setIsListening(false),
    );
    if (ok) setIsListening(true);
  };

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const message = draft.trim();
    if (!active || finished || pending.current || !message) return;
    if (message.length > 450) { setError('回答は450文字以内で入力してください。'); return; }
    if (replies >= MAX_TURNS) return;
    if (mode === 'ai' && !getAiToken()) { setIsTokenOpen(true); return; }
    pending.current = true; setBusy(true); setError('');
    recognizer.current?.stop(); setIsListening(false); stopSpeaking();
    const userTurn: ConversationTurn = { role: 'user', text: message };
    const nextTurns = [...turns, userTurn];
    setDraft(''); setTurns(nextTurns);
    try {
      let reply: string;
      if (mode === 'script') {
        reply = SCENARIOS[topic].scripted[Math.min(replies, MAX_TURNS - 1)];
      } else {
        reply = await requestConversationReply(topic, level, nextTurns);
      }
      setTurns([...nextTurns, { role: 'assistant', text: reply }]);
      speakText(reply, level === 'B1' ? 0.88 : 0.96);
    } catch (e) {
      // Restore draft/previous transcript so the user can retry without duplicated turns.
      setTurns(turns); setDraft(message);
      setError(e instanceof Error ? e.message : '応答できませんでした。少し時間をおいてください。');
    } finally { pending.current = false; setBusy(false); }
  };

  const saveSession = async (allTurns: ConversationTurn[], withFeedback?: ConversationFeedback) => {
    const record: ConversationSession = {
      id: sessionId, startedAt, date: startedAt.slice(0, 10), mode, level, topic,
      turns: allTurns, ...(withFeedback ? { feedback: withFeedback } : {}),
    };
    await db.conversations.put(record);
    setSessionCount(await db.conversations.count());
    setRecentSessions(await db.conversations.orderBy('startedAt').reverse().limit(5).toArray());
  };

  const finish = async () => {
    if (!active || pending.current || replies === 0) return;
    pending.current = true; setBusy(true); setError(''); stopSpeaking();
    recognizer.current?.stop(); setIsListening(false);
    setFinished(true);
    try { await saveSession(turns); }
    catch { onShowToast('会話履歴の保存に失敗しました', 'error'); }
    if (mode === 'ai') {
      try {
        const result = await requestConversationFeedback(topic, level, turns);
        setFeedback(result);
        await saveSession(turns, result);
      } catch (e) {
        setError(`会話は端末に保存しましたが、AIフィードバックは取得できませんでした：${e instanceof Error ? e.message : '通信エラー'}`);
      }
    }
    pending.current = false; setBusy(false);
  };

  const retryFeedback = async () => {
    if (!finished || mode !== 'ai' || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { const result = await requestConversationFeedback(topic, level, turns); setFeedback(result); await saveSession(turns, result); }
    catch (e) { setError(e instanceof Error ? e.message : '再試行できませんでした。'); }
    finally { pending.current = false; setBusy(false); }
  };

  const openPastSession = (item: ConversationSession) => {
    if (busy) return;
    stopSpeaking(); recognizer.current?.stop(); setIsListening(false);
    setMode(item.mode); setTopic(item.topic); setLevel(item.level);
    setTurns(item.turns); setFeedback(item.feedback || null); setFinished(true);
    setActive(true); setError(''); setSavedCorrections([]); setDraft('');
    setStartedAt(item.startedAt); setSessionId(item.id);
  };

  const saveCorrection = async (index: number) => {
    const c = feedback?.corrections[index];
    if (!c || savedCorrections.includes(index)) return;
    try {
      await db.phrases.put({
        id: `conversation-${sessionId}-${index}`, english: c.revised, japanese: c.japanese,
        notes: `${c.explanation}\n元の回答: ${c.original}`, tags: ['AI英会話', currentScenario.label],
        isBookmarked: true, reviewCount: 0, createdAt: new Date().toISOString(),
      });
      setSavedCorrections(p => [...p, index]);
      onShowToast('修正版をフレーズ帳に保存しました', 'success');
    } catch { onShowToast('保存に失敗しました', 'error'); }
  };

  return (
    <div className="space-y-4 pb-14">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-700 p-5 text-white">
        <div className="text-xs text-blue-100 font-bold">FluentPath · Speaking</div>
        <h2 className="text-xl font-extrabold mt-1">AI英会話・ロールプレイ</h2>
        <p className="text-xs text-blue-100 mt-2">英語で1〜2文ずつ。会話中は訂正せず、Finishでまとめて振り返ります。</p>
        <p className="text-[11px] text-blue-100 mt-2">この端末の保存済み会話：{sessionCount}回</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex rounded-xl bg-slate-100 p-1 gap-1 text-xs">
          <button disabled={active && !finished} className={`flex-1 rounded-lg py-2 font-bold disabled:opacity-60 ${mode === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`} onClick={() => setMode('ai')}>AI英会話</button>
          <button disabled={active && !finished} className={`flex-1 rounded-lg py-2 font-bold disabled:opacity-60 ${mode === 'script' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`} onClick={() => setMode('script')}>無料シナリオ</button>
        </div>
        <label className="block text-xs font-bold text-slate-700" htmlFor="conversation-topic">テーマ</label>
        <select id="conversation-topic" value={topic} disabled={active && !finished} onChange={e => setTopic(e.target.value as ConversationTopic)} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-slate-50">
          {topicKeys.map(k => <option key={k} value={k}>{SCENARIOS[k].label}</option>)}
        </select>
        <label className="block text-xs font-bold text-slate-700" htmlFor="conversation-level">レベル</label>
        <select id="conversation-level" value={level} disabled={active && !finished} onChange={e => setLevel(e.target.value as ConversationLevel)} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-slate-50">
          <option value="B1">B1（日常・仕事の基本表現）</option>
          <option value="B2">B2（少し難しい会話）</option>
        </select>
        <p className="text-[11px] leading-relaxed text-slate-500">
          {mode === 'ai' ? 'AIモードは無料APIの回数制限に依存します。1往復につき1回、Finishの添削にもう1回APIを利用。1分5回のWorker制限もAI添削と共有します。' : 'シナリオモードは固定のセリフで進みます。回答内容に応じてAIが反応・採点するものではありません。API利用なしで何度でも練習できます。'}
        </p>
        {(!active || finished) && <button onClick={start} className="w-full rounded-xl py-3 bg-blue-600 text-white font-bold flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" />{active ? '新しい会話を開始' : '会話を始める'}</button>}
      </div>

      {!active && recentSessions.length > 0 && <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
        <h3 className="text-xs font-bold text-slate-700">最近の会話を見返す</h3>
        {recentSessions.map(s => <button key={s.id} onClick={() => openPastSession(s)} className="w-full text-left p-2.5 rounded-xl bg-slate-50 text-xs border border-slate-100">
          {SCENARIOS[s.topic].label} · {s.mode === 'ai' ? 'AI' : '固定シナリオ'} · {s.date} · {s.turns.filter(t => t.role === 'user').length}回答
        </button>)}
      </div>}

      {active && <>
        <div className="flex items-center justify-between px-1 text-xs text-slate-600">
          <span>{SCENARIOS[topic].label} · {level} · {mode === 'ai' ? 'AI応答' : '固定シナリオ'}</span>
          <span>あなたの回答：{replies} / {MAX_TURNS}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-3" aria-live="polite">
          {turns.map((t, i) => <div key={`${i}-${t.role}`} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[91%] text-sm rounded-2xl p-3 leading-relaxed ${t.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
              <div className={`text-[10px] font-bold mb-1 ${t.role === 'user' ? 'text-blue-100' : 'text-slate-500'}`}>{t.role === 'user' ? 'You' : mode === 'ai' ? 'AI partner' : 'Scenario'}</div>
              {t.text}
              {t.role === 'assistant' && <button title="英文をもう一度読み上げ" aria-label="英文を読み上げ" className="block mt-2 text-blue-600" onClick={() => speakText(t.text, level === 'B1' ? 0.88 : 0.96)}><Volume2 className="w-4 h-4" /></button>}
            </div>
          </div>)}
          {busy && <div className="text-xs text-indigo-700 flex items-center gap-2"><LoaderCircle className="w-4 h-4 animate-spin"/> {finished ? 'フィードバックを作成中...' : 'AIの返答を生成中...'}</div>}
        </div>
        {error && <div role="alert" className="rounded-xl p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs leading-relaxed">{error}{finished && mode === 'ai' && !feedback && <button onClick={retryFeedback} disabled={busy} className="block mt-2 font-bold underline">後でフィードバックを再試行する</button>}</div>}

        {!finished && replies < MAX_TURNS && <form onSubmit={send} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <label htmlFor="conversation-answer" className="text-xs font-bold text-slate-700">あなたの返答（編集できます）</label>
          <textarea id="conversation-answer" value={draft} onChange={e => setDraft(e.target.value)} rows={3} maxLength={450} placeholder="英語で話すか、ここに入力..." className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm" />
          {mode === 'script' && <p className="text-xs text-slate-500">表現のヒント：{example}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={toggleMic} disabled={busy} className={`rounded-xl px-4 py-3 flex items-center gap-2 font-bold text-xs ${isListening ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />} {isListening ? '停止' : 'マイク'}
            </button>
            <button type="submit" disabled={!draft.trim() || busy} className="flex-1 rounded-xl bg-blue-600 text-white py-3 font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"><Send className="w-4 h-4" />返答する</button>
          </div>
        </form>}
        {!finished && replies > 0 && <button onClick={finish} disabled={busy} className="w-full rounded-xl border-2 border-indigo-500 text-indigo-700 bg-white py-3 font-bold disabled:opacity-50">Finish · 会話を終了して振り返る</button>}
        {!finished && replies === MAX_TURNS && <p className="text-center text-xs text-slate-500">5回回答しました。Finishを押して終了してください。</p>}
        {finished && <div className="bg-white rounded-2xl border border-indigo-200 p-4 space-y-3">
          <h3 className="text-base font-extrabold text-indigo-900">今回の振り返り</h3>
          {mode === 'script' && <p className="text-xs text-slate-600 leading-relaxed">固定シナリオで{replies}回練習しました。回答内容の自動採点はありません。会話履歴はこの端末に保存済みです。</p>}
          {feedback && <>
            <p className="text-sm text-slate-700">{feedback.summary}</p>
            <h4 className="text-xs font-bold text-green-700">良かった表現</h4>
            {feedback.positive.map((p, i) => <p className="text-xs bg-green-50 rounded-lg p-2" key={i}>{p}</p>)}
            <h4 className="text-xs font-bold text-indigo-800">より自然な言い換え</h4>
            {feedback.corrections.length === 0 && <p className="text-xs text-slate-500">今回、修正候補は提示されませんでした。</p>}
            {feedback.corrections.map((c, i) => <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs" key={i}>
              <p><strong>元の文：</strong>{c.original}</p>
              <p className="text-indigo-800"><strong>修正版：</strong>{c.revised}</p>
              <p><strong>日本語訳：</strong>{c.japanese}</p>
              <p><strong>解説：</strong>{c.explanation}</p>
              <button disabled={savedCorrections.includes(i)} className="mt-2 text-blue-700 font-bold flex items-center gap-1 disabled:text-green-700" onClick={() => saveCorrection(i)}>{savedCorrections.includes(i) ? <CheckCircle2 className="w-4 h-4" /> : <BookMarked className="w-4 h-4" />} {savedCorrections.includes(i) ? '保存済み' : 'フレーズ帳に保存'}</button>
            </div>)}
            <p className="text-xs text-slate-600"><strong>次回の練習ポイント：</strong>{feedback.nextStep}</p>
          </>}
          {mode === 'ai' && !feedback && <p className="text-xs text-slate-500">AIの無料枠を使い切った場合でも、会話履歴は端末に保存されます。</p>}
          <p className="text-[11px] text-slate-500">学習履歴はこの端末のIndexedDBに保存されます。クラウド同期はしません。</p>
        </div>}
      </>}

      {isTokenOpen && <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center"><div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-800"><KeyRound className="w-5 h-5" /> AI認証トークン</div>
        <p className="text-xs text-slate-600 leading-relaxed">CloudflareのAUTH_TOKENを入力してください。Gemini APIキーは入力しないでください。トークンはこのタブのセッション中だけ保存します。</p>
        <form onSubmit={e => { e.preventDefault(); if (!tokenInput.trim()) return; setAiToken(tokenInput.trim(), false); setTokenInput(''); setIsTokenOpen(false); onShowToast('認証トークンを設定しました', 'success'); }} className="space-y-3">
          <input type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm" required aria-label="AUTH_TOKEN" />
          <button className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold" type="submit">保存する</button>
        </form>
        <button className="block text-sm text-slate-600 mx-auto" type="button" onClick={() => setIsTokenOpen(false)}>キャンセル</button>
      </div></div>}
    </div>
  );
};
