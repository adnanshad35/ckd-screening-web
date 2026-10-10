// Confirms the browser prediction code gives the same probabilities as CatBoost in Python.
// Run after build.py:  node build/check_parity.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["docs/data/model.js", "docs/assets/predict-core.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
}
const { rows, proba } = JSON.parse(fs.readFileSync(path.join(__dirname, "parity.json"), "utf8"));

let worst = 0;
rows.forEach((row, i) => {
  worst = Math.max(worst, Math.abs(ctx.window.ckdPredict(ctx.window.CKD_MODEL, row).probability - proba[i]));
});
console.log(`${rows.length} test rows, largest probability difference: ${worst.toExponential(2)}`);
if (worst > 1e-6) {
  console.error("MISMATCH between browser and Python predictions");
  process.exit(1);
}
console.log("Browser predictions match CatBoost.");
