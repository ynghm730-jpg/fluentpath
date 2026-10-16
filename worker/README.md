# FluentPath AI Worker — 改善版（2026-10-16）

Cloudflare Workers Free と Google AI Studio の Free Tier を前提とした、個人用AI英文添削の中継処理です。

## セキュリティ・無料運用

- `GEMINI_API_KEY` と `AUTH_TOKEN` は **Cloudflare Secret** に登録する。GitHub・ソースコード・AIチャットへ貼らない。
- 許可モデルは `gemini-3.8-flash` と `gemini-3.5-flash-lite` のみ（実際の無料枠・モデルアクセスは Google AI Studio で確認）。
- GoogleへのAPIキー送信は `x-goog-api-key` ヘッダーを使い、URLにキーを埋め込まない。
- Bearerトークン認証なしの `/api/review` および `/api/models` は 401。
- CORS は GitHub Pages とローカル開発Originのみを許可。ただしCORS単体は認証ではない。
- Cloudflare Workers Rate Limiting APIを使い、1つの個人用Workerについて「同一Cloudflareロケーション内で1分に約5回」を制限。厳密な世界共通回数や日次上限ではない。
- Rate LimiterやSecretが設定されていない場合は、Geminiへリクエストせずエラーで停止（fail closed）。
- JSONリクエストの上限は8KB。英文は500文字以下。
- Free Tierを維持し、Google側で**Billingを有効化しない**こと。有料プロジェクトではモデルの無料対象表示だけでは請求を防げない。
- 無料Tierの入力はGoogleのサービス改善に使われる場合あり。業務機密は送信しない。

## 操作の順序

**重要：ダッシュボードのWebエディタへTypeScriptを直接貼り付けるのではなく、Wrangler CLIでデプロイする。**

1. 既存FluentPathの作業コピー／バックアップを作る。
2. このアーカイブのファイルを、同じ相対パスのファイルに上書きする。元の`src`や`worker`ディレクトリ全体を削除・置換しない。
3. Macのターミナルで、FluentPathプロジェクトの`worker`フォルダへ移動する。
4. `npx wrangler --version` を実行。Wrangler 4.36.0以上が必要。古い場合は `npx wrangler@latest ...` で実行する。
5. `npx wrangler login` でCloudflareにログイン。
6. `npx wrangler deploy` で `fluentpath-ai` を更新。この時点ではSecretsが未設定のためAI添削は動かない（意図的）。
7. ブラウザで `https://fluentpath-ai.y-n-g-h-m-730.workers.dev/api/health` → `{"status":"ok", ...}` を確認。
8. `https://fluentpath-ai.y-n-g-h-m-730.workers.dev/api/models` → **401** であることを確認（認証なし拒否）。
9. Cloudflare Dashboard → Compute → Workers & Pages → fluentpath-ai → Settings → Variables and Secrets に `AUTH_TOKEN` を **Secret** として追加。32文字以上、できれば`openssl rand -hex 32`で作成した64文字のランダムなトークンを利用。
10. 同じ場所で `GEMINI_API_KEY` を **Secret** として追加。Google AI Studioで取得済みのキー。なおこの時点までWorkerは不特定ユーザーからのAI呼び出しを拒否している。
11. ローカルで `npm run build` を実行し、GitHub Desktopから変更をCommit、Push。GitHub PagesのActionsが成功したことを確認。
12. PixelでFluentPathを開き、瞬間英作文 → 模範解答 → AI添削を押す。入力欄には **AUTH_TOKENだけ** を入力する（Gemini APIキーを入れない）。
13. 初回接続時に添削結果が出るか確認。

## 便利なコマンド

```sh
# FluentPathのworkerフォルダで実行
npx wrangler --version
npx wrangler login
npx wrangler deploy
```

`npx wrangler secret put AUTH_TOKEN` や `npx wrangler secret put GEMINI_API_KEY` でもSecretを追加できる。その際に表示されるSecretの値をチャット、スクリーンショット、Gitコミットに含めない。

## 注意・未検証

- このパッケージは提供された6ファイルをベースに修正したもので、FluentPathの**その他のプロジェクトファイルは受け取っていない**。Mac上の実プロジェクト全体に対するビルドは実行していない。
- Worker単体の型チェックと、モックで行った11テストは成功。Cloudflare本番・実際のGemini APIでの疎通は未検証。
- Rate Limiting APIのカウンターは地域単位かつ最終的には整合する方式。厳格な日次リクエスト数管理が必要なら、後からD1による日次カウンター等を追加する。
- Gemini 3.8 Flash がプロジェクトに許可されていなければ `worker/wrangler.toml` の `DEFAULT_MODEL` を `gemini-3.5-flash-lite` に変更したうえで再デプロイする。
