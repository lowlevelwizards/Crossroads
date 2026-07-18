"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const root = path.resolve(__dirname, "..");
const compositor = fs.readFileSync(path.join(root, "src/presentation/scene-compositor.js"), "utf8");
const linear = fs.readFileSync(path.join(root, "src/presentation/linear-terrain.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles/stabilization.css"), "utf8");
const terrainCss = fs.readFileSync(path.join(root, "styles/terrain.css"), "utf8");

const context = vm.createContext({ console, window:{} });
vm.runInContext(fs.readFileSync(path.join(root, "src/presentation/layer-policy.js"), "utf8"), context, { filename:"src/presentation/layer-policy.js" });
const LAYERS = context.window.CrossroadsLayerPolicy;
const unitDepth = LAYERS.unitLayer({ y:24 }, 48);
const bodyDepth = LAYERS.woodlandBodyLayer({ inheritLayer:true }, 24, 48);
const canopyDepth = LAYERS.woodlandCanopyLayer({ inheritLayer:true }, 24, 48);
const buildingDepth = LAYERS.terrainLayer({ y:20, height:8 }, { renderer:"building", presentation:{ depthAnchor:.82 } }, 48);
const foregroundDepth = LAYERS.buildingForegroundLayer({ y:20, height:8 }, { renderer:"building", presentation:{ depthAnchor:.82 } }, 48);

assert.strictEqual(unitDepth, bodyDepth, "unit and woodland body fragments must share table-Y depth ordering");
assert(canopyDepth > bodyDepth, "woodland canopies must render above their corresponding bodies");
assert(foregroundDepth > buildingDepth, "building foreground fragments must render above their body depth");
assert(foregroundDepth < LAYERS.BANDS.objective, "terrain fragments must remain below objective overlays");

const checks = [
  ["buildings promoted into shared scene", compositor.includes("scene-promoted-terrain")],
  ["units receive table depth", compositor.includes("unitDepth")],
  ["buildings emit a foreground fragment", compositor.includes("createBuildingForeground") && compositor.includes("scene-building-foreground")],
  ["woodland fragments have independent CSS", terrainCss.includes("woodland-tree-body") && terrainCss.includes("woodland-tree-canopy")],
  ["building foreground uses clipped overlap", terrainCss.includes("clip-path:inset(58% -18% -18% -18%)")],
  ["roads use butt caps", linear.includes('"stroke-linecap": "butt"')],
  ["fences use posts and rails", linear.includes("linear-fence-rail-top") && linear.includes("linear-fence-post")],
  ["explicit objective layer", css.includes("z-index:7200")],
  ["explicit interaction layer", css.includes("z-index:7600")]
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed++; }
if (failed) process.exit(1);
console.log("PASS — E1.5 shared depth bands and multi-fragment occlusion contract passed.");
