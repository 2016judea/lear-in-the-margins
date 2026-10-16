// GET /api/download?pw=XXXX-XXXX-XXXX[&check=1] -> the course PDF of the play the password
// was minted for (or {ok, play} with check=1).
// The PDF is bundled with this function (api/_full/, uploaded by scripts/deploy.py from
// private/), never in public site/.
const fs = require("fs");
const path = require("path");
const { checkPassword, nonceIsPaid, PLAYS } = require("./_lib");

module.exports = async (req, res) => {
  const pw = req.headers["x-password"] || req.query.pw;
  const ok = checkPassword(pw);
  if (!ok) return res.status(401).json({ error: "That password didn't match. Check the email it came in, or reply to it for help." });
  try {
    if (ok.kind === "paid" && !(await nonceIsPaid(ok.nonce, ok.play))) return res.status(402).json({ error: "That password's payment hasn't gone through. If you just paid, wait a minute and try again." });
  } catch (e) {
    console.error("[download] paid check:", e.message);
    return res.status(502).json({ error: "Couldn't check the password right now. Try again in a minute." });
  }
  console.log(`[unlock] ${ok.kind} ${ok.play} ${ok.nonce}`);
  res.setHeader("Cache-Control", "private, no-store");
  if (req.query.check) return res.status(200).json({ ok: true, kind: ok.kind, play: ok.play });
  res.setHeader("Content-Type", "application/pdf");
  const P = PLAYS[ok.play];
  res.setHeader("Content-Disposition", `attachment; filename="${P.download_name}"`);
  res.status(200).end(fs.readFileSync(path.join(__dirname, "_full", P.file)));
};
