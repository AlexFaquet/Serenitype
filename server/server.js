import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SerenityDatabase, passwordPolicy, emailPolicy } from "./database.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TYPES = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".webmanifest":"application/manifest+json", ".xml":"application/xml; charset=utf-8", ".png":"image/png", ".ico":"image/x-icon", ".mp3":"audio/mpeg", ".txt":"text/plain; charset=utf-8", ".svg":"image/svg+xml" };
const SESSION_COOKIE = "serenitype_session";

function cookies(header = "") { return Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([key]) => key).map(([key, value]) => [key, decodeURIComponent(value || "")])); }
function json(res, status, value, headers = {}) { const body = JSON.stringify(value); res.writeHead(status, { "Content-Type":"application/json; charset=utf-8", "Content-Length":Buffer.byteLength(body), ...headers }); res.end(body); }
function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin"); res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
}
function clientIp(req) { return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim(); }
async function body(req, limit = 1_100_000) {
  const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > limit) throw new Error("BODY_TOO_LARGE"); chunks.push(chunk); }
  if (!chunks.length) return {}; try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new Error("INVALID_JSON"); }
}
function sessionCookie(token, expires, secure) { return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires.toUTCString()}${secure ? "; Secure" : ""}`; }
function clearCookie(secure) { return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`; }

