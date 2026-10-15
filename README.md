# FluentPath (フルエントパス) 🧭
**英語会議で即答するための15分自習Webアプリ**

FluentPathは、英語会議での瞬発力向上、VERSANT 60達成、海外旅行での自然な英会話を目指す学習者のために設計された無料のスピーキング特化型Webアプリです。

---

## 🌟 主な特徴（開発費・運用費0円）

1. **AI API不要・完全無料**
   - 外部有料サーバーや課金APIを一切使わず、ブラウザ標準のWeb Speech APIとIndexedDBを活用して端末内で完結動作します。
2. **今日の15分学習ルーティン**
   - Step 1: 瞬間英作文 5分（会議で即答するクイックアウトプット）
   - Step 2: リピート練習 5分（9〜15語の文構造＆数字・期限の聞き取り）
   - Step 3: フレーズ復習 5分（ストックした重要表現の定着）
3. **厳選された初期問題（計60問）**
   - ビジネス50%（会議即答、納期・進捗、数字・期限、AI・半導体）
   - 日常50%（海外旅行、空港・ホテル、野球、コーヒー、カフェ）
   - すべてアメリカ英語（en-US）模範音声＆日本語訳・解説付き
4. **学習者に寄り添う採点・判定**
   - 固定模範解答と一致しないだけで不正解と断定しません。
   - 語彙の一致率を参考表示しつつ、学習者自身が「言えた / 惜しかった / 要復習」を自己評価してIndexedDBに記録。
5. **フレーズ帳 ＆ CSVインポート・エクスポート**
   - 気に入った表現や間違えた問題をワンタップでフレーズ帳にストック。
   - Excelやスプレッドシートで管理できるCSV形式でいつでもバックアップ・復元が可能。
6. **スマホ優先デザイン（Pixel 8 Pro対応）**
   - 片手で親指操作できるボトムナビゲーション。
   - 清潔感のある青・白基調のUI。
7. **拡張性**
   - GitHub Pagesで無料公開可能（`base: './'`設定済み）。
   - PWA対応マニフェスト（`manifest.json`）を同梱（ホーム画面に追加可能）。
   - 将来的にGoogle AI Studioの無料Gemini APIキーを設定して添削機能を拡張できる構造。

---

## 🚀 起動方法（ローカル環境）

### 1. 依存パッケージのインストール（初回のみ）
```bash
npm install
```

### 2. 開発サーバーの起動
```bash
npm run dev
```

起動後、ターミナルに表示されるURLにブラウザ（Chrome推奨）でアクセスしてください：
- **パソコンから**: [http://localhost:5173/](http://localhost:5173/)
- **Pixel 8 Proなどのスマホから**: 同じWi-Fiに接続した状態で、ターミナルに表示される `Network: http://192.168.x.x:5173/fluentpath/` にスマホのChromeでアクセス

### 3. 本番用ビルド（正常確認済み）
```bash
npm run build
```

---

## 🌐 GitHub Pagesで無料公開する手順（GitHub Desktop対応）

本アプリには自動ビルド・デプロイ用のワークフロー（`.github/workflows/deploy.yml`）が設定されているため、GitHubにプッシュするだけで自動公開されます。

### GitHub Desktopでの操作手順:
1. **GitHub Desktop** を開き、メニューの **File** > **Add Local Repository...** を選択します。
2. フォルダ選択で `/Users/nagahamayuu/Documents/fluentpath` を選び、**Add Repository** をクリックします。
3. 左下にコミットメッセージ（例: `Initial release of FluentPath`）を入力し、**Commit to main** をクリックします。
4. 上部に表示される **Publish repository** をクリックします。
   * **Name**: `fluentpath`（※小文字）
   * **Keep this code private**: チェックを外す（無料版GitHubアカウントでGitHub Pagesを利用する場合は公開リポジトリにします）
   * **Publish repository** ボタンをクリックします。
5. ブラウザで GitHub のリポジトリページを開き、**Settings** > **Pages** に移動します。
6. **Build and deployment** の **Source** で **「GitHub Actions」** を選択します。
7. 自動的にビルド・デプロイが開始され、数分で `https://<あなたのGitHubユーザー名>.github.io/fluentpath/` で無料公開されます！

---

## 📲 スマートフォン（Pixel 8 Pro）でのPWAインストール手順

公開されたURL（またはローカルURL）をPixel 8 ProのChromeで開くと、ネイティブアプリとしてインストールできます：
1. **Chrome右上のメニュー（︙）**をタップします。
2. **「ホーム画面に追加」** または **「アプリをインストール」** をタップします（画面上部のヘッダーに「追加」ボタンが表示される場合もあります）。
3. インストールが完了すると、スマートフォンのホーム画面に **FluentPathのコンパスアイコン🧭** が追加され、全画面で起動できるようになります。

---

## 📱 スマートフォンでのマイク・音声設定について

- **音声読み上げ（en-US）**:
  ブラウザ標準の音声合成（SpeechSynthesis）を使用しています。右上のスピーカーアイコンをタップすると音声をテストできます。
- **音声認識（マイク）**:
  マイクボタンを押すと、ブラウザから「マイクへのアクセス許可」が求められます。「許可」を選択してください。
  ※マイクが使えない静かな場所や非対応環境でも、テキスト入力や自己評価ボタンのみで完全に学習できます。

---

## 📂 プロジェクト構成

```
fluentpath/
├── index.html                 # アプリのHTML（スマホ最適化、PWAタグ）
├── package.json               # パッケージ構成定義
├── vite.config.ts             # Vite設定（相対パス・ネットワーク公開）
├── tailwind.config.js         # Tailwind CSSデザイン設定
├── public/
│   └── manifest.json          # PWA用Webアプリマニフェスト
└── src/
    ├── types/                 # TypeScript型定義
    ├── data/                  # 初期問題データ（計60問）
    │   ├── initialPrompts.ts          # 瞬間英作文 30問
    │   └── initialRepeatSentences.ts  # リピート 30問（9〜15語）
    ├── services/              # コア機能
    │   ├── db.ts              # IndexedDB（Dexie.js）ストレージ
    │   └── speech.ts          # Web Speech API & 類似度判定
    ├── utils/                 # ユーティリティ
    │   └── csv.ts             # CSVインポート・エクスポート
    ├── components/            # UIコンポーネント
    │   ├── Header.tsx         # ヘッダー（ストリーク・音声テスト）
    │   ├── BottomNav.tsx      # 下部ナビゲーション
    │   ├── HomeView.tsx       # ホーム（15分ルーティン）
    │   ├── QuickPromptView.tsx# 瞬間英作文（5/10秒タイマー）
    │   ├── RepeatView.tsx     # リピート（ブラインド練習）
    │   ├── PhrasebookView.tsx # フレーズ帳（タグ・検索・CSV）
    │   ├── StatsDataView.tsx  # 履歴・苦手問題・設定
    │   └── Toast.tsx          # 通知トースト
    ├── App.tsx                # ルートコンポーネント
    ├── main.tsx               # エントリーポイント
    └── index.css              # Tailwindスタイル・セーフエリア
```
