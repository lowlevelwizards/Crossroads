"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const compositor = fs.readFileSync(path.join(root, "src/presentation/scene-compositor.js"), "utf8");
const linear = fs.readFileSync(path.join(root, "src/presentation/linear-terrain.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles/stabilization.css"), "utf8");
const checks = [
  ["buildings promoted into shared scene", compositor.includes("scene-promoted-terrain")],
  ["units receive table depth", compositor.includes("unitDepth")],
  ["roads use butt caps", linear.includes('"stroke-linecap": "butt"')],
  ["fences use posts and rails", linear.includes("linear-fence-rail-top") && linear.includes("linear-fence-post")],
  ["explicit objective layer", css.includes("z-index:7200")],
  ["explicit interaction layer", css.includes("z-index:7600")]
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed++; }
if (failed) process.exit(1);
