// node --test test/*.test.js   (no network: Stripe is never called here)
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");

const API = path.join(__dirname, "..", "site", "api");
const fakeRes = () => ({ code: 0, body: null, headers: {}, status(c) { this.code = c; return this; },
  json(b) { this.body = b; return this; }, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; return this; } });

test("a print-file link is refused, not served, when ACCESS_SECRET is unset", () => {
  // With no secret the handler used to sign with "" and accept any link signed the same
  // way, so a misconfigured deploy served the paid PDF to anyone who computed an HMAC
  // under the empty key. download.js throws on a missing secret; print-file must refuse too.
  delete process.env.ACCESS_SECRET;
  delete require.cache[require.resolve(path.join(API, "print-file.js"))];
  const handler = require(path.join(API, "print-file.js"));
  const exp = Math.floor(Date.now() / 1000) + 600;
  const sig = crypto.createHmac("sha256", "").update(`print:interior:${exp}`).digest("hex");
  const res = fakeRes();
  handler({ query: { f: "interior", exp: String(exp), sig } }, res);
  assert.equal(res.code, 403);
});

test("a print-file link signed under the real secret still passes the gate", () => {
  process.env.ACCESS_SECRET = "test-secret";
  delete require.cache[require.resolve(path.join(API, "print-file.js"))];
  const handler = require(path.join(API, "print-file.js"));
  const exp = Math.floor(Date.now() / 1000) + 600;
  const sig = crypto.createHmac("sha256", "test-secret").update(`print:cover-hamlet:${exp}`).digest("hex");
  const res = fakeRes();
  // The PDF is not on disk in a checkout (api/_full/ is uploaded at deploy), so passing
  // the gate shows as the file read failing, never as a 403.
  assert.throws(() => handler({ query: { f: "cover-hamlet", exp: String(exp), sig } }, res), /ENOENT/);
  assert.notEqual(res.code, 403);
  const expired = fakeRes();
  handler({ query: { f: "cover-hamlet", exp: String(exp - 1200), sig } }, expired);
  assert.equal(expired.code, 403);
});

test("a password opens only the play it was minted for", () => {
  process.env.ACCESS_SECRET = "test-secret";
  delete require.cache[require.resolve(path.join(API, "_lib.js"))];
  const L = require(path.join(API, "_lib.js"));
  for (const play of ["lear", "hamlet"]) {
    const { password } = L.newPassword(play);
    const ok = L.checkPassword(password.toLowerCase().replace(/-/g, " "));
    assert.deepEqual({ kind: ok.kind, play: ok.play }, { kind: "paid", play });
  }
  assert.equal(L.checkPassword("ABCD-EFGH-JKLM"), null);
  assert.equal(L.checkPassword(""), null);
  // An unknown play signs in Lear's domain, so links sold before Hamlet keep working.
  assert.equal(L.checkPassword(L.newPassword("othello").password).play, "lear");
});
