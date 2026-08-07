// src/generate.js
// Claude API で記事(タイトル+本文)を生成し、article.json に保存する

import fs from "fs";

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("ANTHROPIC_API_KEY が設定されていません");
  process.exit(1);
}

const PERSONA = `あなたはExcel・AI活用を専門とする実務経験10年以上の業務改善コンサルタントで、note向けの記事ライターです。
Excel初心者の事務職の読者に向けて、今日から使える具体的なワザを、実際の手順つきで解説します。
文体はです・ます調。専門用語には必ず一言の説明を添える。
構成: 導入(読者の困りごとの提示)→結論→具体的なステップ→注意点→まとめ(今日やること1つ)。
抽象論で終わらせず、必ず具体的な関数名・プロンプト例・手順を入れる。
AIっぽい定型句(「いかがでしたか」等)は使わない。誇張や虚偽の体験談は書かない。`;

const FORMAT = `

出力形式は必ず次に従うこと:
1行目: TITLE: に続けて記事タイトル(30字以内)
2行目: BODY:
3行目以降: 本文(2000〜3000字。空行で段落分け。見出し行は先頭に「## 」)
この形式以外の前置き・後書き・コードフェンスは一切出力しない。`;

function pickTopic() {
  try {
    const lines = fs
      .readFileSync("topics.txt", "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      const topic = lines[0];
      fs.writeFileSync("topics.txt", lines.slice(1).join("\n") + "\n");
      return topic;
    }
  } catch (_) {}
  return "Excel×AIの時短ワザから、読者の役に立つテーマを1つ自由に選ぶ";
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
      system: PERSONA + FORMAT,
      messages: [
        { role: "user", content: `次のテーマでnote記事を書いてください: ${topic}` },
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
    .trim();

  const titleMatch = text.match(/^TITLE:\s*(.+)$/m);
  const bodyIndex = text.indexOf("BODY:");

  if (!titleMatch || bodyIndex === -1) {
    console.error("形式が想定と違います。生テキスト:\n", text.slice(0, 500));
    process.exit(1);
  }

  const article = {
    title: titleMatch[1].trim(),
    body: text.slice(bodyIndex + "BODY:".length).trim(),
  };

  fs.writeFileSync("article.json", JSON.stringify(article, null, 2));
  console.log("生成完了:", article.title);
}

main();
