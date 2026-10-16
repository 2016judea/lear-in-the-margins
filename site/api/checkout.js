// POST /api/checkout {item: "pdf"|"print", play: "lear"|"hamlet", token?} -> { clientSecret } for Stripe embedded Checkout.
// pdf: the buyer's password is minted here and rides in the invoice footer too.
// print: Stripe collects a US shipping address; the print job is submitted after payment.
const { SITE, PRODUCT, OFFER, play, itemName, itemDesc, stripe, newPassword } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const item = body.item === "print" ? "print" : "pdf";
  const o = OFFER[item];
  const p = play(body.play);
  const name = itemName(p, item);
  const back = p === "lear" ? SITE : `${SITE}/${p}`;
  const token = /^[a-z0-9]{6,16}$/.test(String(body.token || "")) ? body.token : "";
  try {
    const form = {
      ui_mode: "embedded_page",
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(o.price_usd * 100),
      "line_items[0][price_data][product_data][name]": name,
      "line_items[0][price_data][product_data][description]": itemDesc(p, item),
      "payment_method_types[0]": "card",
      "payment_method_types[1]": "link",
      customer_creation: "always",
      "invoice_creation[enabled]": "true",
      "invoice_creation[invoice_data][description]": name,
      "invoice_creation[invoice_data][metadata][product]": PRODUCT,
      "metadata[product]": PRODUCT,
      "metadata[item]": item,
      "metadata[play]": p,
      "metadata[token]": token,
      "payment_intent_data[metadata][product]": PRODUCT,
      "payment_intent_data[metadata][item]": item,
      "payment_intent_data[metadata][play]": p,
      "payment_intent_data[description]": name,
      return_url: `${back}/?paid={CHECKOUT_SESSION_ID}`,
    };
    if (item === "pdf") {
      const { nonce, password } = newPassword(p);
      Object.assign(form, {
        "invoice_creation[invoice_data][custom_fields][0][name]": "Password",
        "invoice_creation[invoice_data][custom_fields][0][value]": password,
        "invoice_creation[invoice_data][footer]": `Your password: ${password}. Download the PDF at ${back}/?pw=${password}. Classroom licence: ${SITE}/licence/`,
        "metadata[pw_nonce]": nonce,
        "metadata[password]": password,
        "payment_intent_data[metadata][pw_nonce]": nonce,
      });
    } else {
      form["shipping_address_collection[allowed_countries][0]"] = "US";
      form["phone_number_collection[enabled]"] = "true"; // the printer's courier asks for one
    }
    const s = await stripe("checkout/sessions", { method: "POST", form });
    res.status(200).json({ clientSecret: s.client_secret });
  } catch (e) {
    console.error("[checkout]", e.message);
    res.status(502).json({ error: "Checkout could not start. Please try again in a minute." });
  }
};
