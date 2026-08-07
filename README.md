# note 自動投稿システム

GitHub Actions が毎日定時に起動し、Claude API で記事を生成、Playwright で note.com に自動投稿します。

## 仕組み

```
cron (GitHub Actions, 毎朝9時JST)
  → src/generate.js : topics.txt の先頭テーマで Claude が記事生成 → article.json
  → src/post.js     : Playwright が note にログイン → エディタに入力 → 下書き/公開
```

## セットアップ

1. このフォルダを GitHub リポジトリとして push(**Privateリポジトリ推奨**)
2. リポジトリの Settings → Secrets and variables → Actions に以下を登録
   - `ANTHROPIC_API_KEY` : Claude の API キー
   - `NOTE_EMAIL` : note のログインメールアドレス
   - `NOTE_PASSWORD` : note のパスワード
3. `topics.txt` に書きたいテーマを1行1つで追加(上から順に消費されます)
4. Actions タブ → "Auto post to note" → Run workflow で手動テスト
   - `publish: false`(デフォルト)だと**下書き保存**なので、まずこれで動作確認
   - 問題なければ `publish: true` で公開、または post.yml の `PUBLISH` を変更

## ローカルでのテスト

```bash
npm install
npx playwright install chromium
export ANTHROPIC_API_KEY=sk-ant-...
export NOTE_EMAIL=you@example.com
export NOTE_PASSWORD=...
export DEBUG=true        # スクショを保存
node src/generate.js
node src/post.js         # PUBLISH=true を付けると公開
```

## 重要な注意点

- **noteには公式の投稿APIがない**ため、ブラウザ自動操作(Playwright)で実現しています。noteの利用規約で自動化が制限されている可能性があるので、自己責任で・低頻度(1日1回程度)での運用を推奨します。
- **UIの変更でセレクタが壊れることがあります**。失敗時は Actions の Artifacts に `debug-*.png` が保存されるので、それを見て `src/post.js` のセレクタを修正してください。
- **2段階認証やreCAPTCHAが出るとログインに失敗します**。その場合はローカルで一度 `headless: false` にして手動ログインし、生成された `state.json`(セッション)を GitHub Secrets 経由で渡す方式に切り替えるのが確実です。
- 最初は必ず `publish: false`(下書き)で数回試し、内容を目視確認してから公開運用に移ることを強くおすすめします。AI生成記事をnoteで公開する場合、その旨を明記するのがマナー的にも安全です。

## カスタマイズ

- 投稿時刻: `.github/workflows/post.yml` の cron を変更(UTC表記なのでJST-9時間)
- 記事の文体・長さ: `src/generate.js` の system プロンプトを編集
- GAS連携したい場合: GAS から `workflow_dispatch` の API を叩けば、スプレッドシートのネタ帳をトリガーにすることも可能です
