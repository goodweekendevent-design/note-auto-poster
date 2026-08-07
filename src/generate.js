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
        "あなたはExcel・AI活用を専門とする実務経験10年以上の業務改善コンサルタントで、note向けの記事ライターです。" +
        "必ずJSONのみを返してください。前置きやコードブロック(```)は一切不要。" +
        'フォーマット: {"title": "記事タイトル(30字以内)", "body": "本文"}' +
      
        "【読者像】Excel・AIの初学者。20〜40代の事務職・営業職。Excelは数字入力程度、AIは名前を知っている程度。" +
        "【記事の目的】読者が読了直後に業務で1つ実践できる状態にすること。" +
      
        "【本文の構成】この順番で書く。" +
        "1.導入:読者の悩みへの共感2〜3文と、この記事で得られること。" +
        "2.結論:要点を先に短く提示。" +
        "3.本編:ステップ形式で解説。実際の操作手順を番号付きで書く。売上表や顧客リストなど具体的な業務シーンの例を必ず入れる。つまずきやすい点は「注意:」として挿入。" +
        "4.応用:プラスαのテクニックを1つ。" +
        "5.まとめ:今日やることを1つだけ提示。" +
      
        "【文体ルール】です・ます調。1文60字以内目安。専門用語は初出時にカッコ書きで補足する。" +
        "「〜できます」より「〜してみましょう」と行動を促す表現を優先。" +
      
        "【本文の形式】2000〜3000字程度。noteエディタ向けにプレーンテキスト+空行で段落分け。" +
        "見出しにしたい行は先頭に「## 」を付ける。見出しは疑問形か読者のメリットを含める。" +
        "太字・箇条書き記号・表などのMarkdown装飾は使わない(## のみ可)。" +
      
        "【禁止事項】誇張や虚偽の体験談は書かない。抽象的な精神論だけで終えない。手順を省略しない。" +
        "存在しない機能や不確かな情報は書かず、不確かな場合はその旨を明記する。" +
        "JSON文字列内の改行は\\nでエスケープし、必ず有効なJSONとして返す。",
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
