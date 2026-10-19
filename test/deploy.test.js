// The paid course PDFs must never be static URLs. 2026-10-19: with outputDirectory "."
// /api/%5Ffull/king_lear_course.pdf served the 1.4 MB PDF with a 200.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");

test("only public/ is served, in vercel.json and in the deploy payload", () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "site/vercel.json"), "utf8")).outputDirectory, "public");
  const deploy = fs.readFileSync(path.join(root, "scripts/deploy.py"), "utf8");
  assert.match(deploy, /"outputDirectory": "public"/);
  assert.doesNotMatch(deploy, /"outputDirectory": "\."/);
});

test("static files go up under public/, api/ and the bundle stay outside it", () => {
  const deploy = fs.readFileSync(path.join(root, "scripts/deploy.py"), "utf8");
  assert.match(deploy, /return \["public\/" \+ str\(rel\), str\(rel\)\]/);
  assert.match(deploy, /f"api\/_full\/\{dst\}"/);
});
