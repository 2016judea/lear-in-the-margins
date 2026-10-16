// GET /api/print-file?f=interior|cover[-<play>]&exp=<unix>&sig=<hmac> -> a print file, for the
// print-on-demand service to fetch when scripts/order_print.py submits a job. The link is
// signed with ACCESS_SECRET and expires, so the paid PDF is never at a public URL.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PLAYS } = require("./_lib");
const FILES = {};
for (const [p, P] of Object.entries(PLAYS)) {
  const sfx = p === "lear" ? "" : `-${p}`;
  FILES[`interior${sfx}`] = P.file;
  FILES[`cover${sfx}`] = P.cover;
}

module.exports = (req, res) => {
  const f = String(req.query.f || ""), exp = Number(req.query.exp || 0), sig = String(req.query.sig || "");
  const want = crypto.createHmac("sha256", process.env.ACCESS_SECRET || "").update(`print:${f}:${exp}`).digest("hex");
  if (!FILES[f] || !(exp > Date.now() / 1000) || sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want)))
    return res.status(403).json({ error: "bad or expired link" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).end(fs.readFileSync(path.join(__dirname, "_full", FILES[f])));
};
