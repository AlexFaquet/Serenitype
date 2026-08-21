import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSerenityServer } from "./server.js";

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "serenitype-test-")); const { server } = createSerenityServer({ databasePath:join(dir, "test.sqlite"), production:false });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); rmSync(dir, { recursive:true, force:true }); }); return origin;
}

test("health, registration, session, and revision-aware sync", async (t) => {
  const origin = await fixture(t); const health = await fetch(`${origin}/api/health`).then((response) => response.json()); assert.equal(health.ok, true);
  const registerResponse = await fetch(`${origin}/api/auth/register`, { method:"POST", headers:{ "Content-Type":"application/json", Origin:origin }, body:JSON.stringify({ email:"quiet@example.com", password:"a properly quiet password", displayName:"Quiet" }) });
  assert.equal(registerResponse.status, 201); const cookie = registerResponse.headers.get("set-cookie").split(";")[0]; const registration = await registerResponse.json(); assert.equal(registration.user.displayName, "Quiet");
  const me = await fetch(`${origin}/api/me`, { headers:{ Cookie:cookie } }).then((response) => response.json()); assert.equal(me.user.email, "quiet@example.com");
  const first = await fetch(`${origin}/api/data`, { method:"PUT", headers:{ "Content-Type":"application/json", Cookie:cookie, Origin:origin }, body:JSON.stringify({ revision:0, data:{ version:2, sessions:[], profile:{ name:"Quiet" } } }) }); assert.equal(first.status, 200); assert.equal((await first.json()).revision, 1);
  const conflict = await fetch(`${origin}/api/data`, { method:"PUT", headers:{ "Content-Type":"application/json", Cookie:cookie, Origin:origin }, body:JSON.stringify({ revision:0, data:{ version:2, sessions:[] } }) }); assert.equal(conflict.status, 409);
  const app = await fetch(`${origin}/`); assert.equal(app.status, 200); assert.match(await app.text(), /Make space for/);
  const range = await fetch(`${origin}/ambient.mp3`, { headers:{ Range:"bytes=0-99" } }); assert.equal(range.status, 206); assert.equal(Number(range.headers.get("content-length")), 100); assert.match(range.headers.get("content-range"), /^bytes 0-99\//); assert.equal((await range.arrayBuffer()).byteLength, 100);
});

test("authentication rejects weak credentials and preserves generic login errors", async (t) => {
  const origin = await fixture(t); const weak = await fetch(`${origin}/api/auth/register`, { method:"POST", headers:{ "Content-Type":"application/json", Origin:origin }, body:JSON.stringify({ email:"not-an-email", password:"short" }) }); assert.equal(weak.status, 400);
  const badLogin = await fetch(`${origin}/api/auth/login`, { method:"POST", headers:{ "Content-Type":"application/json", Origin:origin }, body:JSON.stringify({ email:"none@example.com", password:"this is not right" }) }); assert.equal(badLogin.status, 401); assert.equal((await badLogin.json()).error, "Email or password was not recognized.");
});
