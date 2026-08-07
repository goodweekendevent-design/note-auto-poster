// src/post.js
// セッションCookie方式: NOTE_SESSION (=ブラウザの _note_session_v5 の値) でログインをスキップ
// 必要な環境変数: NOTE_SESSION / PUBLISH=true で公開(なければ下書き) / DEBUG=true でスクショ

import { chromium } from "playwright";
import fs from "fs";

const SESSION = process.env.NOTE_SESSION;
const PUBLISH = process.env.PUBLISH === "true";
const DEBUG = process.env.DEBUG === "true";

if (!SESSION) {
  console.error("NOTE_SESSION が設定されていません");
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
  });

  // ブラウザから持ってきたセッションCookieを注入
  await context.addCookies([
    {
      name: "_note_session_v5",
      value: SESSION,
      domain: ".note.com",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  try {
    // ── 1. ログイン状態の確認 ──
    await page.goto("https://note.com", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await shot(page, "top");

    if (page.url().includes("/login")) {
      console.error("セッションが無効です。Cookieを取り直してNOTE_SESSIONを更新してください");
      await shot(page, "session-invalid");
      process.exit(1);
    }
    console.log("セッション有効。エディタを開きます");

    // ── 2. 新規記事エディタ ──
    await page.goto("https://note.com/notes/new", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await shot(page, "editor");

    if (page.url().includes("/login")) {
      console.error("エディタでログイン画面にリダイレクトされました。セッション切れです");
      process.exit(1);
    }

    // ── 2.5 見出し画像のアップロード(失敗しても投稿は続行) ──
    if (fs.existsSync("thumbnail.png")) {
      try {
        // 1クリック目: 画像アイコンを押してメニューを開く
        await page
          .locator('button:has-text("画像"), [aria-label*="画像"], [class*="headerImage"], [class*="eyecatch"]')
          .first()
          .click();
        await page.waitForTimeout(1500);
        await shot(page, "thumbnail-menu");

        // 2クリック目: メニューの「画像をアップロード」→ ファイル選択が開く
        const [chooser] = await Promise.all([
          page.waitForEvent("filechooser", { timeout: 10000 }),
          page.locator('text=画像をアップロード').first().click(),
        ]);
        await chooser.setFiles("thumbnail.png");

        // トリミング画面(モーダル)が開くのを待つ
        await page.waitForSelector('[data-testid="cropper"]', { timeout: 15000 });
        await page.waitForTimeout(1500);
        await shot(page, "thumbnail-crop");

        // モーダル内の「保存」ボタンを押す
        const modal = page.locator(".ReactModalPortal");
        await modal
          .locator('button:has-text("保存"), button:has-text("設定"), button:has-text("適用")')
          .first()
          .click();

        // モーダルが完全に閉じるのを待ってから次へ
        await page.waitForSelector('[data-testid="cropper"]', {
          state: "detached",
          timeout: 15000,
        });
        await page.waitForTimeout(2000);
        await shot(page, "thumbnail-uploaded");
        console.log("見出し画像を設定しました");
      } catch (e) {
        console.log("見出し画像の設定に失敗(記事投稿は続行):", e.message);
        await shot(page, "thumbnail-failed");
        // モーダルが開きっぱなしだと後続が失敗するのでEscで閉じておく
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1000);
      }
    }
    
    // ── 3. タイトル入力 ──
    const titleBox = page
      .locator('textarea[placeholder*="タイトル"], [aria-label*="タイトル"], textarea')
      .first();
    await titleBox.waitFor({ timeout: 15000 });
    await titleBox.fill(article.title);

    // ── 4. 本文入力 ──
    const body = page.locator('[contenteditable="true"]').last();
    await body.click();
    for (const line of article.body.split("\n")) {
      const text = line.startsWith("## ") ? line.replace(/^## /, "") : line;
      if (text) await page.keyboard.type(text, { delay: 5 });
      await page.keyboard.press("Enter");
    }
    await shot(page, "body-filled");
    await page.waitForTimeout(3000); // 自動保存待ち

    if (PUBLISH) {
      await page.click('button:has-text("公開に進む")');
      await page.waitForTimeout(2500);
      await shot(page, "publish-settings");
      await page.click('button:has-text("投稿")');
      await page.waitForTimeout(3000);
      console.log("公開しました:", article.title);
    } else {
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
