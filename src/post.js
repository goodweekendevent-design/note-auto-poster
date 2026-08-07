// src/post.js
// Playwright で note.com にログインし、article.json の記事を投稿する
// 必要な環境変数:
//   NOTE_EMAIL, NOTE_PASSWORD  … noteのログイン情報
//   PUBLISH=true               … 付けると公開。付けなければ下書き保存
//
// 注意: noteのUIは変わることがあるので、セレクタが壊れたら
// DEBUG=true で実行してスクショ(debug-*.png)を見ながら直してください。

import { chromium } from "playwright";
import fs from "fs";

const EMAIL = process.env.NOTE_EMAIL;
const PASSWORD = process.env.NOTE_PASSWORD;
const PUBLISH = process.env.PUBLISH === "true";
const DEBUG = process.env.DEBUG === "true";

if (!EMAIL || !PASSWORD) {
  console.error("NOTE_EMAIL / NOTE_PASSWORD が設定されていません");
  process.exit(1);
}

const article = JSON.parse(fs.readFileSync("article.json", "utf8"));

async function shot(page, name) {
  if (DEBUG) await page.screenshot({ path: `debug-${name}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    locale: "ja-JP",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    storageState: fs.existsSync("state.json") ? "state.json" : undefined,
  });
  const page = await context.newPage();

  try {
    // ── 1. ログイン(セッションが生きていればスキップされる) ──
    await page.goto("https://note.com/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    if (page.url().includes("/login")) {
      console.log("ログイン処理を実行...");
      await page.fill('input[type="email"], #email', EMAIL);
      await page.fill('input[type="password"], #password', PASSWORD);
      await shot(page, "login-filled");
      await page.click('button:has-text("ログイン")');
      await page.waitForURL((url) => !url.href.includes("/login"), {
        timeout: 30000,
      });
      console.log("ログイン成功");
    } else {
      console.log("既存セッションでログイン済み");
    }

    // セッションを保存(次回以降のログイン省略用)
    await context.storageState({ path: "state.json" });

    // ── 2. 新規記事エディタを開く ──
    await page.goto("https://note.com/notes/new", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    await shot(page, "editor");

    // ── 3. タイトル入力 ──
    const titleBox = page
      .locator('textarea[placeholder*="タイトル"], [aria-label*="タイトル"]')
      .first();
    await titleBox.waitFor({ timeout: 15000 });
    await titleBox.fill(article.title);

    // ── 4. 本文入力(contenteditable に1行ずつタイプ) ──
    const body = page.locator('[contenteditable="true"]').last();
    await body.click();
    for (const line of article.body.split("\n")) {
      if (line.startsWith("## ")) {
        // 見出し: そのままテキストとして入れる(装飾は手動 or 省略)
        await page.keyboard.type(line.replace(/^## /, ""), { delay: 5 });
      } else {
        await page.keyboard.type(line, { delay: 5 });
      }
      await page.keyboard.press("Enter");
    }
    await shot(page, "body-filled");

    // noteは自動保存されるので少し待つ
    await page.waitForTimeout(3000);

    if (PUBLISH) {
      // ── 5. 公開フロー ──
      await page.click('button:has-text("公開に進む")');
      await page.waitForTimeout(2000);
      await shot(page, "publish-settings");
      // 公開設定画面の「投稿する」ボタン
      await page.click('button:has-text("投稿")');
      await page.waitForTimeout(3000);
      console.log("公開しました:", article.title);
    } else {
      // 下書き保存ボタンがあれば押す(自動保存でも残る)
      const draftBtn = page.locator('button:has-text("下書き保存")');
      if (await draftBtn.count()) await draftBtn.first().click();
      await page.waitForTimeout(2000);
      console.log("下書き保存しました:", article.title);
    }

    await shot(page, "done");
  } catch (e) {
    await shot(page, "error");
    console.error("エラー:", e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