export function createSerenityServer({ databasePath = process.env.DATABASE_PATH || resolve(ROOT, "data/serenitype.sqlite"), staticRoot = ROOT, production = process.env.NODE_ENV === "production" } = {}) {
  const database = new SerenityDatabase(databasePath); const rate = new Map();
  const rateLimit = (req, action, max = 12) => { const key = `${clientIp(req)}:${action}`; const now = Date.now(); const current = rate.get(key); if (!current || now - current.start > 15 * 60_000) { rate.set(key, { start:now, count:1 }); return true; } current.count += 1; return current.count <= max; };
  const originAllowed = (req) => { const origin = req.headers.origin; if (!origin) return true; const expected = `${production ? "https" : "http"}://${req.headers.host}`; return origin === expected; };
  const currentUser = (req) => database.getUserBySession(cookies(req.headers.cookie)[SESSION_COOKIE]);

  const server = createServer(async (req, res) => {
    securityHeaders(res); const url = new URL(req.url, `http://${req.headers.host || "localhost"}`); const method = req.method || "GET";
    try {
      if (url.pathname.startsWith("/api/")) {
        res.setHeader("Cache-Control", "no-store");
        if (["POST","PUT","PATCH","DELETE"].includes(method) && !originAllowed(req)) return json(res, 403, { error:"Request origin was not accepted." });
        if (method === "GET" && url.pathname === "/api/health") return json(res, 200, { ok:true, service:"serenitype", time:new Date().toISOString() });
        if (method === "GET" && url.pathname === "/api/me") return json(res, 200, { user:currentUser(req) });
        if (method === "POST" && url.pathname === "/api/auth/register") {
          if (!rateLimit(req, "register", 6)) return json(res, 429, { error:"Please wait before trying again." });
          const input = await body(req); if (!emailPolicy(input.email)) return json(res, 400, { error:"Enter a valid email address." }); if (!passwordPolicy(input.password)) return json(res, 400, { error:"Use a password between 10 and 200 characters." });
          let user; try { user = database.createUser({ email:input.email, password:input.password, displayName:input.displayName }); } catch (error) { if (error.message === "EMAIL_EXISTS") return json(res, 409, { error:"An account already exists for this email." }); throw error; }
          const auth = database.createSession(user.id, { userAgent:req.headers["user-agent"], ip:clientIp(req) }); return json(res, 201, { user }, { "Set-Cookie":sessionCookie(auth.token, auth.expiresAt, production) });
        }
        if (method === "POST" && url.pathname === "/api/auth/login") {
          if (!rateLimit(req, "login", 12)) return json(res, 429, { error:"Please wait before trying again." }); const input = await body(req); const user = database.authenticate(input.email, input.password); if (!user) return json(res, 401, { error:"Email or password was not recognized." });
          const auth = database.createSession(user.id, { userAgent:req.headers["user-agent"], ip:clientIp(req) }); return json(res, 200, { user }, { "Set-Cookie":sessionCookie(auth.token, auth.expiresAt, production) });
        }
        if (method === "POST" && url.pathname === "/api/auth/logout") { database.deleteSession(cookies(req.headers.cookie)[SESSION_COOKIE]); return json(res, 200, { ok:true }, { "Set-Cookie":clearCookie(production) }); }
        if (url.pathname === "/api/data") {
          const user = currentUser(req); if (!user) return json(res, 401, { error:"Sign in to sync this garden." });
          if (method === "GET") return json(res, 200, database.getData(user.id));
          if (method === "PUT") { const input = await body(req); if (!Number.isInteger(input.revision) || !input.data || typeof input.data !== "object" || !Array.isArray(input.data.sessions) || input.data.sessions.length > 1000) return json(res, 400, { error:"The Serenitype data format was not accepted." }); let saved; try { saved = database.saveData(user.id, input.data, input.revision); } catch (error) { if (error.message === "REVISION_CONFLICT") return json(res, 409, { error:"This garden changed on another device. Refresh before syncing again.", ...error.current }); throw error; } return json(res, 200, saved); }
        }
        return json(res, 404, { error:"API route not found." });
      }

      if (method !== "GET" && method !== "HEAD") return json(res, 405, { error:"Method not allowed." }, { Allow:"GET, HEAD" });
      let pathname; try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error:"Invalid URL." }); }
      if (pathname.endsWith("/")) pathname += "index.html"; let filename = resolve(staticRoot, `.${pathname}`);
      if (filename !== staticRoot && !filename.startsWith(`${staticRoot}${sep}`)) return json(res, 403, { error:"Forbidden." });
      let info; try { info = await stat(filename); if (info.isDirectory()) { filename = resolve(filename, "index.html"); info = await stat(filename); } } catch { if (!extname(pathname)) { filename = resolve(staticRoot, "index.html"); info = await stat(filename); } else { return json(res, 404, { error:"Not found." }); } }
      if (pathname === "/archive/typing-original/index.html") res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
      const extension = extname(filename); res.setHeader("Content-Type", TYPES[extension] || "application/octet-stream"); res.setHeader("Cache-Control", [".mp3",".png",".ico"].includes(extension) ? "public, max-age=86400" : "no-cache");
      let start = 0; let end = info.size - 1; const range = req.headers.range;
      if (range && extension === ".mp3") {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range); if (!match) { res.writeHead(416, { "Content-Range":`bytes */${info.size}` }); return res.end(); }
        start = match[1] ? Number(match[1]) : 0; end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= info.size) { res.writeHead(416, { "Content-Range":`bytes */${info.size}` }); return res.end(); }
        res.statusCode = 206; res.setHeader("Content-Range", `bytes ${start}-${end}/${info.size}`); res.setHeader("Accept-Ranges", "bytes");
      } else { res.statusCode = 200; if (extension === ".mp3") res.setHeader("Accept-Ranges", "bytes"); }
      res.setHeader("Content-Length", end - start + 1); if (method === "HEAD") return res.end(); const stream = createReadStream(filename, { start, end }); stream.on("error", () => res.destroy()); stream.pipe(res);
    } catch (error) {
      if (error.message === "BODY_TOO_LARGE") return json(res, 413, { error:"That request was too large." }); if (error.message === "INVALID_JSON") return json(res, 400, { error:"The request was not valid JSON." }); console.error(error); if (!res.headersSent) json(res, 500, { error:"Serenitype encountered an unexpected problem." }); else res.destroy();
    }
  });
  server.on("close", () => database.close()); const cleanup = setInterval(() => database.cleanup(), 6 * 3600_000); cleanup.unref(); return { server, database };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT) || 8787; const host = process.env.HOST || "127.0.0.1"; const { server } = createSerenityServer(); server.listen(port, host, () => console.log(`Serenitype is listening on http://${host}:${port}`));
}
