"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
let passed = 0;
function check(name, condition) {
  if (!condition) { console.error(`FAIL ${name}`); process.exitCode = 1; return; }
  passed += 1; console.log(`PASS ${name}`);
}
const index = read("index.html");
const terrain = read("data/terrain.js");
const scenarios = read("data/scenarios.js");
const runtime = read("src/presentation/terrain-runtime.js");
const css = read("styles/mokra.css");
check("terrain runtime loads after base terrain presentation", index.indexOf("src/presentation/terrain.js") < index.indexOf("terrain-runtime.js"));
check("rules geometry uses normalized footprints", read("src/rules/terrain-geometry.js").includes("visualRect") && read("src/rules/terrain-geometry.js").includes("normalizedRect"));
check("all building types define inset footprints", (terrain.match(/buildingPresentation\(/g) || []).length >= 7 && terrain.includes("footprint:"));
check("connected path modules replace Mokra route tiles", index.includes("path-geometry.js") && index.includes("linear-terrain.js"));
check("stream is authored as one connected path", scenarios.includes('id:"mokra-stream"') && scenarios.includes('styleId:"stream"'));
check("farm ground pieces are open terrain", terrain.includes("field_tilled") && terrain.includes("field_wheat") && terrain.includes("field_cabbage"));
check("woodpile primitive is namespaced", runtime.includes("woodpile-log") && css.includes(".woodpile-log"));
check("battlefield terrain labels default to hidden", css.includes("visibility:hidden") && css.includes("terrain-label-visible"));
check("Mokra uses waypoint linear terrain", scenarios.includes("linearTerrain:freezeList") && scenarios.includes('styleId:"railway_embankment"') && scenarios.includes('terrainId:"field_wheat"'));
check("build metadata and cache version are current", /version:\s*"[^"]+"/.test(read("data/build-info.js")) && index.includes("v=s110"));
if (!process.exitCode) console.log(`Mokra M1.1 source audit: ${passed}/10 passed.`);
