// src/generate.js
// Claude API で記事(タイトル+本文)を生成し、article.json に保存する
// 必要な環境変数: ANTHROPIC_API_KEY

import fs from "fs";

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("ANTHROPIC_API_KEY が設定されていません");
  process.exit(1);
}

// topics.txt の先頭行をテーマとして使う(なければ汎用テーマ)
function pickTopic() {
  try {
    const lines = fs
      .readFileSync("topics.txt", "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      const topic = lines[0];
      // 使ったテーマを消して書き戻す(リポジトリにコミットするのはworkflow側)
      fs.writeFileSync("topics.txt", lines.slice(1).join("\n") + "\n");
      return topic;
    }
  } catch (_) {}
  return "最近のテクノロジーと暮らしについて、読者の役に立つテーマを自由に1つ選ぶ";
}

async function main() {
  const topic = pickTopic();
  console.log("テーマ:", topic);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system:
        "あなたはnote向けの記事ライターです。必ずJSONのみを返してください。前置きやコードフェンスは禁止。" +
        'フォーマット: {"title": "記事タイトル(30字以内)", "body": "本文"}' +
        "本文は2000〜3000字程度。noteエディタ向けにプレーンテキスト+空行で段落分け。" +
        "見出しにしたい行は先頭に「## 」を付ける。誇張や虚偽の体験談は書かない。",
      messages: [
        {
          role: "user",
          content: `次のテーマでnote記事を書いてください: ${topic}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error("API エラー:", res.status, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .replace(/```json|```/g, "")
    .trim();

  let article;
  try {
    article = JSON.parse(text);
  } catch (e) {
    console.error("JSONパース失敗。生テキスト:\n", text);
    process.exit(1);
  }

  if (!article.title || !article.body) {
    console.error("title/bodyが欠落:", article);
    process.exit(1);
  }

  fs.writeFileSync("article.json", JSON.stringify(article, null, 2));
  console.log("生成完了:", article.title);
}

main();
