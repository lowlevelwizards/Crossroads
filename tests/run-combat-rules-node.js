"use strict";

const path = require("path");
const { execFileSync } = require("child_process");

const tests = [
  "run-shooting-rules-node.js",
  "run-morale-rules-node.js",
  "run-assault-rules-node.js",
  "run-combat-integration-node.js",
  "run-assault-integration-node.js",
  "foundation-4b2-source-audit.js"
];

for (const test of tests) {
  execFileSync(process.execPath, [path.join(__dirname, test)], {
    stdio: "inherit"
  });
}

console.log("PASS — all Foundation 4B.2 combat checks passed.");
