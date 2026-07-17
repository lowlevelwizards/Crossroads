"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
let passed=0;function check(name,value){if(!value)throw new Error(`FAIL ${name}`);passed++;console.log(`PASS ${name}`)}
const index=read("index.html"),linear=read("src/presentation/linear-terrain.js"),camera=read("src/camera/camera.js"),labels=read("src/presentation/nameplate-policy.js"),scenario=read("data/scenarios.js");
check("old terrain polish is not loaded",!index.includes("terrain-polish.js"));
check("terrain runtime is loaded",index.includes("terrain-runtime.js"));
check("nameplate policy loads after engine",index.indexOf("src/engine.js")<index.indexOf("nameplate-policy.js"));
check("rail uses compact sleeper rectangles",linear.includes("linear-rail-sleeper")&&linear.includes("sleeperSpacing"));
check("wall uses repeated stones",linear.includes("linear-wall-stone"));
check("zoom uses one board scale transform",camera.includes("scale(${zoom})"));
check("zoom refresh is deferred",camera.includes("SETTLE")||camera.includes("DELAY=125"));
check("nameplates are contextual",labels.includes("nameplate-visible")&&labels.includes("eligibleFaction"));
check("Mokra clutter pieces removed",!scenario.includes('id:"village-cottage-c"')&&!scenario.includes('id:"village-shed"'));
console.log(`${passed}/9 Terrain L1.1 audit checks passed.`);
