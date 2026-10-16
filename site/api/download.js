// GET /api/download?pw=XXXX-XXXX-XXXX[&check=1] -> the course PDF (or {ok} with check=1).
// The PDF is bundled with this function (api/_full/, uploaded by scripts/deploy.py from
// private/), never in public site/.
const fs = require("fs");
const path = require("path");
const { checkPassword, nonceIsPaid } = require("./_lib");
const FILE = path.join(__dirname, "_full", "king_lear_course.pdf");

module.exports = async (req, res) => {
  const pw = req.headers["x-password"] || req.query.pw;
  const ok = checkPassword(pw);
  if (!ok) return res.status(401).json({ error: "That password didn't match. Check the email it came in, or reply to it for help." });
  try {
    if (ok.kind === "paid" && !(await nonceIsPaid(ok.nonce))) return res.status(402).json({ error: "That password's payment hasn't gone through. If you just paid, wait a minute and try again." });
  } catch (e) {
    console.error("[download] paid check:", e.message);
    return res.status(502).json({ error: "Couldn't check the password right now. Try again in a minute." });
  }
  console.log(`[unlock] ${ok.kind} ${ok.nonce}`);
  res.setHeader("Cache-Control", "private, no-store");
  if (req.query.check) return res.status(200).json({ ok: true, kind: ok.kind });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="King-Lear-in-the-Margins-course-edition.pdf"');
  res.status(200).end(fs.readFileSync(FILE));
};
