import type { RepeatSentence } from '../types';

export const INITIAL_REPEAT_SENTENCES: RepeatSentence[] = [
  // --- ビジネス・仕事編（15問：9〜15語） ---
  {
    id: 'rs-biz-1',
    category: 'business',
    tags: ['仕事', '数字', '予算'],
    wordCount: 14,
    english: 'We need to finalize the quarterly budget report before the end of this month.',
    japanese: '今月末までに、四半期予算レポートを最終確定する必要があります。',
    audioTip: 'finalize / quarterly budget / before the end of this month のリズムに注目'
  },
  {
    id: 'rs-biz-2',
    category: 'business',
    tags: ['AI', '仕事', '技術'],
    wordCount: 13,
    english: 'The team will deploy the latest AI algorithm to improve real-time prediction accuracy.',
    japanese: 'チームはリアルタイムの予測精度を向上させるため、最新のAIアルゴリズムを導入します。',
    audioTip: 'deploy / prediction accuracy の発音に注意'
  },
  {
    id: 'rs-biz-3',
    category: 'business',
    tags: ['半導体', '数字', '仕事'],
    wordCount: 12,
    english: 'Our semiconductor fabrication facility has increased its monthly output by twenty-five percent.',
    japanese: '当社の半導体製造工場は、月間生産量を25パーセント増加させました。',
    audioTip: 'semiconductor / fabrication facility / twenty-five percent の数字の聞き取り'
  },
  {
    id: 'rs-biz-4',
    category: 'business',
    tags: ['期限', '数字', '仕事'],
    wordCount: 13,
    english: 'Could you please send me the updated meeting minutes by five o\'clock today?',
    japanese: '本日5時までに、更新された議事録を私に送っていただけますか？',
    audioTip: 'updated meeting minutes / by five o\'clock の期限表現'
  },
  {
    id: 'rs-biz-5',
    category: 'business',
    tags: ['仕事', '会議', '進捗'],
    wordCount: 13,
    english: 'I will follow up with the engineering team regarding the recent system integration.',
    japanese: '最近のシステム統合に関して、エンジニアリングチームに進捗確認を行います。',
    audioTip: 'follow up with / regarding the ~'
  },
  {
    id: 'rs-biz-6',
    category: 'business',
    tags: ['納期', '期限', '仕事'],
    wordCount: 13,
    english: 'The project deadline has been postponed until the second week of next quarter.',
    japanese: 'プロジェクトの締め切りは、次の四半期の第2週まで延期されました。',
    audioTip: 'has been postponed / the second week of next quarter の聞き取り'
  },
  {
    id: 'rs-biz-7',
    category: 'business',
    tags: ['半導体', '仕事', '品質'],
    wordCount: 12,
    english: 'She emphasized that consistent quality control is essential for advanced microchip production.',
    japanese: '彼女は、先端マイクロチップの製造には一貫した品質管理が不可欠であると強調しました。',
    audioTip: 'consistent quality control / microchip production'
  },
  {
    id: 'rs-biz-8',
    category: 'business',
    tags: ['会議', '仕事'],
    wordCount: 12,
    english: 'We should schedule a follow-up discussion to address the remaining security concerns.',
    japanese: '残されたセキュリティ上の懸念に対処するため、追加の協議を設定すべきです。',
    audioTip: 'address the remaining concerns の連語'
  },
  {
    id: 'rs-biz-9',
    category: 'business',
    tags: ['AI', '仕事', '製品'],
    wordCount: 12,
    english: 'The new software update will automatically reduce power consumption on mobile devices.',
    japanese: '新しいソフトウェア更新により、モバイル機器の消費電力が自動的に削減されます。',
    audioTip: 'power consumption on mobile devices'
  },
  {
    id: 'rs-biz-10',
    category: 'business',
    tags: ['会議', '数字', '仕事'],
    wordCount: 12,
    english: 'Can we arrange a fifteen-minute conference call to clarify the contract terms?',
    japanese: '契約条件を明確にするために、15分間の電話会議を設定できますか？',
    audioTip: 'fifteen-minute conference call / clarify the contract terms'
  },
  {
    id: 'rs-biz-11',
    category: 'business',
    tags: ['半導体', '仕事'],
    wordCount: 13,
    english: 'He pointed out that the global chip shortage might persist through next year.',
    japanese: '彼は世界的な半導体不足が来年まで続く可能性があると指摘しました。',
    audioTip: 'global chip shortage / persist through next year'
  },
  {
    id: 'rs-biz-12',
    category: 'business',
    tags: ['数字', '仕事', '確認'],
    wordCount: 12,
    english: 'Please verify all the statistical figures before submitting the proposal to management.',
    japanese: '経営陣に提案書を提出する前に、すべての統計数値を検証してください。',
    audioTip: 'verify all the statistical figures'
  },
  {
    id: 'rs-biz-13',
    category: 'business',
    tags: ['AI', '仕事', '進捗'],
    wordCount: 12,
    english: 'Our primary objective this quarter is to accelerate the automated testing pipeline.',
    japanese: '今期の私たちの最優先目標は、自動テストパイプラインの高速化です。',
    audioTip: 'primary objective / automated testing pipeline'
  },
  {
    id: 'rs-biz-14',
    category: 'business',
    tags: ['数字', '仕事'],
    wordCount: 13,
    english: 'We noticed a minor discrepancy between the financial forecast and the actual revenue.',
    japanese: '財務予測と実際の収益の間に、軽微な食い違いがあることに気づきました。',
    audioTip: 'minor discrepancy / financial forecast / actual revenue'
  },
  {
    id: 'rs-biz-15',
    category: 'business',
    tags: ['会議', '意思決定', '仕事'],
    wordCount: 12,
    english: 'Let us make sure everyone agrees with the timeline before proceeding further.',
    japanese: 'これ以上先に進む前に、全員がタイムラインに合意していることを確認しましょう。',
    audioTip: 'agrees with the timeline / proceeding further'
  },

  // --- 日常・趣味編（15問：9〜15語） ---
  {
    id: 'rs-day-1',
    category: 'daily',
    tags: ['コーヒー', '日常'],
    wordCount: 12,
    english: 'I usually grab a fresh pour-over coffee before heading to the office.',
    japanese: '私は普段、オフィスに向かう前に淹れたてのハンドドリップコーヒーを買います。',
    audioTip: 'pour-over coffee / heading to the office'
  },
  {
    id: 'rs-day-2',
    category: 'daily',
    tags: ['旅行', '数字', '空港'],
    wordCount: 12,
    english: 'The flight was delayed for two hours because of severe thunder storms.',
    japanese: '激しい雷雨のため、飛行機は2時間遅延しました。',
    audioTip: 'delayed for two hours / severe thunder storms'
  },
  {
    id: 'rs-day-3',
    category: 'daily',
    tags: ['旅行', '交通'],
    wordCount: 13,
    english: 'Could you tell me which platform the express train to Kyoto departs from?',
    japanese: '京都行きの特急列車が何番線から発車するか教えていただけますか？',
    audioTip: 'which platform / express train / departs from'
  },
  {
    id: 'rs-day-4',
    category: 'daily',
    tags: ['野球', '日常', 'スポーツ'],
    wordCount: 12,
    english: 'He bought two front-row tickets to watch the Dodgers game this Saturday.',
    japanese: '彼は今週の土曜日のドジャース戦を見るために、最前列のチケットを2枚買いました。',
    audioTip: 'front-row tickets / Dodgers game'
  },
  {
    id: 'rs-day-5',
    category: 'daily',
    tags: ['旅行', 'ホテル'],
    wordCount: 13,
    english: 'This boutique hotel provides complimentary breakfast and high-speed wireless internet in every room.',
    japanese: 'このブティックホテルは全室で無料の朝食と高速Wi-Fiを提供しています。',
    audioTip: 'complimentary breakfast（無料の朝食）'
  },
  {
    id: 'rs-day-6',
    category: 'daily',
    tags: ['旅行', '観光'],
    wordCount: 13,
    english: 'I decided to explore the historic neighborhood on foot with a local guide.',
    japanese: '私は現地のガイドと一緒に、歴史ある街並みを歩いて散策することにしました。',
    audioTip: 'explore the historic neighborhood / on foot'
  },
  {
    id: 'rs-day-7',
    category: 'daily',
    tags: ['コーヒー', '日常'],
    wordCount: 12,
    english: 'The barista recommended their signature cold brew made with single-origin Ethiopian beans.',
    japanese: 'バリスタはエチオピア産シングルオリジン豆で作った名物コールドブリューを勧めてくれました。',
    audioTip: 'signature cold brew / single-origin Ethiopian beans'
  },
  {
    id: 'rs-day-8',
    category: 'daily',
    tags: ['野球', '日常', 'スポーツ'],
    wordCount: 13,
    english: 'They hit three consecutive home runs to win the championship game last night.',
    japanese: '彼らは昨晩、3者連続ホームランを放ち決勝戦に勝利しました。',
    audioTip: 'three consecutive home runs / championship game'
  },
  {
    id: 'rs-day-9',
    category: 'daily',
    tags: ['旅行', '飛行機'],
    wordCount: 12,
    english: 'Please make sure your seatbelt is securely fastened during takeoff and landing.',
    japanese: '離陸時および着陸時は、シートベルトをしっかりとお締めください。',
    audioTip: 'securely fastened / takeoff and landing'
  },
  {
    id: 'rs-day-10',
    category: 'daily',
    tags: ['旅行', '日常'],
    wordCount: 13,
    english: 'We are planning to rent an electric car for our trip next summer.',
    japanese: '私たちは来年の夏の旅行のために、電気自動車をレンタルする予定です。',
    audioTip: 'rent an electric car / for our trip'
  },
  {
    id: 'rs-day-11',
    category: 'daily',
    tags: ['旅行', '数字'],
    wordCount: 13,
    english: 'The museum admission fee is twenty dollars for adults and free for children.',
    japanese: '美術館の入場料は大人が20ドル、子供は無料です。',
    audioTip: 'admission fee / twenty dollars for adults'
  },
  {
    id: 'rs-day-12',
    category: 'daily',
    tags: ['コーヒー', '日常'],
    wordCount: 13,
    english: 'I prefer drinking dark roast coffee with a splash of warm oat milk.',
    japanese: '私は少量の温かいオーツミルクを入れた深煎りコーヒーを飲むのが好きです。',
    audioTip: 'a splash of warm oat milk（少量の〜）'
  },
  {
    id: 'rs-day-13',
    category: 'daily',
    tags: ['旅行', 'レストラン', '数字'],
    wordCount: 13,
    english: 'Can you recommend a nice seafood restaurant that is open past nine PM?',
    japanese: '午後9時以降も営業しているおすすめの美味しい海鮮レストランはありますか？',
    audioTip: 'nice seafood restaurant / open past nine PM'
  },
  {
    id: 'rs-day-14',
    category: 'daily',
    tags: ['野球', '日常', 'スポーツ'],
    wordCount: 13,
    english: 'The baseball stadium was packed with thousands of energetic fans wearing team jerseys.',
    japanese: '野球場はチームのユニフォームを着た何千人もの熱狂的なファンで満杯でした。',
    audioTip: 'packed with / thousands of energetic fans'
  },
  {
    id: 'rs-day-15',
    category: 'daily',
    tags: ['旅行', '空港'],
    wordCount: 13,
    english: 'You must show your passport and boarding pass before entering the security checkpoint.',
    japanese: '保安検査場に入る前に、パスポートと搭乗券を提示しなければなりません。',
    audioTip: 'passport and boarding pass / security checkpoint'
  }
];
