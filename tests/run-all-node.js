"use strict";

const path = require("path");
const { execFileSync } = require("child_process");

const tests = [
  "release-integrity.test.js",
  "3d-v070-combat-runtime.test.js",
  "3d-v071-movement-intent.test.js",
  "3d-v072-battle-presentation.test.js",
  "3d-v080-living-infantry.test.js",
  "3d-v081-interaction-and-firefight.test.js",
  "3d-v090-living-battlefield.test.js",
  "3d-v091-port-trust.test.js",
  "3d-v091-scenarios.test.js",
  "3d-v092-ios-touch-recovery.test.js",
  "3d-v093-rules-and-command.test.js",
  "3d-v094-physicality-and-solo.test.js",
  "3d-v094-scenario-validation.test.js",
  "3d-v094a-visual-anchor.test.js",
  "3d-v095-v099.test.js",
  "engine-startup-order.test.js",
  "viewport-interactions-s111.test.js",
  "run-combat-rules-node.js",
  "building-occupancy.test.js",
  "foundation-4b1-source-audit.js",
  "foundation-4b2-source-audit.js",
  "linear-terrain.test.js",
  "objective-rules.test.js",
  "scenario-runtime-s1.test.js",
  "scenario-runtime-s1-source-audit.js",
  "mokra-deployment.test.js",
  "mokra-scenario.test.js",
  "mokra-source-audit.js",
  "mokra-m11-source-audit.js",
  "terrain-footprints.test.js",
  "terrain-e14-source-audit.js",
  "terrain-e15.test.js",
  "terrain-l1-source-audit.js",
  "terrain-l11-source-audit.js",
  "terrain-l13-source-audit.js",
  "scene-compositor.test.js",
  "unit-presentation-integrity.test.js",
  "woodland-generation.test.js",
  "editor-persistence.test.js",
  "editor-shell.test.js",
  "editor-e1.test.js"
];

for (const test of tests) {
  console.log(`\n=== ${test} ===`);
  execFileSync(process.execPath, [path.join(__dirname, test)], {
    stdio: "inherit"
  });
}

console.log("\nPASS — complete Crossroads S1.1.1 Node regression suite passed.");
