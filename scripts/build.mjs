import { cp, mkdir, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

if (dirname(dist) !== root || basename(dist) !== "dist") {
  throw new Error("拒绝清理非项目 dist 目录");
}

const files = [
  "index.html",
  "styles.css",
  "config.js",
  "recognition-service.js",
  "ai-service.js",
  "app.js"
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await cp(join(root, file), join(dist, file));
}

await cp(join(root, "assets"), join(dist, "assets"), { recursive: true });
console.log(`已生成干净发布目录：${dist}`);
