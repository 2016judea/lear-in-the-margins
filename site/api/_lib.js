// Shared by the paywall functions. Files starting with "_" are not routes on Vercel.
// Ported from msp-house-index (product-paywall skill), 2026-10-16. Two items:
//   pdf   - the course PDF + classroom licence; the buyer gets a password that downloads it
//   print - one printed copy; the buyer gives a shipping address and we submit a
//           print-on-demand job (scripts/order_print.py), so no stock is ever held.
// The password is stateless: XXXX-XXXX-XXXX = a 5-char nonce minted at checkout + a
// 7-char HMAC of it under ACCESS_SECRET. It unlocks once Stripe says its session paid.
const crypto = require("crypto");
const OFFER = require("../offer.json");

const SITE = process.env.SITE_URL || "https://lear-in-the-margins.vercel.app";
const PRODUCT = "lear-in-the-margins";
const ALPHA = "23456789BCDFGHJKMNPQRSTVWXYZ";

async function stripe(path, { method = "GET", form } = {}) {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY is not set");
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${k}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`stripe ${path}: ${j.error?.message || r.status}`);
  return j;
}

const chars = (buf, n) => Array.from(buf.subarray(0, n), (b) => ALPHA[b % ALPHA.length]).join("");
function mac(nonce, domain = "") {
  const s = process.env.ACCESS_SECRET;
  if (!s) throw new Error("ACCESS_SECRET is not set");
  return chars(crypto.createHmac("sha256", s).update(domain + nonce).digest(), 7);
}
function newPassword() {
  const nonce = chars(crypto.randomBytes(5), 5);
  const raw = nonce + mac(nonce);
  return { nonce, password: `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}` };
}
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
function checkPassword(pw) {
  const raw = String(pw || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (raw.length !== 12) return null;
  const nonce = raw.slice(0, 5), tail = raw.slice(5);
  if (same(tail, mac(nonce))) return { nonce, kind: "paid" };
  if (same(tail, mac(nonce, "comp:"))) return { nonce, kind: "comp" };
  return null;
}

const paid = new Map();
const LAUNCH = 1792100000; // 2026-10-16; no session of ours is older
const unlocked = (s) => s.metadata?.product === PRODUCT &&
  (s.payment_status === "paid" || (s.payment_status === "no_payment_required" && s.metadata?.comp === "1"));

async function nonceIsPaid(nonce) {
  if (paid.get(nonce)) return true;
  try {
    const q = encodeURIComponent(`metadata['pw_nonce']:'${nonce}' AND status:'succeeded'`);
    const s = await stripe(`payment_intents/search?query=${q}&limit=1`);
    if (s.data?.length) return paid.set(nonce, true), true;
  } catch (e) { console.error("[pw] search failed:", e.message); }
  let after = "";
  for (let page = 0; page < 20; page++) {
    const l = await stripe(`checkout/sessions?status=complete&limit=100&created[gte]=${LAUNCH}${after}`);
    const hit = l.data.find((s) => s.metadata?.pw_nonce === nonce && unlocked(s));
    if (hit) return paid.set(nonce, true), true;
    if (!l.has_more) break;
    after = `&starting_after=${l.data[l.data.length - 1].id}`;
  }
  return false;
}

async function mailgun(fields) {
  const { MAILGUN_API_KEY, MAILGUN_DOMAIN } = process.env;
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) throw new Error("Mailgun is not configured");
  const r = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from("api:" + MAILGUN_API_KEY).toString("base64") },
    body: new URLSearchParams(fields),
  });
  const out = await r.text();
  if (!r.ok) throw new Error(`mailgun ${r.status}: ${out.slice(0, 200)}`);
  return JSON.parse(out).id || "";
}

const FROM = () => process.env.MAILGUN_FROM || "aidan@brickandmortar.dev";
const btn = (href, label) => `<a href="${href}" style="display:inline-block;padding:12px 20px;background:#7a1010;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">${label}</a>`;
const wrap = (inner) => `<div style="font:16px/1.55 Georgia,serif;color:#1a1a1a;max-width:520px">${inner}</div>`;

