// src/thumbnail.js
// background.png に article.json のタイトルを合成して thumbnail.png を作る
import sharp from "sharp";
import fs from "fs";

const article = JSON.parse(fs.readFileSync("article.json", "utf8"));
const title = article.title;

const W = 1280, H = 670;

// タイトルを適当な文字数で折り返す(全角想定で1行12文字)
function wrap(text, perLine = 12) {
  const lines = [];
  for (let i = 0; i < text.length; i += perLine) {
    lines.push(text.slice(i, i + perLine));
  }
  return lines.slice(0, 4); // 最大4行
}

const lines = wrap(title);
const fontSize = lines.length >= 3 ? 64 : 76;
const lineHeight = fontSize * 1.4;
const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const textSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text {
      font-family: "Noto Sans CJK JP", "Noto Sans JP", sans-serif;
      font-weight: 700;
      fill: #222222;
      paint-order: stroke;
      stroke: #ffffff;
      stroke-width: 10px;
      stroke-linejoin: round;
    }
  </style>
  ${lines
    .map(
      (line, i) =>
        `<text x="${W / 2}" y="${startY + i * lineHeight}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${esc(line)}</text>`
    )
    .join("\n")}
</svg>`;

await sharp("background.png")
  .resize(W, H, { fit: "cover" })
  .composite([{ input: Buffer.from(textSvg), top: 0, left: 0 }])
  .png()
  .toFile("thumbnail.png");

console.log("サムネ生成完了:", title);
