// Builds the Check CKD Model form, runs the model and renders the report.
import RESULTS from "./data/results.json";
import MODEL from "./data/model.json";
import { FEATURES, ckdLabel } from "./features";
import { SAMPLES } from "./examples";
import { ckdPredict, ckdContributions } from "./predict-core";

export function initCheck() {
  // The markup is rendered by React; wire it up once per mount.
  const mount = document.getElementById("form");
  if (!mount || mount.dataset.ready) return;
  mount.dataset.ready = "1";
  const R = RESULTS, M = MODEL, F = FEATURES;
  const LAB_COUNT = 10;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const meta = Object.fromEntries(R.features.map((f) => [f.name, f]));
  const medians = M.features.map((name) => meta[name].median);
  const typical = Object.fromEntries(M.features.map((name, i) => [name, medians[i]]));
  const cb = R.models.find((m) => m.Model === "Engineered CatBoost");
  const nNon = cb.TNs + cb.FPs;
  // Two required sections: basic information, and the ten laboratory values the
  // model weights most (R.importance is sorted by importance). The rest are optional.
  const labs = R.importance.map((it) => it.feature).filter((f) => F.labs.includes(f)).slice(0, LAB_COUNT);
  const required = F.basic.concat(labs);
  const optional = M.features.filter((f) => !required.includes(f));
  const inputs = {}, errors = {}, hints = {};
  const touched = new Set();

  const ckdShare = Math.round((R.dataset.ckd / R.dataset.records) * 100);
  const caveat =
    `The model was trained on one dataset in which ${Math.round((R.dataset.ckd / R.dataset.records) * 100)}% of records are CKD cases, ` +
    `so it flags most profiles. In testing it wrongly flagged ${cb.FPs} of ${nNon} people without CKD and missed ${cb.FNs} of ${cb.TPs + cb.FNs} with it.`;
  $("caveat").textContent = caveat;

  // ---- Build the form ----
  function buildField(name, isRequired) {
    const info = F.info[name], m = meta[name];
    const field = el("div", "field");
    const label = el("label", "", info.label);
    label.htmlFor = "f-" + name;
    if (info.unit) label.append(" ", el("span", "unit", `(${info.unit})`));
    if (isRequired) label.append(" ", el("span", "req", "*"));
    let input, hint;
    if (info.options) {
      input = el("select");
      if (isRequired) {
        const blank = el("option", "", "Select…");
        blank.value = "";
        input.appendChild(blank);
      }
      Object.entries(info.options).forEach(([value, text]) => {
        const o = el("option", "", text);
        o.value = value;
        input.appendChild(o);
      });
    } else {
      input = el("input");
      input.type = "number";
      input.min = Math.floor(m.min * 10) / 10;
      input.max = Math.ceil(m.max * 10) / 10;
      input.step = info.step || 0.1;
      input.inputMode = "decimal";
      hint = `Dataset range ${input.min}–${input.max}`;
    }
    input.id = "f-" + name;
    input.required = isRequired;
    input.addEventListener("input", onEdit);
    input.addEventListener("blur", () => { touched.add(name); refresh(); });
    inputs[name] = input;
    field.append(label, input);
    // Every field carries one line under its control so that rows stay level.
    hints[name] = el("div", "hint", hint || "Choose one");
    field.appendChild(hints[name]);
    if (isRequired) {
      errors[name] = el("div", "error");
      errors[name].hidden = true;
      field.appendChild(errors[name]);
    }
    return field;
  }

  function buildGroup(title, fields, isRequired) {
    const fs = el("fieldset");
    fs.appendChild(el("legend", "", title));
    const grid = el("div", "fields");
    fields.forEach((name) => grid.appendChild(buildField(name, isRequired)));
    fs.appendChild(grid);
    return fs;
  }

  const form = $("form");
  const submitRow = $("submit-row");
  [["1. Basic information", F.basic, "Things you know about yourself. Every field is required."],
    ["2. Lab data", labs, `The ${LAB_COUNT} blood and urine test values the model relies on most, from a lab report. Every field is required.`],
  ].forEach(([title, fields, note]) => {
    const group = buildGroup(title, fields, true);
    group.insertBefore(el("p", "small", note), group.children[1]);
    form.insertBefore(group, submitRow);
  });

  const optionalGroups = F.groups
    .map((g) => ({ title: g.title, fields: g.fields.filter((f) => optional.includes(f)) }))
    .filter((g) => g.fields.length);
  const more = el("details", "more");
  const summary = el("summary");
  summary.append(el("span", "", `More details (${optional.length} optional fields)`),
    el("span", "small", "Typical values are used unless you change them"));
  more.appendChild(summary);
  optionalGroups.forEach((g) => more.appendChild(buildGroup(g.title, g.fields, false)));
  form.insertBefore(more, submitRow);

  const format = (name, v) => (F.info[name].options ? Math.round(v) : +(+v).toFixed(F.info[name].step === 1 ? 0 : 1));

  function setValues(values, names) {
    names.forEach((name) => { inputs[name].value = values[name] == null ? "" : format(name, values[name]); });
    onEdit();
  }

  // ---- Starting points ----
  // Thesis test-set records fill every field; sample patients fill the required
  // sections and leave the optional fields at typical values.
  const exampleSets = [
    ["Sample patients", SAMPLES.map((s) => ({ label: s.label, values: { ...typical, ...s.values } }))],
    ["From the thesis test set", R.examples],
  ];
  const picker = $("example-select");
  const loaders = [];
  exampleSets.forEach(([title, list]) => {
    const group = el("optgroup");
    group.label = title;
    list.forEach((ex) => {
      const o = el("option", "", ex.label);
      o.value = loaders.push(ex.values) - 1;
      group.appendChild(o);
    });
    picker.appendChild(group);
  });
  picker.addEventListener("change", () => {
    if (picker.value === "") return;
    touched.clear();
    setValues(loaders[picker.value], M.features);
  });
  $("clear").addEventListener("click", () => {
    picker.value = "";
    touched.clear();
    setValues({}, required);
    setValues(typical, optional);
  });

  // Returns the model row, plus the required fields still missing or out of range.
  function readRow() {
    const problems = [];
    let adjusted = false;
    const row = M.features.map((name, i) => {
      const input = inputs[name], isRequired = required.includes(name);
      const v = parseFloat(input.value);
      let message = "";
      if (Number.isNaN(v)) message = "Required";
      else if (input.type === "number" && (v < +input.min || v > +input.max)) message = `Enter a value from ${input.min} to ${input.max}`;
      if (isRequired) {
        if (message) problems.push(name);
        const show = message && touched.has(name);
        errors[name].hidden = !show;
        hints[name].hidden = Boolean(show);
        errors[name].textContent = message;
        input.setAttribute("aria-invalid", String(Boolean(show)));
        return v;
      }
      if (!message) return v;
      adjusted = true;
      return Number.isNaN(v) ? medians[i] : Math.min(Math.max(v, +input.min), +input.max);
    });
    return { row, problems, adjusted };
  }

  // Updates field errors and the line beside the submit button.
  function refresh(message) {
    const state = readRow();
    const left = state.problems.length;
    $("status").textContent = message || (left
      ? `${required.length - left} of ${required.length} required fields completed.`
      : "All required fields completed.");
    return state;
  }

  function onEdit() {
    const hadReport = !$("report").hidden;
    $("report").hidden = true;
    refresh(hadReport ? "Values changed. Submit again to update the report." : "");
  }

  // ---- Report ----
  // The report is styled as a printed document. One stylesheet serves the page,
  // the downloaded file and the printout.
  const REPORT_CSS = `
    .paper{background:#fff;color:#0f172a;font:14px/1.5 var(--font-inter,"Inter"),system-ui,-apple-system,"Segoe UI",sans-serif;padding:36px 44px;border-radius:6px}
    .paper *{box-sizing:border-box}
    .paper h2{font-size:1.45rem;margin:0;letter-spacing:-.02em}
    .paper h3{font-size:.76rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1d4ed8;margin:18px 0 6px;padding-bottom:5px;border-bottom:2px solid #1d4ed8}
    .paper p{margin:0 0 8px}
    .paper .muted{color:#64748b;font-size:.82rem}
    .paper .head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #0f172a;padding-bottom:16px}
    .paper .org{display:flex;gap:12px;align-items:center}
    .paper .logo{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:#fff;font-weight:800;background:linear-gradient(135deg,#2563eb,#1baf7a);flex:none}
    .paper .meta{text-align:right;font-size:.82rem;color:#475569;white-space:nowrap}
    .paper .meta b{color:#0f172a}
    .paper .patient{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 20px;background:#f6f7fb;border-radius:10px;padding:10px 18px;margin-top:14px}
    .paper .patient span{display:block;font-size:.72rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
    .paper .patient b{font-size:.98rem}
    .paper .status{display:grid;grid-template-columns:1fr auto;gap:6px 28px;align-items:center;border-radius:12px;padding:14px 20px;margin-top:14px;border:2px solid}
    .paper .status.pos{background:#fdecec;border-color:#d03b3b}
    .paper .status.neg{background:#e9f8ee;border-color:#12924a}
    .paper .status .label{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#475569}
    .paper .status .value{display:flex;gap:10px;align-items:center;font-size:1.55rem;font-weight:800;letter-spacing:-.02em}
    .paper .status.pos .value{color:#a61e1e}.paper .status.neg .value{color:#0b6b35}
    .paper .status .dot{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:1rem;flex:none}
    .paper .status.pos .dot{background:#d03b3b}.paper .status.neg .dot{background:#12924a}
    .paper .status .score{text-align:right}
    .paper .status .score b{display:block;font-size:1.9rem;font-weight:800;line-height:1.1}
    .paper .status .detail{grid-column:1/-1;font-size:.88rem;color:#334155}
    .paper .meter{position:relative;height:10px;background:#e2e8f0;border-radius:5px;margin:14px 0 26px;max-width:none}
    .paper .meter .fill{height:100%;background:#2a78d6;border-radius:5px}
    .paper .meter .mark{position:absolute;top:-4px;bottom:-4px;width:2px;background:#0f172a}
    .paper .meter .mark span{position:absolute;top:100%;left:50%;transform:translateX(-50%);font-size:.68rem;color:#475569;white-space:nowrap}
    .paper table{border-collapse:collapse;width:100%;font-size:.88rem}
    .paper th{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:#64748b;text-align:left;padding:6px 10px;border-bottom:1px solid #cbd2de;font-weight:700;background:none}
    .paper td{padding:5px 10px;border-bottom:1px solid #e6e9f0;text-align:left;white-space:normal;font-variant-numeric:tabular-nums}
    .paper td.num,.paper th.num{text-align:right}
    .paper td.res{font-weight:700}
    .paper tr.out td.res{color:#a61e1e}
    .paper .flag{display:inline-block;min-width:44px;text-align:center;font-size:.72rem;font-weight:700;border-radius:999px;padding:2px 8px}
    .paper .flag.h,.paper .flag.l{background:#fdecec;color:#a61e1e}
    .paper .flag.n{background:#e9f8ee;color:#0b6b35}
    .paper .two{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;align-items:start}
    .paper .contrib{display:grid;grid-template-columns:minmax(0,max-content) minmax(60px,1fr) max-content;gap:6px 12px;align-items:center;font-size:.88rem}
    .paper .contrib .track{height:10px;position:relative;background:linear-gradient(#cbd2de,#cbd2de) center/1px 100% no-repeat}
    .paper .contrib .bar{position:absolute;top:0;bottom:0}
    .paper .contrib .bar.up{left:50%;background:#d03b3b;border-radius:0 3px 3px 0}
    .paper .contrib .bar.down{right:50%;background:#2a78d6;border-radius:3px 0 0 3px}
    .paper .note{background:#fff6e0;color:#6b4a00;border-radius:10px;padding:9px 14px;font-size:.8rem;margin-top:14px}
    .paper .foot{display:flex;justify-content:space-between;gap:16px;border-top:1px solid #cbd2de;margin-top:14px;padding-top:8px;font-size:.72rem;color:#64748b}
    @media (max-width:640px){.paper{padding:22px 18px}.paper .patient{grid-template-columns:1fr 1fr}.paper .two{grid-template-columns:1fr}.paper .head{flex-direction:column}.paper .meta{text-align:left}.paper .status{grid-template-columns:1fr}.paper .status .score{text-align:left}}
    @page{size:A4;margin:11mm}@media print{.paper{padding:0;zoom:.7;border-radius:0}.paper h3{margin:14px 0 5px}.paper td{padding:4px 10px}.paper .two{grid-template-columns:1fr 1fr!important}.paper .patient{grid-template-columns:repeat(4,1fr)!important}.paper .head{flex-direction:row!important}.paper .meta{text-align:right!important}.paper *{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
  if (!document.getElementById("report-css")) {
    const style = el("style", "", REPORT_CSS);
    style.id = "report-css";
    document.head.appendChild(style);
  }
  $("report-body").className = "paper";

  // Optional name, shown on the report only.
  const nameField = el("div", "field");
  nameField.style.gridColumn = "1 / -1";
  const nameLabel = el("label", "", "Name for the report ");
  nameLabel.htmlFor = "patient-name";
  nameLabel.appendChild(el("span", "unit", "(optional, stays on this device)"));
  const nameInput = el("input");
  nameInput.type = "text";
  nameInput.id = "patient-name";
  nameInput.maxLength = 60;
  nameInput.autocomplete = "off";
  nameInput.addEventListener("input", onEdit);
  nameField.append(nameLabel, nameInput);
  form.querySelector(".fields").prepend(nameField);

  const val = (row, name) => row[M.features.indexOf(name)];
  const shown = (name, v) => (F.info[name].options ? F.info[name].options[v] : String(v));
  const unitOf = (name) => F.info[name].unit || "";

  // Reference range for a value: { text, flag } where flag is "High", "Low" or "".
  function reference(name, v, row) {
    let r = F.ref[name];
    if (!r) return null;
    if (r.male) r = val(row, "Gender") === 1 ? r.female : r.male;
    if (r.below != null) return { text: `< ${r.below}`, flag: v >= r.below ? "High" : "" };
    if (r.atLeast != null) return { text: `≥ ${r.atLeast}`, flag: v < r.atLeast ? "Low" : "" };
    return { text: `${r.lo} – ${r.hi}`, flag: v < r.lo ? "Low" : v > r.hi ? "High" : "" };
  }

  function gfrStage(gfr) {
    return gfr >= 90 ? "G1 (normal)" : gfr >= 60 ? "G2 (mildly reduced)" : gfr >= 45 ? "G3a (mild to moderate)"
      : gfr >= 30 ? "G3b (moderate to severe)" : gfr >= 15 ? "G4 (severely reduced)" : "G5 (kidney failure)";
  }

  function table(headers, rows) {
    const t = el("table");
    const head = el("tr");
    headers.forEach(([text, cls]) => head.appendChild(el("th", cls || "", text)));
    t.appendChild(head);
    rows.forEach(({ cells, out }) => {
      const tr = el("tr", out ? "out" : "");
      cells.forEach((c) => {
        if (c instanceof Node) { const td = el("td"); td.appendChild(c); tr.appendChild(td); } else tr.appendChild(el("td", c[1] || "", c[0]));
      });
      t.appendChild(tr);
    });
    return t;
  }

  function labRows(names, row) {
    return names.map((name) => {
      const v = val(row, name), ref = reference(name, v, row);
      const flag = el("span", "flag " + (ref && ref.flag ? ref.flag[0].toLowerCase() : "n"), ref ? ref.flag || "Normal" : "–");
      return { out: Boolean(ref && ref.flag), cells: [[F.info[name].label], [shown(name, v), "num res"], [unitOf(name)], [ref ? ref.text : "–"], flag] };
    });
  }

  function plainRows(names, row) {
    return names.map((name) => {
      const unit = unitOf(name), v = shown(name, val(row, name));
      // "score 0–10" reads better as "7 / 10".
      const text = F.info[name].options ? v : unit.startsWith("score") ? `${v} / ${unit.split("–")[1]}` : `${v} ${unit}`;
      return { cells: [[F.info[name].label], [text, "res"]] };
    });
  }

  function buildReport(row, adjusted) {
    const { probability, positive } = ckdPredict(M, row);
    const body = $("report-body");
    body.replaceChildren();
    const now = new Date();
    const id = `CKD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
    const score = (probability * 100).toFixed(1) + "%";
    const gfr = val(row, "GFR");

    // Header
    const head = el("div", "head");
    const org = el("div", "org");
    const title = el("div");
    title.append(el("h2", "", "CKD Screening Report"), el("div", "muted", "Machine-learning screening model · research prototype"));
    org.append(el("div", "logo", "CK"), title);
    const metaBox = el("div", "meta");
    [["Report ID", id], ["Date", now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })],
      ["Time", now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })]].forEach(([k, v]) => {
      const line = el("div", "", k + ": ");
      line.appendChild(el("b", "", v));
      metaBox.appendChild(line);
    });
    head.append(org, metaBox);
    body.appendChild(head);

    // Person
    const patient = el("div", "patient");
    [["Name", nameInput.value.trim() || "Not provided"], ["Age", `${val(row, "Age")} years`],
      ["Gender", shown("Gender", val(row, "Gender"))], ["BMI", `${val(row, "BMI")} kg/m²`]].forEach(([k, v]) => {
      const cell = el("div");
      cell.append(el("span", "", k), el("b", "", v));
      patient.appendChild(cell);
    });
    body.appendChild(patient);

    // Status
    const status = el("div", "status " + (positive ? "pos" : "neg"));
    const left = el("div");
    const value = el("div", "value");
    value.append(el("span", "dot", positive ? "!" : "✓"), el("span", "", positive ? "CKD likely" : "CKD not indicated"));
    left.append(el("div", "label", "Screening status"), value);
    const right = el("div", "score");
    right.append(el("div", "label", "Model score"), el("b", "", score));
    const gap = Math.abs(probability - M.threshold);
    const detail = el("div", "detail",
      (positive
        ? `The model score is at or above the decision threshold of ${(M.threshold * 100).toFixed(1)}%, so this profile is flagged for follow-up.`
        : `The model score is below the decision threshold of ${(M.threshold * 100).toFixed(1)}%, so this profile is not flagged.`) +
      (gap < 0.05 ? " The score is close to the threshold, so treat this status as borderline." : "") +
      ` Kidney function by the entered GFR of ${gfr}: stage ${gfrStage(gfr)}.`);
    status.append(left, right, detail);
    body.appendChild(status);

    const meter = el("div", "meter");
    const fill = el("div", "fill");
    fill.style.width = probability * 100 + "%";
    const mark = el("div", "mark");
    mark.style.left = M.threshold * 100 + "%";
    mark.appendChild(el("span", "", `Threshold ${(M.threshold * 100).toFixed(1)}%`));
    meter.append(fill, mark);
    body.appendChild(meter);

    // Laboratory results
    const labResults = labRows(labs, row);
    const outCount = labResults.filter((r) => r.out).length;
    body.append(el("h3", "", "Laboratory results"),
      table([["Test"], ["Result", "num"], ["Unit"], ["Reference range"], ["Flag"]], labResults),
      el("p", "muted", `${outCount} of ${labs.length} results are outside the reference range. Ranges are typical adult values; individual laboratories differ.`));
    body.lastChild.style.marginTop = "8px";

    // Clinical information beside the factors, to keep the report to one page
    const two = el("div", "two");
    const clinical = el("div"), factors = el("div");
    two.append(clinical, factors);
    body.appendChild(two);
    const basics = F.basic.filter((n) => !["Age", "Gender", "BMI"].includes(n));
    clinical.append(el("h3", "", "Clinical and lifestyle information"), table([["Item"], ["Value"]], plainRows(basics, row)));

    const contrib = ckdContributions(M, row, medians)
      .filter((c) => Math.abs(c.delta) >= 0.0005)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6);
    factors.appendChild(el("h3", "", "Factors behind the score"));
    if (contrib.length) {
      factors.appendChild(el("p", "muted", "Change in the score compared with a typical value for that field. Red raises the score, blue lowers it."));
      const grid = el("div", "contrib");
      const scale = Math.max(...contrib.map((c) => Math.abs(c.delta)));
      contrib.forEach((c) => {
        const track = el("div", "track");
        const bar = el("div", "bar " + (c.delta > 0 ? "up" : "down"));
        bar.style.width = (Math.abs(c.delta) / scale) * 50 + "%";
        track.appendChild(bar);
        grid.append(el("div", "", ckdLabel(c.name)), track,
          el("div", "", `${c.delta > 0 ? "+" : "−"}${Math.abs(c.delta * 100).toFixed(1)} pts`));
      });
      factors.appendChild(grid);
    } else {
      factors.appendChild(el("p", "muted", "No single value stands out from the typical profile."));
    }

    // Other values, as one compact line
    body.append(el("h3", "", "Other values used by the model"),
      el("p", "muted", plainRows(optional, row).map((r) => `${r.cells[0][0]} ${r.cells[1][0]}`).join(" · ") +
        ". Typical dataset values unless changed under More details." +
        (adjusted ? " Some were empty or out of range, so the typical or nearest valid value was used." : "")));

    // Interpretation
    body.append(el("h3", "", "Interpretation"),
      el("p", "", positive
        ? "This profile resembles records labelled CKD in the model's training data. A flag is a reason to discuss kidney testing (a blood test for eGFR and a urine test for ACR) with a doctor. It is not a diagnosis."
        : "This profile does not resemble records labelled CKD in the model's training data. That does not rule out kidney disease; anyone with diabetes, high blood pressure or a family history of kidney disease should still be tested regularly."),
      el("p", "muted", `Model performance in testing: of ${cb.TPs + cb.FNs} people with CKD it flagged ${cb.TPs}; of ${nNon} people without CKD it cleared ${cb.TNs}. The score is the model's output, not a personal probability of disease.`));

    body.appendChild(el("p", "note", `Research demonstration, not a medical document. ${caveat} Do not use this report to make health decisions.`));
    const foot = el("div", "foot");
    foot.append(el("span", "", `Report ${id} · generated automatically, not reviewed by a clinician`), el("span", "", "CKD Screening · undergraduate thesis project"));
    body.appendChild(foot);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    required.forEach((name) => touched.add(name));
    const { row, problems, adjusted } = refresh();
    if (problems.length) {
      $("status").textContent = `${problems.length} required ${problems.length === 1 ? "field needs" : "fields need"} a valid value.`;
      inputs[problems[0]].focus();
      return;
    }
    buildReport(row, adjusted);
    $("report").hidden = false;
    $("report").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---- Download / print ----
  $("download").addEventListener("click", () => {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>CKD Screening Report</title><style>body{margin:0;background:#eef1f6;padding:24px 12px}.paper{max-width:860px;margin:0 auto;box-shadow:0 8px 30px rgba(15,23,42,.12)}@media print{body{background:#fff;padding:0}.paper{box-shadow:none}}${REPORT_CSS}</style></head>` +
      `<body><div class="paper">${$("report-body").innerHTML}</div></body></html>`;
    const link = el("a");
    link.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    link.download = `ckd-screening-report-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  $("print").addEventListener("click", () => window.print());
  $("edit").addEventListener("click", () => form.scrollIntoView({ behavior: "smooth", block: "start" }));

  setValues(typical, optional);
}
