/** Phase 6A: 無料・オフラインで使える即答用の質問（アメリカ英語） */
export type QuickResponseCategory = 'business' | 'daily';

export interface QuickResponseQuestion {
  id: string;
  category: QuickResponseCategory;
  english: string;
  japanese: string;
  sampleAnswer: string;
  sampleJapanese: string;
}

export const QUICK_RESPONSE_QUESTIONS: QuickResponseQuestion[] = [
  { id: 'qr-b01', category: 'business', english: 'What are you working on right now?', japanese: '今はどんな仕事に取り組んでいますか？', sampleAnswer: "I'm currently working on a new development project.", sampleJapanese: '現在、新しい開発プロジェクトに取り組んでいます。' },
  { id: 'qr-b02', category: 'business', english: 'Could you give me a quick status update?', japanese: '進捗を簡単に教えてもらえますか？', sampleAnswer: "We're on track, and the next test is scheduled for Friday.", sampleJapanese: '順調に進んでおり、次の試験は金曜日に予定しています。' },
  { id: 'qr-b03', category: 'business', english: 'What is the biggest challenge at the moment?', japanese: '現時点で最大の課題は何ですか？', sampleAnswer: 'The biggest challenge is identifying the root cause of the issue.', sampleJapanese: '最大の課題は問題の根本原因を特定することです。' },
  { id: 'qr-b04', category: 'business', english: 'When do you expect to finish the test?', japanese: '試験はいつ終了する見込みですか？', sampleAnswer: 'I expect to finish it by the end of next week.', sampleJapanese: '来週末までに終了する見込みです。' },
  { id: 'qr-b05', category: 'business', english: 'What should we do if the equipment breaks down?', japanese: '装置が故障したらどうすべきですか？', sampleAnswer: 'We should check the logs and look for an alternative tool.', sampleJapanese: 'ログを確認し、代替装置を探すべきです。' },
  { id: 'qr-b06', category: 'business', english: 'Why was the schedule delayed?', japanese: 'なぜスケジュールが遅れたのですか？', sampleAnswer: 'We needed more time to verify the test results.', sampleJapanese: '試験結果の確認に追加の時間が必要でした。' },
  { id: 'qr-b07', category: 'business', english: 'Can you explain the issue in simple terms?', japanese: '問題を簡単に説明してもらえますか？', sampleAnswer: "We're seeing unexpected defects during the process.", sampleJapanese: '工程中に想定外の欠陥が発生しています。' },
  { id: 'qr-b08', category: 'business', english: 'Do you have any concerns about this plan?', japanese: 'この計画について懸念はありますか？', sampleAnswer: "I'm concerned that the timeline may be too tight.", sampleJapanese: 'スケジュールが厳しすぎるのではないかと懸念しています。' },
  { id: 'qr-b09', category: 'business', english: 'What would you recommend as the next step?', japanese: '次のステップとして何を提案しますか？', sampleAnswer: 'I suggest running a short test to narrow down the cause.', sampleJapanese: '原因を絞り込むための短い試験を提案します。' },
  { id: 'qr-b10', category: 'business', english: 'Could you send me the data by Friday?', japanese: '金曜日までにデータを送っていただけますか？', sampleAnswer: "Sure, I'll send it to you by Thursday afternoon.", sampleJapanese: 'もちろんです。木曜午後までに送ります。' },
  { id: 'qr-b11', category: 'business', english: 'What makes you think that is the cause?', japanese: 'それが原因だと考える理由は何ですか？', sampleAnswer: 'The data shows the same pattern in several tests.', sampleJapanese: '複数の試験で同じ傾向がデータに出ています。' },
  { id: 'qr-b12', category: 'business', english: 'How can I help you move this forward?', japanese: 'この件を前に進めるために何を手伝えますか？', sampleAnswer: 'Could you help us review the test conditions?', sampleJapanese: '試験条件の確認を手伝ってもらえますか？' },
  { id: 'qr-d01', category: 'daily', english: 'What did you do last weekend?', japanese: '先週末は何をしましたか？', sampleAnswer: 'I spent most of the weekend with my family.', sampleJapanese: '週末の大半を家族と過ごしました。' },
  { id: 'qr-d02', category: 'daily', english: 'What do you usually do in the morning?', japanese: '普段の朝は何をしますか？', sampleAnswer: 'I usually make coffee and study English for a while.', sampleJapanese: '普段はコーヒーを淹れて、しばらく英語を勉強します。' },
  { id: 'qr-d03', category: 'daily', english: 'What kind of coffee do you prefer?', japanese: 'どんなコーヒーが好きですか？', sampleAnswer: 'I prefer strong black coffee without sugar.', sampleJapanese: '砂糖を入れない濃いブラックコーヒーが好きです。' },
  { id: 'qr-d04', category: 'daily', english: 'Where would you like to travel next?', japanese: '次はどこへ旅行したいですか？', sampleAnswer: "I'd love to visit New York and watch a baseball game.", sampleJapanese: 'ニューヨークを訪れて野球の試合を観たいです。' },
  { id: 'qr-d05', category: 'daily', english: 'What would you do if your flight was delayed?', japanese: '飛行機が遅れたらどうしますか？', sampleAnswer: "I'd check the updated schedule and contact the airline.", sampleJapanese: '最新の予定を確認し、航空会社に連絡します。' },
  { id: 'qr-d06', category: 'daily', english: 'Can you recommend a good place to eat?', japanese: 'おすすめの食事場所を教えてもらえますか？', sampleAnswer: 'There is a great sushi restaurant near the station.', sampleJapanese: '駅の近くにおいしいお寿司屋さんがあります。' },
  { id: 'qr-d07', category: 'daily', english: 'What do you like to do in your free time?', japanese: '暇な時間には何をするのが好きですか？', sampleAnswer: 'I enjoy watching baseball and spending time with my family.', sampleJapanese: '野球観戦と家族と過ごすことが好きです。' },
  { id: 'qr-d08', category: 'daily', english: 'How do you usually get to work?', japanese: '普段はどうやって通勤していますか？', sampleAnswer: 'I walk to work, and it takes about twenty minutes.', sampleJapanese: '徒歩で通勤しており、20分くらいかかります。' },
  { id: 'qr-d09', category: 'daily', english: 'What is your favorite season?', japanese: '一番好きな季節は何ですか？', sampleAnswer: 'I like winter because I enjoy snowboarding.', sampleJapanese: 'スノーボードが好きなので、冬が好きです。' },
  { id: 'qr-d10', category: 'daily', english: 'Could I get a black coffee to go?', japanese: 'ブラックコーヒーを持ち帰りでいただけますか？', sampleAnswer: 'Of course. What size would you like?', sampleJapanese: 'もちろんです。サイズはいかがしますか？' },
  { id: 'qr-d11', category: 'daily', english: 'What have you been watching lately?', japanese: '最近何を観ていますか？', sampleAnswer: "I've been watching baseball highlights on YouTube.", sampleJapanese: 'YouTubeで野球のハイライトを観ています。' },
  { id: 'qr-d12', category: 'daily', english: 'How do you relax after a busy day?', japanese: '忙しい一日の後、どうやってリラックスしますか？', sampleAnswer: 'I usually make coffee and relax at home.', sampleJapanese: '普段はコーヒーを淹れて家でくつろぎます。' },
];
