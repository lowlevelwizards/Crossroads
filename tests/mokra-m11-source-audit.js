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
const polish = read("src/presentation/terrain-polish.js");
const css = read("styles/mokra.css");
check("terrain polish loads after base terrain presentation", index.indexOf("src/presentation/terrain.js") < index.indexOf("terrain-polish.js"));
check("rules geometry uses normalized footprints", read("src/rules/terrain-geometry.js").includes("visualRect") && read("src/rules/terrain-geometry.js").includes("normalizedRect"));
check("all building types define inset footprints", (terrain.match(/buildingPresentation\(/g) || []).length >= 7 && terrain.includes("footprint:"));
check("route kit includes T junction and end cap", terrain.includes("road_t") && terrain.includes("road_end"));
check("water kit includes bend and end", terrain.includes("stream_curve") && terrain.includes("stream_end"));
check("farm ground pieces are open terrain", terrain.includes("field_tilled") && terrain.includes("field_wheat") && terrain.includes("field_cabbage"));
check("woodpile primitive is namespaced", polish.includes("woodpile-log") && css.includes(".woodpile-log"));
check("battlefield terrain labels default to hidden", css.includes("visibility:hidden") && css.includes("terrain-label-visible"));
check("Mokra uses new modular pieces", scenarios.includes('terrainId:"road_t"') && scenarios.includes('terrainId:"stream_curve"') && scenarios.includes('terrainId:"field_wheat"'));
check("Mokra build metadata and cache version advanced", read("data/build-info.js").includes("Mokra M1.1") && index.includes("v=m11"));
if (!process.exitCode) console.log(`Mokra M1.1 source audit: ${passed}/10 passed.`);
