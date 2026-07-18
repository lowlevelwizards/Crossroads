"use strict";
const fs=require("fs"),path=require("path"),root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
let passed=0;function check(name,value){if(!value)throw new Error(name);passed++;console.log(`PASS ${name}`);}
const camera=read("src/camera/camera.js"),linear=read("src/presentation/linear-terrain.js"),css=read("styles/stabilization.css"),names=read("src/presentation/nameplate-policy.js"),scenarios=read("data/scenarios.js");
check("camera fixes miniature scale",/setProperty\("--miniature-scale",\s*"1"\)/.test(camera)&&!camera.includes('Math.max(0,r-.82)*.48'));
check("labels use explicit modes",names.includes('unit.dataset.labelMode = mode')&&css.includes('[data-label-mode="hidden"]'));
check("layer policy supersedes fixed field and path z-indexes",linear.includes('LAYERS?.linearLayer')&&!css.includes('.terrain-layer .linear-terrain-svg { z-index:10!important; }'));
check("roads use irregular ruts and pebbles",linear.includes('linear-road-track-a')&&linear.includes('linear-road-pebble'));
check("stream stones use bank offset",linear.includes('sample.width / 2 + .28'));
check("rail uses shared compact proportions",linear.includes('linear-rail-sleeper-highlight')&&linear.includes('railGauge'));
check("Mokra stream exits table",scenarios.includes('{x:73,y:32.1}')&&scenarios.includes('end:{cap:"off_table"}'));
check("Mokra has haystack cluster",scenarios.includes('haystack-a')&&scenarios.includes('haystack-c'));
console.log(`${passed}/8 L1.3 source checks passed.`);
