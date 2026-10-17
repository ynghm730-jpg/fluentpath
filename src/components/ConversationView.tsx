import { useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import { BookMarked, CheckCircle2, KeyRound, LoaderCircle, Mic, MicOff, RotateCcw, Send, Volume2 } from 'lucide-react';
import type { ConversationFeedback, ConversationLevel, ConversationMode, ConversationSession, ConversationTopic, ConversationTurn, MeetingScenarioId, SelfRating } from '../types';
import { MEETING_SCENARIOS, MEETING_SCENARIO_IDS, getMeetingAnswer, getMeetingQuestion } from '../data/meetingScenarios';
import { db } from '../services/db';
import { getAiToken, requestConversationFeedback, requestConversationReplyStreaming, setAiToken } from '../services/ai';
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
  const [meetingScenarioId, setMeetingScenarioId] = useState<MeetingScenarioId>('progress');
  const [meetingSelfRating, setMeetingSelfRating] = useState<SelfRating | null>(null);
  const [showMeetingHint, setShowMeetingHint] = useState(false);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // UI-only timing: does not record personal messages or add to backups.
  const [latency, setLatency] = useState<{ firstMs: number; totalMs?: number } | null>(null);
  const [error, setError] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [rememberToken, setRememberToken] = useState(true);
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
  const isMeeting = mode === 'meeting_script' || mode === 'meeting_ai';
  const isAdaptiveMeeting = mode === 'meeting_ai';
  const usesAiReplies = mode === 'ai' || isAdaptiveMeeting;
  const usesAiFeedback = usesAiReplies || mode === 'meeting_script';
  const meetingScenario = MEETING_SCENARIOS[meetingScenarioId];
  const currentLabel = isMeeting ? meetingScenario.label : currentScenario.label;
  const maxTurns = mode === 'meeting_script' ? 6 : MAX_TURNS; // 固定会議は6回答。AIはWorkerの12発言制限に合わせて5回答。
  const replies = turns.filter(t => t.role === 'user').length;
  const example = isMeeting ? getMeetingAnswer(meetingScenarioId, level, replies)
    : currentScenario.examples[Math.min(Math.max(0, replies), currentScenario.examples.length - 1)];

  const start = () => {
    if (pending.current) return;
    if (active && !finished && !window.confirm('現在の会話を終了して、新しく始めますか？（未終了の会話は保存されません）')) return;
    const first = isMeeting ? meetingScenario.opening[level] : SCENARIOS[topic].greeting;
    const nextId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    stopSpeaking();
    recognizer.current?.stop();
    setIsListening(false);
    setLatency(null);
    setTurns([{ role: 'assistant', text: first }]);
    setDraft(''); setFinished(false); setFeedback(null); setError(''); setSavedCorrections([]);
    setMeetingSelfRating(null); setShowMeetingHint(false);
    setActive(true); setSessionId(nextId); setStartedAt(new Date().toISOString());
    speakText(first, 0.9);
    if (usesAiReplies && !getAiToken()) setIsTokenOpen(true);
  };

  const changeMode = (next: ConversationMode) => {
    if (pending.current || (active && !finished)) return;
    stopSpeaking(); recognizer.current?.stop(); setIsListening(false);
    setLatency(null);
    setActive(false); setFinished(false); setTurns([]); setDraft('');
    setFeedback(null); setError(''); setSavedCorrections([]);
    setMeetingSelfRating(null); setShowMeetingHint(false);
    setMode(next);
    if (next === 'meeting_script' || next === 'meeting_ai') setTopic('meeting');
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
    if (replies >= maxTurns) return;
    if (usesAiReplies && !getAiToken()) { setIsTokenOpen(true); return; }
    pending.current = true; setBusy(true); setError(''); setLatency(null);
    recognizer.current?.stop(); setIsListening(false); stopSpeaking();
    const userTurn: ConversationTurn = { role: 'user', text: message };
    const nextTurns = [...turns, userTurn];
    setDraft(''); setTurns(nextTurns);
    try {
      let reply: string;
      if (mode === 'meeting_script') {
        reply = getMeetingQuestion(meetingScenarioId, level, replies);
      } else if (mode === 'script') {
        reply = SCENARIOS[topic].scripted[Math.min(replies, MAX_TURNS - 1)];
      } else {
        const started = performance.now();
        let firstMs: number | undefined;
        reply = await requestConversationReplyStreaming(isAdaptiveMeeting ? 'meeting' : topic, level, nextTurns, partial => {
          if (firstMs === undefined) {
            firstMs = performance.now() - started;
            setLatency({ firstMs });
          }
          setTurns([...nextTurns, { role: 'assistant', text: partial }]);
        });
        setLatency({ firstMs: firstMs ?? performance.now() - started, totalMs: performance.now() - started });
      }
      setTurns([...nextTurns, { role: 'assistant', text: reply }]);
      setShowMeetingHint(false);
      speakText(reply, level === 'B1' ? 0.88 : 0.96);
    } catch (e) {
      // Restore draft/previous transcript so the user can retry without duplicated turns.
      setTurns(turns); setDraft(message); setLatency(null);
      setError(e instanceof Error ? e.message : '応答できませんでした。少し時間をおいてください。');
    } finally { pending.current = false; setBusy(false); }
  };

  const saveSession = async (allTurns: ConversationTurn[], withFeedback?: ConversationFeedback) => {
    const record: ConversationSession = {
      id: sessionId, startedAt, date: startedAt.slice(0, 10), mode, level, topic,
      turns: allTurns,
      ...(isMeeting ? { meetingScenarioId, ...(meetingSelfRating ? { meetingSelfRating } : {}) } : {}),
      ...(withFeedback ? { feedback: withFeedback } : {}),
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
    if (usesAiReplies) {
      try {
        const result = await requestConversationFeedback(isAdaptiveMeeting ? 'meeting' : topic, level, turns);
        setFeedback(result);
        await saveSession(turns, result);
      } catch (e) {
        setError(`会話は端末に保存しましたが、AIフィードバックは取得できませんでした：${e instanceof Error ? e.message : '通信エラー'}`);
      }
    }
    pending.current = false; setBusy(false);
  };

  const retryFeedback = async () => {
    if (!finished || !usesAiFeedback || pending.current || (feedback && feedback.corrections.length >= replies)) return;
    if (!getAiToken()) { setIsTokenOpen(true); return; }
    pending.current = true; setBusy(true); setError('');
    // 固定会議の全6回答を含めつつ、Workerの最大12発言制限を守る。
    // 最後のAIの質問・締めの発言だけは添削対象に不要。
    const feedbackTurns = mode === 'meeting_script' && turns[turns.length - 1]?.role === 'assistant' ? turns.slice(0, -1) : turns;
    try { const result = await requestConversationFeedback(isMeeting ? 'meeting' : topic, level, feedbackTurns); setFeedback(result); await saveSession(turns, result); }
    catch (e) { setError(e instanceof Error ? e.message : '再試行できませんでした。'); }
    finally { pending.current = false; setBusy(false); }
  };

  const rateMeeting = async (rating: SelfRating) => {
    if (!isMeeting || !finished || !sessionId) return;
    try {
      await db.conversations.update(sessionId, { meetingSelfRating: rating });
      setMeetingSelfRating(rating);
      setRecentSessions(await db.conversations.orderBy('startedAt').reverse().limit(5).toArray());
      onShowToast('会議練習の自己評価を保存しました', 'success');
    } catch { onShowToast('自己評価を保存できませんでした', 'error'); }
  };

  const openPastSession = (item: ConversationSession) => {
    if (busy) return;
    stopSpeaking(); recognizer.current?.stop(); setIsListening(false);
    setMode(item.mode); setTopic(item.topic); setLevel(item.level);
    setMeetingScenarioId(item.meetingScenarioId || 'progress');
    setMeetingSelfRating(item.meetingSelfRating || null); setShowMeetingHint(false);
    setLatency(null);
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
        notes: `${c.explanation}\n元の回答: ${c.original}`, tags: [isMeeting ? 'AI会議練習' : 'AI英会話', currentLabel],
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
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs">
          <button disabled={busy || (active && !finished)} className={`flex-1 rounded-lg py-2 font-bold disabled:opacity-60 ${mode === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`} onClick={() => changeMode('ai')}>AI英会話</button>
          <button disabled={busy || (active && !finished)} className={`flex-1 rounded-lg py-2 font-bold disabled:opacity-60 ${mode === 'script' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`} onClick={() => changeMode('script')}>無料シナリオ</button>
          <button disabled={busy || (active && !finished)} className={`rounded-lg py-2 font-bold disabled:opacity-60 ${mode === 'meeting_script' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`} onClick={() => changeMode('meeting_script')}>会議練習（無料）</button>
          <button disabled={busy || (active && !finished)} className={`rounded-lg py-2 font-bold disabled:opacity-60 ${isAdaptiveMeeting ? 'bg-indigo-600 text-white' : 'text-slate-600'}`} onClick={() => changeMode('meeting_ai')}>AI会議（自由対話）</button>
        </div>
        {isMeeting ? <>
          <label className="block text-xs font-bold text-slate-700" htmlFor="meeting-scenario">会議シナリオ（6種類）</label>
          <select id="meeting-scenario" value={meetingScenarioId} disabled={busy || (active && !finished)} onChange={e => setMeetingScenarioId(e.target.value as MeetingScenarioId)} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-slate-50">
            {MEETING_SCENARIO_IDS.map(id => <option key={id} value={id}>{MEETING_SCENARIOS[id].label}</option>)}
          </select>
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 space-y-1">
            <p className="text-xs text-slate-700">{meetingScenario.situation}</p>
            <p className="text-xs text-indigo-800 font-semibold">目標：{meetingScenario.goal}</p>
            <p className="text-[11px] text-slate-500">すべて架空の状況です。会社の機密情報は入力しないでください。</p>
          </div>
        </> : <>
          <label className="block text-xs font-bold text-slate-700" htmlFor="conversation-topic">テーマ</label>
          <select id="conversation-topic" value={topic} disabled={busy || (active && !finished)} onChange={e => setTopic(e.target.value as ConversationTopic)} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-slate-50">
            {topicKeys.map(k => <option key={k} value={k}>{SCENARIOS[k].label}</option>)}
          </select>
        </>}
        <label className="block text-xs font-bold text-slate-700" htmlFor="conversation-level">レベル</label>
        <select id="conversation-level" value={level} disabled={busy || (active && !finished)} onChange={e => setLevel(e.target.value as ConversationLevel)} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-slate-50">
          <option value="B1">B1（日常・仕事の基本表現）</option>
          <option value="B2">B2（少し難しい会話）</option>
        </select>
        <p className="text-[11px] leading-relaxed text-slate-500">
          {isAdaptiveMeeting ? '導入の質問は選んだ会議テーマに沿って出題されます。以降はGeminiがあなたの回答に応じて追加質問します。5回答まで、FinishでAI添削します。1回答につきAPI1回＋添削1回、Workerの1分5回制限に注意してください。' : mode === 'ai' ? 'AIモードは無料APIの回数制限に依存します。1往復につき1回、Finishの添削にもう1回APIを利用。1分5回のWorker制限もAI添削と共有します。' : mode === 'meeting_script' ? '架空の会議で導入＋5つの固定質問に回答します。APIなしで何度でも練習でき、Finish後に希望すればAI添削も利用できます。' : 'シナリオモードは固定のセリフで進みます。回答内容に応じてAIが反応・採点するものではありません。API利用なしで何度でも練習できます。'}
        </p>
        {(!active || finished) && <button onClick={start} className="w-full rounded-xl py-3 bg-blue-600 text-white font-bold flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" />{active ? '新しい会話を開始' : '会話を始める'}</button>}
      </div>

      {!active && recentSessions.length > 0 && <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
        <h3 className="text-xs font-bold text-slate-700">最近の会話を見返す</h3>
        {recentSessions.map(s => <button key={s.id} onClick={() => openPastSession(s)} className="w-full text-left p-2.5 rounded-xl bg-slate-50 text-xs border border-slate-100">
          {(s.mode === 'meeting_script' || s.mode === 'meeting_ai') && s.meetingScenarioId ? MEETING_SCENARIOS[s.meetingScenarioId].label : SCENARIOS[s.topic].label} · {s.mode === 'ai' ? 'AI' : s.mode === 'meeting_ai' ? 'AI会議' : s.mode === 'meeting_script' ? '無料会議' : '固定シナリオ'} · {s.date} · {s.turns.filter(t => t.role === 'user').length}回答
        </button>)}
      </div>}

      {active && <>
        <div className="flex items-center justify-between px-1 text-xs text-slate-600">
          <span>{currentLabel} · {level} · {isAdaptiveMeeting ? '回答に応じたAI会議' : mode === 'ai' ? 'AI応答' : isMeeting ? '固定の会議練習' : '固定シナリオ'}</span>
          <span>あなたの回答：{replies} / {maxTurns}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-3" aria-live="polite">
          {turns.map((t, i) => <div key={`${i}-${t.role}`} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[91%] text-sm rounded-2xl p-3 leading-relaxed ${t.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
              <div className={`text-[10px] font-bold mb-1 ${t.role === 'user' ? 'text-blue-100' : 'text-slate-500'}`}>{t.role === 'user' ? 'You' : mode === 'ai' ? 'AI partner' : isMeeting ? 'Meeting colleague' : 'Scenario'}</div>
              {t.text}
              {t.role === 'assistant' && t.text && <button title="英文をもう一度読み上げ" aria-label="英文を読み上げ" className="block mt-2 text-blue-600" onClick={() => speakText(t.text, level === 'B1' ? 0.88 : 0.96)}><Volume2 className="w-4 h-4" /></button>}
            </div>
          </div>)}
          {busy && <div className="text-xs text-indigo-700 flex items-center gap-2"><LoaderCircle className="w-4 h-4 animate-spin"/> {finished ? 'フィードバックを作成中...' : latency ? '英文を受信中...' : 'AIの返答を待っています...'}</div>}
          {latency && !finished && !busy && <p className="text-[11px] text-slate-500">今回の応答：最初の英文まで {(latency.firstMs / 1000).toFixed(1)}秒 / 完了まで {((latency.totalMs || latency.firstMs) / 1000).toFixed(1)}秒（参考値）</p>}
        </div>
        {error && <div role="alert" className="rounded-xl p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs leading-relaxed">{error}{finished && usesAiFeedback && !feedback && <button onClick={retryFeedback} disabled={busy} className="block mt-2 font-bold underline">後でAI添削を試す</button>}</div>}

        {!finished && replies < maxTurns && <form onSubmit={send} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <label htmlFor="conversation-answer" className="text-xs font-bold text-slate-700">あなたの返答（編集できます）</label>
          <textarea id="conversation-answer" value={draft} onChange={e => setDraft(e.target.value)} rows={3} maxLength={450} placeholder="英語で話すか、ここに入力..." className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm" />
          {mode === 'script' && <p className="text-xs text-slate-500">表現のヒント：{example}</p>}
          {mode === 'meeting_script' && <div className="space-y-1">
            <button type="button" className="text-xs text-indigo-700 font-bold underline" onClick={() => setShowMeetingHint(x => !x)}>{showMeetingHint ? '回答例を隠す' : '困ったら回答例を見る'}</button>
            {showMeetingHint && <p className="text-xs rounded-lg bg-indigo-50 p-2 text-indigo-900">例：{example}</p>}
          </div>}
          <div className="flex gap-2">
            <button type="button" onClick={toggleMic} disabled={busy} className={`rounded-xl px-4 py-3 flex items-center gap-2 font-bold text-xs ${isListening ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />} {isListening ? '停止' : 'マイク'}
            </button>
            <button type="submit" disabled={!draft.trim() || busy} className="flex-1 rounded-xl bg-blue-600 text-white py-3 font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"><Send className="w-4 h-4" />返答する</button>
          </div>
        </form>}
        {!finished && replies > 0 && <button onClick={finish} disabled={busy} className="w-full rounded-xl border-2 border-indigo-500 text-indigo-700 bg-white py-3 font-bold disabled:opacity-50">Finish · 会話を終了して振り返る</button>}
        {!finished && replies === maxTurns && <p className="text-center text-xs text-slate-500">{maxTurns}回回答しました。Finishを押して終了してください。</p>}
        {finished && <div className="bg-white rounded-2xl border border-indigo-200 p-4 space-y-3">
          <h3 className="text-base font-extrabold text-indigo-900">今回の振り返り</h3>
          {mode === 'script' && <p className="text-xs text-slate-600 leading-relaxed">固定シナリオで{replies}回練習しました。回答内容の自動採点はありません。会話履歴はこの端末に保存済みです。</p>}
          {isMeeting && <>
            <p className="text-xs text-slate-700 leading-relaxed">{meetingScenario.label}を{replies}回練習しました。{isAdaptiveMeeting ? 'AIが回答内容に合わせて追加質問しました。' : '以下は事前に用意した表現例で、AI添削の結果ではありません。'}</p>
            {mode === 'meeting_script' && <>
            <h4 className="text-xs font-bold text-indigo-800">質問と回答例</h4>
            {turns.filter(t => t.role === 'user').map((t, i) => <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1 text-xs">
              <p className="font-bold text-slate-700">{i + 1}. {i === 0 ? meetingScenario.opening[level] : getMeetingQuestion(meetingScenarioId, level, i - 1)}</p>
              <p>あなた：{t.text}</p>
              <p className="text-indigo-800">回答例：{getMeetingAnswer(meetingScenarioId, level, i)}</p>
              <button className="text-blue-700 font-bold flex items-center gap-1" onClick={() => speakText(getMeetingAnswer(meetingScenarioId, level, i), 0.88)}><Volume2 className="w-3.5 h-3.5"/>例文を読み上げ</button>
            </div>)}
            </>}
            <h4 className="text-xs font-bold text-indigo-800">会議で使える重要表現</h4>
            {meetingScenario.phrases.map(p => <div className="text-xs rounded-lg bg-indigo-50 p-2 space-y-1" key={p.english}><p className="font-semibold text-indigo-900">{p.english}</p><p className="text-slate-600">{p.japanese}</p></div>)}
            {mode === 'meeting_script' && !feedback && <button disabled={busy} onClick={retryFeedback} className="w-full rounded-xl bg-indigo-600 py-3 text-white font-bold text-sm disabled:opacity-50">Geminiに会議全体をAI添削してもらう（任意・API1回）</button>}
            <h4 className="text-xs font-bold text-indigo-800">自己評価（記録に保存）</h4>
            <div className="grid grid-cols-3 gap-2">
              {([{ id: 'perfect', label: 'すぐ言えた' }, { id: 'good', label: '少し考えた' }, { id: 'hard', label: '難しかった' }] as const).map(r => <button key={r.id} disabled={busy} onClick={() => rateMeeting(r.id)} className={`rounded-lg border p-2 text-[11px] font-bold ${meetingSelfRating === r.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-indigo-200 text-indigo-700'}`}>{r.label}</button>)}
            </div>
          </>}
          {feedback && <>
            <p className="text-sm text-slate-700">{feedback.summary}</p>
            <h4 className="text-xs font-bold text-green-700">良かった表現</h4>
            {feedback.positive.map((p, i) => <p className="text-xs bg-green-50 rounded-lg p-2" key={i}>{p}</p>)}
            <h4 className="text-xs font-bold text-indigo-800">あなたの発言を1回ずつ振り返る</h4>
            <p className="text-[11px] text-slate-500">今回のあなたの回答：{replies}回 ／ 添削が表示された回答：{feedback.corrections.length}回。正しい英文も含めて、自然な別表現を確認できます。</p>
            {feedback.corrections.length === 0 && <p className="text-xs text-slate-500">今回、修正候補は提示されませんでした。</p>}
            {feedback.corrections.map((c, i) => {
              // Older saved reviews had at most three selected corrections and no turn number.
              // Do not assign a possibly incorrect question to those historical reviews.
              const index = typeof c.turnNumber === 'number' && Number.isInteger(c.turnNumber) && c.turnNumber >= 1 && c.turnNumber <= replies ? c.turnNumber - 1 : -1;
              const question = index >= 0 ? turns[index * 2]?.text : undefined;
              return <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs" key={i}>
                <h5 className="font-bold text-indigo-800">{index >= 0 ? `${index + 1}回目の回答` : `言い換え・添削 ${i + 1}`}</h5>
                {question && <p className="rounded-lg bg-white border border-slate-200 p-2"><strong>AIからの質問：</strong>{question}</p>}
                <p><strong>元の文：</strong>{c.original}</p>
                {c.goodPoint && <p className="text-emerald-800"><strong>良かった点：</strong>{c.goodPoint}</p>}
                <p className="text-indigo-800"><strong>自然な言い換え：</strong>{c.revised}</p>
                <p><strong>日本語訳：</strong>{c.japanese}</p>
                <p><strong>解説：</strong>{c.explanation}</p>
                <button className="mt-2 mr-4 text-blue-700 font-bold inline-flex items-center gap-1" onClick={() => speakText(c.revised, 0.9)}><Volume2 className="w-4 h-4" />修正版を読み上げ</button>
                <button disabled={savedCorrections.includes(i)} className="mt-2 text-blue-700 font-bold inline-flex items-center gap-1 disabled:text-green-700" onClick={() => saveCorrection(i)}>{savedCorrections.includes(i) ? <CheckCircle2 className="w-4 h-4" /> : <BookMarked className="w-4 h-4" />} {savedCorrections.includes(i) ? '保存済み' : 'フレーズ帳に保存'}</button>
              </div>;
            })}
            {usesAiFeedback && feedback.corrections.length < replies && <button disabled={busy} onClick={retryFeedback} className="w-full rounded-xl bg-indigo-600 py-3 text-white font-bold text-xs disabled:opacity-50">以前の添削は一部の回答のみです。全{replies}回答を再添削する（Gemini API1回）</button>}
            <p className="text-xs text-slate-600"><strong>次回の練習ポイント：</strong>{feedback.nextStep}</p>
          </>}
          {usesAiReplies && !feedback && <p className="text-xs text-slate-500">AIの無料枠を使い切った場合でも、会話履歴は端末に保存されます。必要に応じて後から添削を再試行できます。</p>}
          <p className="text-[11px] text-slate-500">学習履歴はこの端末のIndexedDBに保存されます。クラウド同期はしません。</p>
        </div>}
      </>}

      {isTokenOpen && <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center"><div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-800"><KeyRound className="w-5 h-5" /> AI認証トークン</div>
        <p className="text-xs text-slate-600 leading-relaxed">CloudflareのAUTH_TOKENを入力してください。Gemini APIキーは入力しないでください。自分専用の端末では「次回以降も保存する」を選べます。共有端末では選ばないでください。</p>
        <form onSubmit={e => { e.preventDefault(); if (!tokenInput.trim()) return; setAiToken(tokenInput.trim(), rememberToken); setTokenInput(''); setIsTokenOpen(false); onShowToast('認証トークンを設定しました', 'success'); }} className="space-y-3">
          <input type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm" required aria-label="AUTH_TOKEN" />
          <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={rememberToken} onChange={e => setRememberToken(e.target.checked)} />次回以降も保存する（自分専用端末のみ）</label>
          <button className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold" type="submit">保存する</button>
        </form>
        <button className="block text-sm text-slate-600 mx-auto" type="button" onClick={() => setIsTokenOpen(false)}>キャンセル</button>
      </div></div>}
    </div>
  );
};
