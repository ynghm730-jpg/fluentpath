/**
 * Phase 6B-1: API不要の架空の英語会議シナリオ。
 * 個社の情報・実際の製品仕様・未公開データは含めない。
 */
export const MEETING_SCENARIO_IDS = [
  'progress', 'technical', 'schedule', 'support', 'opinions', 'questions',
] as const;

export type MeetingScenarioId = typeof MEETING_SCENARIO_IDS[number];
export type MeetingLevel = 'B1' | 'B2';

interface MeetingQuestion {
  b1: string;
  b2: string;
  answerB1: string;
  answerB2: string;
}
interface KeyPhrase { english: string; japanese: string; }
export interface MeetingScenario {
  id: MeetingScenarioId;
  label: string;
  situation: string;
  goal: string;
  opening: Record<MeetingLevel, string>;
  openingAnswer: Record<MeetingLevel, string>;
  questions: readonly MeetingQuestion[];
  phrases: readonly KeyPhrase[];
  closing: string;
}

export const MEETING_SCENARIOS: Record<MeetingScenarioId, MeetingScenario> = {
  progress: {
    id: 'progress', label: '① 進捗報告',
    situation: '架空の開発プロジェクトの週次会議。海外チームに実験状況と次の予定を伝えます。',
    goal: '完了事項・未完了事項・次のアクションを短く整理して伝える',
    opening: {
      B1: 'Good morning. Could you give us a quick update on the project?',
      B2: 'Before we move to the next topic, could you summarize the latest progress and any outstanding work?',
    },
    openingAnswer: { B1: "We've completed the first test, and we're checking the data now.", B2: "We've completed the first phase of testing and are currently validating the data." },
    questions: [
      { b1: 'What have you completed so far?', b2: 'Which milestones have you completed, and what evidence supports your progress?', answerB1: "We've finished the initial tests and checked the results.", answerB2: "We've completed the initial test phase, and the first set of results looks consistent." },
      { b1: 'Is there anything still in progress?', b2: 'Which tasks remain open, and what is preventing you from closing them?', answerB1: "We're still reviewing the remaining data.", answerB2: "Data verification remains open because we're waiting for one more measurement." },
      { b1: 'What will you do next?', b2: 'What are the next steps, and who will be responsible for each action?', answerB1: "Next, we'll run another test and share the results.", answerB2: "We'll repeat the test tomorrow, and I'll summarize the findings for the team." },
      { b1: 'When can we expect the next update?', b2: 'Can you commit to a realistic date for the next status update?', answerB1: "I'll send an update by Friday.", answerB2: "I'll circulate an updated status report by Friday afternoon." },
      { b1: 'Does anyone need to help you?', b2: 'Is there any support you need to keep the remaining tasks on track?', answerB1: "It would help if someone could review the data.", answerB2: "A second review of the data would help us close the open items sooner." },
    ],
    phrases: [
      { english: "We're on track so far.", japanese: '今のところ予定どおり進んでいます。' },
      { english: "We're still working on the remaining items.", japanese: '残っている項目に取り組んでいます。' },
      { english: "I'll share the results by Friday.", japanese: '金曜日までに結果を共有します。' },
    ],
    closing: "Thanks for the update. Let's follow up at our next meeting.",
  },
  technical: {
    id: 'technical', label: '② 技術課題',
    situation: '架空の製造工程で装置の搬送エラーが発生。原因候補と調査方針を説明します。',
    goal: '事実・仮説・次の検証を区別して説明する',
    opening: {
      B1: 'We heard there was a handling issue during the last test. What happened?',
      B2: 'Could you walk us through the recent handling issue and explain what you know so far?',
    },
    openingAnswer: { B1: "We had a handling problem during the last test, and we're checking the logs.", B2: "A handling error occurred during the last test, and we're investigating the conditions that triggered it." },
    questions: [
      { b1: 'When did the problem start?', b2: 'When was the issue first observed, and under which test conditions?', answerB1: 'We first noticed the issue during the morning test.', answerB2: 'The issue was first observed during the morning test under the standard conditions.' },
      { b1: 'What could be causing it?', b2: 'What are your leading hypotheses, and what evidence supports them?', answerB1: "We have two possible causes, but we haven't confirmed either one.", answerB2: "Our leading hypotheses involve alignment and handling speed, but the evidence is still limited." },
      { b1: 'What have you checked already?', b2: 'Which checks have you completed, and what did you rule out?', answerB1: "We've checked the logs and repeated the test once.", answerB2: "We've reviewed the equipment logs and repeated the test, but we haven't identified the root cause." },
      { b1: 'What test will you run next?', b2: 'How will your next experiment distinguish between the remaining hypotheses?', answerB1: "We'll change one condition at a time.", answerB2: "We'll vary one parameter at a time to isolate the source of the problem." },
      { b1: 'How will you keep the team informed?', b2: 'What evidence do you need before recommending a corrective action?', answerB1: "I'll share the test results as soon as they're ready.", answerB2: "Once the results are repeatable, I'll propose a corrective action and share the supporting data." },
    ],
    phrases: [
      { english: "We haven't identified the root cause yet.", japanese: 'まだ根本原因を特定できていません。' },
      { english: 'We have two possible explanations.', japanese: '考えられる説明が2つあります。' },
      { english: 'We need more data to confirm it.', japanese: '確認にはさらなるデータが必要です。' },
    ],
    closing: "Thanks. Please share the test results when they're available.",
  },
  schedule: {
    id: 'schedule', label: '③ 日程調整',
    situation: '架空の試験装置が一時停止し、社内マイルストーンへの影響を相談します。',
    goal: '影響・代替案・判断が必要な期限を伝える',
    opening: {
      B1: 'I heard the test may be delayed. Can you explain the situation?',
      B2: 'Could you outline the schedule risk and its potential impact on our milestones?',
    },
    openingAnswer: { B1: "The equipment is unavailable, so the test may be delayed.", B2: "We have a schedule risk because the test equipment is temporarily unavailable." },
    questions: [
      { b1: 'How long might the delay be?', b2: 'What is the expected delay, and how confident are you in that estimate?', answerB1: 'The test may be delayed by about one week.', answerB2: 'We estimate a delay of roughly one week, but that depends on equipment availability.' },
      { b1: 'What is causing the delay?', b2: 'Which dependency is driving the schedule risk?', answerB1: 'The test equipment is not available right now.', answerB2: 'Equipment availability is the main constraint on the current schedule.' },
      { b1: 'Do we have another option?', b2: 'What alternatives have you evaluated to reduce the impact?', answerB1: 'We could use another tool if it is available.', answerB2: "We're evaluating an alternative tool to reduce the impact on the critical path." },
      { b1: 'What decision do you need from us?', b2: 'Which trade-off requires a decision, and when must we decide?', answerB1: 'We need to choose a test tool by Wednesday.', answerB2: 'We need approval to use the alternative tool by Wednesday to protect the next milestone.' },
      { b1: 'When will you update the schedule?', b2: 'When can you provide a revised schedule with clear assumptions?', answerB1: "I'll share a new schedule tomorrow.", answerB2: "I'll circulate a revised schedule tomorrow, including the remaining risks and assumptions." },
    ],
    phrases: [
      { english: 'There is a risk of a one-week delay.', japanese: '1週間遅れるリスクがあります。' },
      { english: 'We are considering an alternative tool.', japanese: '代替装置を検討しています。' },
      { english: 'We need to make a decision by Wednesday.', japanese: '水曜日までに決める必要があります。' },
    ],
    closing: "Understood. Let's review the updated schedule tomorrow.",
  },
  support: {
    id: 'support', label: '④ ヘルプ依頼',
    situation: '海外チームに架空の分析データのレビューを依頼します。',
    goal: '必要な協力・理由・期限を明確に依頼する',
    opening: {
      B1: 'You mentioned that you need some help. What do you need from us?',
      B2: 'Could you clarify what support you need from our team and why it is important?',
    },
    openingAnswer: { B1: "Could you help us review the test data?", B2: "We'd appreciate your team's support in reviewing the latest test data." },
    questions: [
      { b1: 'What exactly should we review?', b2: 'What is the scope of the review, and which deliverables should we focus on?', answerB1: 'Could you review the test summary and the main charts?', answerB2: 'We would appreciate a review of the test summary, especially the unusual data points.' },
      { b1: 'Why do you need our input?', b2: 'What specific uncertainty would an independent review help resolve?', answerB1: 'We want to make sure we did not miss anything.', answerB2: 'An independent review would help us check whether our interpretation is reasonable.' },
      { b1: 'When do you need the feedback?', b2: 'What is your deadline, and how does it affect the next milestone?', answerB1: 'Could you send your comments by Thursday?', answerB2: 'Feedback by Thursday would let us finalize the next test plan on Friday.' },
      { b1: 'How should we send our comments?', b2: 'What format would make the feedback easiest to act on?', answerB1: 'Please add your comments to the shared document.', answerB2: 'Please leave comments in the shared file and flag any urgent concerns separately.' },
      { b1: 'Can we schedule a short follow-up?', b2: 'Would a short follow-up meeting help us resolve any open questions?', answerB1: 'Yes, could we meet for 15 minutes on Friday?', answerB2: "A 15-minute call on Friday would help us align on the main findings." },
    ],
    phrases: [
      { english: 'Could you take a look at this?', japanese: 'こちらを確認していただけますか？' },
      { english: 'Your feedback would be really helpful.', japanese: 'フィードバックをいただけると大変助かります。' },
      { english: 'Could you get back to us by Thursday?', japanese: '木曜日までにご回答いただけますか？' },
    ],
    closing: "Sounds good. We'll review the material and get back to you.",
  },
  opinions: {
    id: 'opinions', label: '⑤ 意見交換',
    situation: '架空のテスト計画について、海外チームと異なる意見を調整します。',
    goal: '同意・懸念・代替案を丁寧に伝える',
    opening: {
      B1: 'We would like to run all the tests this week. What do you think?',
      B2: 'We propose completing the full test matrix this week. Do you see any concerns with that approach?',
    },
    openingAnswer: { B1: "I like the idea, but I think we should check the schedule first.", B2: "I understand the objective, but I'd like to discuss a few risks with the proposed timeline." },
    questions: [
      { b1: 'Why do you think that?', b2: 'Could you explain the reasoning behind your recommendation?', answerB1: "I'm concerned that we won't have enough time to check the results.", answerB2: 'My main concern is that the proposed timeline leaves too little time for data verification.' },
      { b1: 'What would you suggest instead?', b2: 'What alternative plan would you recommend, and why?', answerB1: "I suggest testing the highest-priority items first.", answerB2: "I'd prioritize the critical conditions first and schedule the remaining tests for next week." },
      { b1: 'Would that affect the deadline?', b2: 'How would your alternative affect the final milestone?', answerB1: 'I think we can still meet the main deadline.', answerB2: 'I believe we can protect the main milestone if we prioritize the highest-risk items.' },
      { b1: 'Is there anything you agree with?', b2: 'Which parts of the original proposal would you retain?', answerB1: 'I agree that we should move quickly.', answerB2: 'I agree with the goal of moving quickly, but I would change the test order.' },
      { b1: 'Can we agree on a next step?', b2: 'What practical compromise would help both teams move forward?', answerB1: "Let's review the priorities together today.", answerB2: "Let's agree on the top three conditions today and revisit the remaining scope tomorrow." },
    ],
    phrases: [
      { english: 'I see your point, but I have one concern.', japanese: 'おっしゃることは分かりますが、懸念が1つあります。' },
      { english: 'May I suggest an alternative?', japanese: '別案を提案してもよいでしょうか？' },
      { english: 'Could we meet halfway?', japanese: 'お互いに歩み寄れませんか？' },
    ],
    closing: "Thanks for the constructive discussion. Let's confirm the revised plan.",
  },
  questions: {
    id: 'questions', label: '⑥ 想定外の質問',
    situation: '架空のレビュー会議。準備していなかった質問にも落ち着いて答えます。',
    goal: '即答できないときにも確認・保留・フォローアップを伝える',
    opening: {
      B1: 'I have a few questions about the results. Is now a good time?',
      B2: "I'd like to challenge a few assumptions in the results. Can we discuss them?",
    },
    openingAnswer: { B1: "Sure. I'll do my best to answer, and I'll follow up if I need to check anything.", B2: "Of course. I'll clarify what we've verified and what still needs to be confirmed." },
    questions: [
      { b1: 'Are you sure the results are correct?', b2: 'How have you verified the reliability of the results?', answerB1: "We've checked them once, but we'll confirm them again.", answerB2: "We've completed an initial review, and we're planning a repeat test to confirm the trend." },
      { b1: 'What if the problem happens again?', b2: 'What contingency plan do you have if the issue recurs?', answerB1: "We'll stop the test and review the logs.", answerB2: "If it happens again, we'll pause testing, secure the data, and review the equipment logs." },
      { b1: 'Can you give us the exact number?', b2: 'Do you have a verified figure for that result?', answerB1: "I don't have the exact number right now. I'll check.", answerB2: "I don't want to give you an unverified figure, so I'll confirm it after the meeting." },
      { b1: 'Who will follow up on this?', b2: 'Who owns the next action, and how will you track completion?', answerB1: "I'll take care of it and send an update.", answerB2: "I'll own the follow-up and share the updated status with the team." },
      { b1: 'Is there anything we should decide today?', b2: 'Which decision can we reasonably make today given the remaining uncertainty?', answerB1: "We can agree on the next test today.", answerB2: "We can agree on the next test plan today, while keeping the final decision open until the data is verified." },
    ],
    phrases: [
      { english: 'Let me make sure I understand your question.', japanese: '質問の意図を確認させてください。' },
      { english: 'I don’t have that information right now.', japanese: 'その情報は今、手元にありません。' },
      { english: 'I’ll check and get back to you.', japanese: '確認して後ほど回答します。' },
    ],
    closing: "Thank you. Please send us the follow-up information when you have it.",
  },
};

export function getMeetingQuestion(id: MeetingScenarioId, level: MeetingLevel, index: number): string {
  const item = MEETING_SCENARIOS[id].questions[index];
  return item ? item[level === 'B1' ? 'b1' : 'b2'] : MEETING_SCENARIOS[id].closing;
}

export function getMeetingAnswer(id: MeetingScenarioId, level: MeetingLevel, index: number): string {
  if (index === 0) return MEETING_SCENARIOS[id].openingAnswer[level];
  const item = MEETING_SCENARIOS[id].questions[index - 1];
  return item ? item[level === 'B1' ? 'answerB1' : 'answerB2'] : '';
}