function buyerEmail(fresh) {
  const item = fresh.metadata.item;
  if (item === "print") {
    const a = fresh.shipping_details?.address || fresh.collected_information?.shipping_details?.address || {};
    const where = [a.line1, a.line2, a.city, a.state, a.postal_code].filter(Boolean).join(", ");
    const text = [`Thanks for ordering a printed King Lear in the Margins.`, ``,
      `It is printed to order and ships to: ${where}.`, `I'll email you the tracking number when it leaves the printer, usually within a week.`, ``,
      `Your receipt comes separately from Stripe. Reply to this email with any question.`, ``, `Aidan`].join("\n");
    return { subject: "Your printed King Lear in the Margins", text,
      html: wrap(`<p>Thanks for ordering a printed <i>King Lear in the Margins</i>.</p><p>It is printed to order and ships to: ${where}.</p><p>I'll email you the tracking number when it leaves the printer, usually within a week.</p><p>Your receipt comes separately from Stripe. Reply to this email with any question.</p><p>Aidan</p>`) };
  }
  const pw = fresh.metadata.password;
  const link = `${SITE}/?pw=${encodeURIComponent(pw)}`;
  const text = [`Thanks for buying the King Lear in the Margins course edition.`, ``, `Your password: ${pw}`, ``,
    `Download the PDF: ${link}`, ``,
    `The classroom licence: give the file to the students of one course you teach, for as long as you teach it. Terms: ${SITE}/licence/`, ``,
    `Your receipt comes separately from Stripe. Reply to this email with any question.`, ``, `Aidan`].join("\n");
  return { subject: "Your King Lear in the Margins course PDF", text,
    html: wrap(`<p>Thanks for buying the <i>King Lear in the Margins</i> course edition.</p><p>Your password:<br><b style="font:600 22px ui-monospace,Menlo,monospace;letter-spacing:2px">${pw}</b></p><p>${btn(link, "Download the PDF")}</p><p>The classroom licence: give the file to the students of one course you teach, for as long as you teach it. <a href="${SITE}/licence/">Terms</a>.</p><p>Your receipt comes separately from Stripe. Reply to this email with any question.</p><p>Aidan</p>`) };
}

// Sent once per session: metadata.emailed is written before the send so a second caller backs off.
async function fulfilOnce(session, { who }) {
  if (!unlocked(session)) return { sent: false, why: "not ours or not paid" };
  const fresh = await stripe(`checkout/sessions/${session.id}`);
  if (fresh.metadata?.emailed) return { sent: false, why: "already emailed " + fresh.metadata.emailed };
  const mark = (v) => stripe(`checkout/sessions/${session.id}`, { method: "POST", form: { "metadata[emailed]": v } });
  await mark(`${new Date().toISOString()} by ${who}`);
  const to = fresh.customer_details?.email;
  const m = buyerEmail(fresh);
  try {
    await mailgun({ from: `Aidan Jude <${FROM()}>`, to, subject: m.subject, text: m.text, html: m.html, "h:Reply-To": FROM() });
  } catch (e) {
    await mark("").catch(() => {});
    throw e;
  }
  const item = fresh.metadata.item;
  await mailgun({
    from: `Lear in the Margins <${FROM()}>`, to: process.env.NOTIFY_EMAIL || "aidan@brickandmortar.dev",
    subject: `Sale: Lear ${item}, $${(fresh.amount_total || 0) / 100} from ${to}`,
    text: item === "print"
      ? `${to} ordered a printed copy. Session ${fresh.id}.\nSubmit the print job: python scripts/order_print.py ${fresh.id}`
      : `${to} bought the course PDF. Session ${fresh.id}. Password ${fresh.metadata.password} emailed by the ${who}.\nReprint: python scripts/fulfil.py ${fresh.id}`,
  }).catch((e) => console.error("[sale notice]", e.message));
  return { sent: true };
}

module.exports = { SITE, PRODUCT, OFFER, stripe, newPassword, checkPassword, nonceIsPaid, fulfilOnce, unlocked };
