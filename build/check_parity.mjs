// Confirms the browser prediction code gives the same probabilities as CatBoost in Python.
// Run after build.py:  npm run check-model
import fs from "node:fs";
import { ckdPredict } from "../lib/predict-core.js";

const load = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), "utf8"));
const model = load("../lib/data/model.json");
const { rows, proba } = load("./parity.json");

let worst = 0;
rows.forEach((row, i) => {
  worst = Math.max(worst, Math.abs(ckdPredict(model, row).probability - proba[i]));
});
console.log(`${rows.length} test rows, largest probability difference: ${worst.toExponential(2)}`);
if (worst > 1e-6) {
  console.error("MISMATCH between browser and Python predictions");
  process.exit(1);
}
console.log("Browser predictions match CatBoost.");
