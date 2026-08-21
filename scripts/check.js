import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = ["index.html", "styles/app.css", "src/app.js", "manifest.webmanifest", "sw.js", "robots.txt", "sitemap.xml", "server/server.js"];
for (const file of required) { if (!existsSync(resolve(root, file))) throw new Error(`Missing required file: ${file}`); }
const html = readFileSync(resolve(root, "index.html"), "utf8");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index); if (duplicates.length) throw new Error(`Duplicate HTML ids: ${[...new Set(duplicates)].join(", ")}`);
const modules = ["src/app.js", "src/core/store.js", "src/core/api.js", "src/core/audio.js", "src/core/garden.js", "src/experiences/typing.js", "src/experiences/focus.js", "src/experiences/breathe.js", "src/experiences/reflect.js", "server/server.js", "server/database.js", "sw.js"];
for (const file of modules) execFileSync(process.execPath, ["--check", resolve(root, file)], { stdio: "pipe" });
JSON.parse(readFileSync(resolve(root, "manifest.webmanifest"), "utf8"));
console.log(`Serenitype check passed: ${required.length} required files, ${modules.length} scripts, ${ids.length} unique ids.`);

