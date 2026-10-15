import type { QuickPrompt } from '../types';

export const INITIAL_PROMPTS: QuickPrompt[] = [
  // --- ビジネス・仕事編（15問）：会議即答、進捗、数字・期限、AI・半導体 ---
  {
    id: 'qp-biz-1',
    category: 'business',
    tags: ['会議', '意見', '仕事'],
    difficulty: 'B1',
    japanese: '私の考えでは、まずプロトタイプのテストに注力すべきです。',
    english: 'In my opinion, we should focus on testing the prototype first.',
    acceptableAnswers: [
      'In my view, we should focus on testing the prototype first.',
      'From my perspective, we should concentrate on testing the prototype first.',
      'I think we need to focus on testing the prototype first.'
    ],
    keyPoints: 'In my opinion / focus on ~ / prototype',
    notes: '会議で発言を切り出す定番フレーズ。"focus on + 動名詞/名詞" で「〜に注力する」。'
  },
  {
    id: 'qp-biz-2',
    category: 'business',
    tags: ['期限', '数字', '仕事'],
    difficulty: 'B1',
    japanese: '来週の金曜日までに、このプロジェクトを終わらせる必要があります。',
    english: 'We need to finish this project by next Friday.',
    acceptableAnswers: [
      'We must complete this project by next Friday.',
      'We have to wrap up this project by next Friday.'
    ],
    keyPoints: 'need to / by next Friday（期限のby）',
    notes: '期限を表す「〜までに」は "until" ではなく "by" を使います。'
  },
  {
    id: 'qp-biz-3',
    category: 'business',
    tags: ['進捗', '会議', '仕事'],
    difficulty: 'B1',
    japanese: '現在の進捗状況を簡単に教えていただけますか？',
    english: 'Could you give us a quick update on the current progress?',
    acceptableAnswers: [
      'Could you update us on the current status?',
      'Can you briefly share the current progress?',
      'Could you provide a quick update on where we stand?'
    ],
    keyPoints: 'Could you give us a quick update on ~',
    notes: '会議で進捗を尋ねるときの洗練された表現。「手短に」は "a quick update" が非常に自然です。'
  },
  {
    id: 'qp-biz-4',
    category: 'business',
    tags: ['AI', '仕事', '技術'],
    difficulty: 'B1',
    japanese: '私たちはワークフローを効率化するために生成AIツールを導入しています。',
    english: 'We are adopting generative AI tools to streamline our workflow.',
    acceptableAnswers: [
      'We are introducing generative AI tools to improve our workflow efficiency.',
      'We are using generative AI tools to make our workflow more efficient.'
    ],
    keyPoints: 'adopt / generative AI / streamline',
    notes: 'streamline は業務やプロセスを「効率化・合理化する」という意味でビジネスで頻出です。'
  },
  {
    id: 'qp-biz-5',
    category: 'business',
    tags: ['半導体', '数字', '仕事'],
    difficulty: 'B1',
    japanese: '半導体の世界的な需要は今年15%増加すると見込まれています。',
    english: 'Global demand for semiconductors is expected to increase by 15% this year.',
    acceptableAnswers: [
      'Worldwide demand for semiconductor chips is projected to grow by 15% this year.',
      'The global demand for chips is expected to rise by 15% this year.'
    ],
    keyPoints: 'demand for semiconductors / is expected to ~ / by 15%（差のby）',
    notes: '比率の増減「〜％増加する」の「〜％」の前には差を表す前置詞 "by" を添えます。'
  },
  {
    id: 'qp-biz-6',
    category: 'business',
    tags: ['会議', '即答', '仕事'],
    difficulty: 'B1',
    japanese: 'その点について、あなたのご意見に完全に賛成です。',
    english: 'I completely agree with your point on that.',
    acceptableAnswers: [
      'I totally agree with you on that point.',
      'I completely agree with what you just said.',
      'I am completely on the same page with you.'
    ],
    keyPoints: 'completely agree with ~ on ~',
    notes: '会議で即座に同意を示すフレーズ。"I agree" だけでなく "completely" や "on that point" を付け足すと説得力が増します。'
  },
  {
    id: 'qp-biz-7',
    category: 'business',
    tags: ['会議', '質問', '仕事'],
    difficulty: 'B1',
    japanese: '少し質問してもよろしいですか？',
    english: 'May I jump in with a quick question?',
    acceptableAnswers: [
      'Can I ask a quick question?',
      'May I interrupt and ask a question?',
      'Could I jump in for a second?'
    ],
    keyPoints: 'jump in / a quick question',
    notes: 'オンライン会議で会話を遮らず丁寧に割り込むときに "May I jump in?" はネイティブがよく使います。'
  },
  {
    id: 'qp-biz-8',
    category: 'business',
    tags: ['数字', '納期', '仕事'],
    difficulty: 'B1',
    japanese: '納期をさらに2週間延期することは可能ですか？',
    english: 'Is it possible to extend the deadline by another two weeks?',
    acceptableAnswers: [
      'Could we push back the deadline by two weeks?',
      'Can we extend the delivery date by another two weeks?'
    ],
    keyPoints: 'extend the deadline / by another two weeks',
    notes: '「さらに〜週間延ばす」は "by another [number] weeks" と言います。push back もよく使われます。'
  },
  {
    id: 'qp-biz-9',
    category: 'business',
    tags: ['提案', '会議', '仕事'],
    difficulty: 'B1',
    japanese: '最終決定を下す前に、データを再確認することを提案します。',
    english: 'I suggest reviewing the data again before making a final decision.',
    acceptableAnswers: [
      'I recommend that we double-check the data before making the final decision.',
      'I suggest we review the numbers once more before we decide.'
    ],
    keyPoints: 'suggest + -ing / make a final decision',
    notes: 'suggest の後ろは動名詞 -ing または (that) we should 動詞原形 をとります。'
  },
  {
    id: 'qp-biz-10',
    category: 'business',
    tags: ['半導体', 'サプライチェーン', '仕事'],
    difficulty: 'B1',
    japanese: '私たちは新しい半導体チップのサプライチェーンを確保しなければなりません。',
    english: 'We have to secure the supply chain for the new semiconductor chips.',
    acceptableAnswers: [
      'We need to secure a supply chain for the new chips.',
      'We must ensure a stable supply chain for our new semiconductors.'
    ],
    keyPoints: 'secure / supply chain / semiconductor chips',
    notes: 'secure は「確保する、確固たるものにする」というビジネスで極めて頼りになる動詞です。'
  },
  {
    id: 'qp-biz-11',
    category: 'business',
    tags: ['会議', '確認', '仕事'],
    difficulty: 'B1',
    japanese: '誤解のないよう確認させてください。予算は3万ドルということですね？',
    english: 'Just to clarify, you mean the budget is thirty thousand dollars, right?',
    acceptableAnswers: [
      'Just to make sure, the budget is $30,000, correct?',
      'Let me clarify, is the budget set at thirty thousand dollars?'
    ],
    keyPoints: 'Just to clarify / budget / thirty thousand dollars',
    notes: '聞き取りにくい数字や前提を確認する "Just to clarify"（念のため確認ですが）。'
  },
  {
    id: 'qp-biz-12',
    category: 'business',
    tags: ['トラブル', '仕事'],
    difficulty: 'B1',
    japanese: '予期せぬ技術的な問題のため、若干の遅れが生じています。',
    english: 'We are experiencing a slight delay due to unexpected technical issues.',
    acceptableAnswers: [
      'There is a minor delay because of an unexpected technical problem.',
      'We have a slight delay due to unforeseen technical difficulties.'
    ],
    keyPoints: 'experience a slight delay / due to ~',
    notes: 'delay を名詞として扱い "experience a delay" と言うとビジネスに相応しい落ち着いたトーンになります。'
  },
  {
    id: 'qp-biz-13',
    category: 'business',
    tags: ['AI', '会議', '仕事'],
    difficulty: 'B1',
    japanese: 'AIモデルの精度は過去6ヶ月で大幅に向上しました。',
    english: 'The accuracy of the AI model has improved significantly over the past six months.',
    acceptableAnswers: [
      'The AI model accuracy has improved greatly in the last six months.',
      'Our AI model has become significantly more accurate over the last six months.'
    ],
    keyPoints: 'accuracy / improve significantly / over the past six months',
    notes: '「過去〜ヶ月で」は "over the past six months"。significantly（大幅に）も必須副詞です。'
  },
  {
    id: 'qp-biz-14',
    category: 'business',
    tags: ['会議', 'まとめ', '仕事'],
    difficulty: 'B1',
    japanese: '今日の会議の主な決定事項をまとめさせてください。',
    english: 'Let me summarize the main takeaways from today’s meeting.',
    acceptableAnswers: [
      'Let me wrap up the key points of today\'s meeting.',
      'Allow me to summarize the main action items from this meeting.'
    ],
    keyPoints: 'summarize / main takeaways / today\'s meeting',
    notes: 'takeaway は「会議で得られた要点・学んだこと」を表す非常に自然なビジネス英語です。'
  },
  {
    id: 'qp-biz-15',
    category: 'business',
    tags: ['フォローアップ', '仕事'],
    difficulty: 'B1',
    japanese: '今日の午後3時半までに、修正した資料をメールでお送りします。',
    english: 'I will email you the revised slides by 3:30 PM today.',
    acceptableAnswers: [
      'I\'ll send you the revised materials by three thirty this afternoon.',
      'I will send over the updated presentation by 3:30 this afternoon.'
    ],
    keyPoints: 'email you the revised slides / by 3:30 PM',
    notes: 'email は「〜にメールする」という動詞として使えます。時刻の期限は "by [time]" です。'
  },

  // --- 日常・趣味編（15問）：旅行、野球、コーヒー、空港・ホテル ---
  {
    id: 'qp-day-1',
    category: 'daily',
    tags: ['コーヒー', '日常', 'カフェ'],
    difficulty: 'B1',
    japanese: 'アイスラテをオーツミルクで、持ち帰りでお願いします。',
    english: 'Can I get an iced latte with oat milk to go, please?',
    acceptableAnswers: [
      'I\'d like an iced latte with oat milk to go, please.',
      'Could I have an iced latte with oat milk for takeout?'
    ],
    keyPoints: 'Can I get ~ / with oat milk / to go',
    notes: 'アメリカのカフェでの最も自然な注文表現。"to go" は「持ち帰り」、"for here" は「店内」。'
  },
  {
    id: 'qp-day-2',
    category: 'daily',
    tags: ['旅行', '空港', '日常'],
    difficulty: 'B1',
    japanese: 'サンフランシスコ行きの乗り継ぎ便のゲートはどこですか？',
    english: 'Where is the gate for my connecting flight to San Francisco?',
    acceptableAnswers: [
      'Which gate is for the connection flight to San Francisco?',
      'Could you tell me where the gate for the flight to San Francisco is?'
    ],
    keyPoints: 'gate / connecting flight to ~',
    notes: '海外旅行の空港で必須。「乗り継ぎ便」は "connecting flight" と言います。'
  },
  {
    id: 'qp-day-3',
    category: 'daily',
    tags: ['野球', '日常', 'スポーツ'],
    difficulty: 'B1',
    japanese: '昨日の大谷選手の試合をテレビで見ましたか？',
    english: 'Did you catch Ohtani\'s game on TV yesterday?',
    acceptableAnswers: [
      'Did you watch Ohtani\'s game on television yesterday?',
      'Did you see the baseball game with Ohtani yesterday?'
    ],
    keyPoints: 'catch ~ on TV / game',
    notes: 'カジュアルに「試合見た？」と聞くときは "catch the game" がよく使われます。'
  },
  {
    id: 'qp-day-4',
    category: 'daily',
    tags: ['旅行', 'ホテル', '日常'],
    difficulty: 'B1',
    japanese: 'チェックイン前に荷物を預かっていただくことはできますか？',
    english: 'Could you hold my luggage before check-in?',
    acceptableAnswers: [
      'Can I leave my bags here before check-in?',
      'Could you keep my luggage until check-in time?'
    ],
    keyPoints: 'hold my luggage / before check-in',
    notes: '荷物は不可算名詞（luggage / baggage）。「預かる」は "hold" や "keep" で伝わります。'
  },
  {
    id: 'qp-day-5',
    category: 'daily',
    tags: ['コーヒー', '日常'],
    difficulty: 'B1',
    japanese: 'このカフェは自家焙煎の浅煎り豆を扱っています。',
    english: 'This café serves in-house roasted light roast beans.',
    acceptableAnswers: [
      'This coffee shop roasts their own light roast beans.',
      'This café offers freshly roasted light roast coffee beans.'
    ],
    keyPoints: 'in-house roasted / light roast beans',
    notes: 'コーヒー好きの英会話に。「浅煎り」は "light roast"、「深煎り」は "dark roast" です。'
  },
  {
    id: 'qp-day-6',
    category: 'daily',
    tags: ['野球', '日常', 'スポーツ'],
    difficulty: 'B1',
    japanese: 'そのチームは9回裏に逆転ホームランを打ちました。',
    english: 'The team hit a walk-off home run in the bottom of the ninth.',
    acceptableAnswers: [
      'They hit a game-ending home run in the bottom of the ninth inning.',
      'The team scored a walk-off homer in the bottom of the 9th.'
    ],
    keyPoints: 'walk-off home run / bottom of the ninth',
    notes: 'サヨナラホームランは英語で "walk-off home run"。9回裏は "bottom of the ninth (inning)"。'
  },
  {
    id: 'qp-day-7',
    category: 'daily',
    tags: ['旅行', '道案内', '日常'],
    difficulty: 'B1',
    japanese: '一番近い地下鉄の駅まで歩いてどれくらいかかりますか？',
    english: 'How long does it take to walk to the nearest subway station?',
    acceptableAnswers: [
      'How far is it to walk to the closest subway station?',
      'How many minutes does it take to get to the nearest subway station on foot?'
    ],
    keyPoints: 'How long does it take to ~ / nearest subway station',
    notes: '旅行中の移動時間の質問。「〜するのにどれくらい時間がかかる？」は "How long does it take to ~?"'
  },
  {
    id: 'qp-day-8',
    category: 'daily',
    tags: ['日常', '雑談'],
    difficulty: 'B1',
    japanese: '今週末は何をする予定ですか？',
    english: 'What are you planning to do this weekend?',
    acceptableAnswers: [
      'What are your plans for this weekend?',
      'Do you have any plans for the weekend?',
      'What are you up to this weekend?'
    ],
    keyPoints: 'What are you planning to do ~ / this weekend',
    notes: 'スモールトークの鉄板。"What are you up to this weekend?" もこなれた表現です。'
  },
  {
    id: 'qp-day-9',
    category: 'daily',
    tags: ['レストラン', '日常'],
    difficulty: 'B1',
    japanese: 'お会計を別々にしていただくことはできますか？',
    english: 'Could we split the bill, please?',
    acceptableAnswers: [
      'Can we get separate checks, please?',
      'Could you split the check for us?'
    ],
    keyPoints: 'split the bill / separate checks',
    notes: 'アメリカでは "separate checks"（別々の伝票）または "split the bill" と頼むのが一般的です。'
  },
  {
    id: 'qp-day-10',
    category: 'daily',
    tags: ['旅行', 'ホテル', '日常'],
    difficulty: 'B1',
    japanese: '部屋のWi-Fiパスワードを教えていただけますか？',
    english: 'Could you give me the Wi-Fi password for the room?',
    acceptableAnswers: [
      'What is the Wi-Fi password for this room?',
      'Can I have the Wi-Fi password, please?'
    ],
    keyPoints: 'Wi-Fi password for ~',
    notes: '海外のホテルやカフェで誰もが一番最初に使う定番フレーズ。'
  },
  {
    id: 'qp-day-11',
    category: 'daily',
    tags: ['コーヒー', '日常'],
    difficulty: 'B1',
    japanese: '午後2時以降はカフェインを控えるようにしています。',
    english: 'I try to avoid caffeine after 2:00 PM.',
    acceptableAnswers: [
      'I try not to have caffeine after two in the afternoon.',
      'I stay away from caffeine after 2 PM.'
    ],
    keyPoints: 'try to avoid / caffeine / after 2:00 PM',
    notes: 'コーヒーのこだわりや健康習慣を英語で話すときに役立つ自然な表現。'
  },
  {
    id: 'qp-day-12',
    category: 'daily',
    tags: ['野球', '日常', 'スポーツ'],
    difficulty: 'B1',
    japanese: 'スタジアムの生ビールとホットドッグの組み合わせは最高です。',
    english: 'Nothing beats draft beer and a hot dog at the ballpark.',
    acceptableAnswers: [
      'Draft beer and hot dogs at the stadium are the best.',
      'There is nothing better than cold beer and a hot dog at the ballpark.'
    ],
    keyPoints: 'Nothing beats ~ / draft beer / ballpark',
    notes: '「〜に勝るものはない（最高だ）」を英語では "Nothing beats ~" と言います。野球場は "ballpark"。'
  },
  {
    id: 'qp-day-13',
    category: 'daily',
    tags: ['旅行', 'ショッピング', '日常'],
    difficulty: 'B1',
    japanese: 'これの色違いや別のサイズはありますか？',
    english: 'Do you have this in a different color or size?',
    acceptableAnswers: [
      'Do you have this in other colors or sizes?',
      'Does this come in any other colors or sizes?'
    ],
    keyPoints: 'in a different color or size',
    notes: '旅行中の買い物で必須。"in [color/size]" で「〜色/〜サイズで」。'
  },
  {
    id: 'qp-day-14',
    category: 'daily',
    tags: ['日常', '体調・感情'],
    difficulty: 'B1',
    japanese: '長いフライトの後なので、今夜はゆっくり休みたいです。',
    english: 'I want to take it easy tonight after the long flight.',
    acceptableAnswers: [
      'I\'d like to relax tonight since it was a long flight.',
      'I\'m going to rest tonight after such a long flight.'
    ],
    keyPoints: 'take it easy / after the long flight',
    notes: '「無理せずのんびりする」は "take it easy" がぴったりです。'
  },
  {
    id: 'qp-day-15',
    category: 'daily',
    tags: ['旅行', '写真', '日常'],
    difficulty: 'B1',
    japanese: 'この景色を背景に、私たちの写真を1枚撮っていただけますか？',
    english: 'Could you take a picture of us with this view in the background?',
    acceptableAnswers: [
      'Could you take our photo with this view behind us?',
      'Would you mind taking a picture of us with this scenery?'
    ],
    keyPoints: 'take a picture of us / in the background',
    notes: '旅先で人に写真を頼むときの最も親切で失礼のない定番表現。'
  }
];
