// GET /api/session-status?session_id=cs_... -> { paid, item, email }
// Never returns the password: the email is the delivery. Sends it if the webhook has not.
const { stripe, fulfilOnce, unlocked, PRODUCT } = require("./_lib");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async (req, res) => {
  const id = String(req.query.session_id || "");
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ error: "bad session id" });
  try {
    const s = await stripe(`checkout/sessions/${id}`);
    if (s.metadata?.product !== PRODUCT) return res.status(404).json({ error: "not found" });
    const paid = unlocked(s);
    let mail = null;
    if (paid) {
      if (!s.metadata?.emailed) await wait(4000);
      try { mail = await fulfilOnce(s, { who: "status" }); } catch (e) { console.error("[status] mail:", e.message); mail = { sent: false }; }
    }
    res.status(200).json({ paid, item: s.metadata?.item, email: s.customer_details?.email || null, mailed: mail?.sent || /already/.test(mail?.why || "") });
  } catch (e) {
    console.error("[status]", e.message);
    res.status(502).json({ error: "Could not check the payment. Refresh in a minute." });
  }
};
