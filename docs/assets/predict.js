(function () {
  const R = window.CKD_RESULTS, M = window.CKD_MODEL, F = window.CKD_FEATURES;
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
  const inputs = {}, errors = {};
  const touched = new Set();

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
    if (hint) field.appendChild(el("div", "hint", hint));
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
    ["Sample patients", window.CKD_SAMPLES.map((s) => ({ label: s.label, values: { ...typical, ...s.values } }))],
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
  function valueText(name, v) {
    const info = F.info[name];
    return info.options ? info.options[v] : `${v}${info.unit && !info.unit.startsWith("score") ? " " + info.unit : ""}`;
  }

  function valuesTable(title, names, row) {
    const wrap = el("div", "report-values");
    wrap.appendChild(el("h3", "", title));
    const table = el("table");
    names.forEach((name) => {
      const tr = el("tr");
      tr.append(el("td", "", F.info[name].label), el("td", "", valueText(name, row[M.features.indexOf(name)])));
      table.appendChild(tr);
    });
    wrap.appendChild(table);
    return wrap;
  }

  function buildReport(row, adjusted) {
    const { probability, positive } = window.ckdPredict(M, row);
    const body = $("report-body");
    body.replaceChildren();

    body.append(el("h2", "", "CKD screening model report"),
      el("p", "small", `Generated ${new Date().toLocaleString()} · Research demonstration, not a diagnosis`));

    const result = el("div", "report-result");
    result.append(el("div", "small", "Model's estimated probability of CKD"),
      el("div", "prob", (probability * 100).toFixed(1) + "%"));
    const meter = el("div", "meter");
    const fill = el("div", "fill");
    fill.style.width = probability * 100 + "%";
    const mark = el("div", "mark");
    mark.style.left = M.threshold * 100 + "%";
    mark.appendChild(el("span", "", `Threshold ${(M.threshold * 100).toFixed(1)}%`));
    meter.append(fill, mark);
    const verdict = el("div", "verdict " + (positive ? "pos" : "neg"));
    verdict.append(el("span", "icon", positive ? "!" : "✓"), el("span", "", positive ? "Flagged as likely CKD" : "Not flagged"));
    result.append(meter, verdict, el("p", "small", positive
      ? `The estimate is at or above the model's threshold. In testing, ${cb.TPs} of the ${cb.TPs + cb.FPs} profiles it flagged did have CKD.`
      : `The estimate is below the model's threshold. In testing, ${cb.TNs} of the ${cb.TNs + cb.FNs} profiles it did not flag were free of CKD.`));
    body.appendChild(result);

    const contrib = window.ckdContributions(M, row, medians)
      .filter((c) => Math.abs(c.delta) >= 0.0005)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6);
    if (contrib.length) {
      body.append(el("h3", "", "What moved this estimate"),
        el("p", "small", "Change in probability compared with the dataset's typical value for that field. Red raises the estimate, blue lowers it."));
      const grid = el("div", "contrib");
      const scale = Math.max(...contrib.map((c) => Math.abs(c.delta)));
      contrib.forEach((c) => {
        const track = el("div", "track");
        const bar = el("div", "bar " + (c.delta > 0 ? "up" : "down"));
        bar.style.width = (Math.abs(c.delta) / scale) * 50 + "%";
        track.appendChild(bar);
        grid.append(el("div", "", window.ckdLabel(c.name)), track,
          el("div", "v", `${c.delta > 0 ? "+" : "−"}${Math.abs(c.delta * 100).toFixed(1)} pts`));
      });
      body.appendChild(grid);
    }

    const tables = el("div", "report-tables");
    tables.append(valuesTable("Basic information", F.basic, row), valuesTable("Lab data", labs, row),
      valuesTable("Other values used", optional, row));
    body.appendChild(tables);
    if (adjusted) {
      body.appendChild(el("p", "small", "Some optional fields were empty or outside the dataset range, so the typical or nearest valid value was used for them."));
    }
    body.appendChild(el("p", "notice", `This report comes from a research prototype and is not a medical diagnosis. ${caveat} Do not use it to make health decisions; see a doctor for kidney testing.`));
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
  const REPORT_CSS = `
    body{font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0b0b0b;max-width:760px;margin:32px auto;padding:0 16px}
    h2{margin:0 0 4px}h3{font-size:1rem;margin:20px 0 6px}p{margin:0 0 10px}
    .small{font-size:.85rem;color:#52514e}.prob{font-size:2.6rem;font-weight:600;line-height:1.1}
    .meter{position:relative;height:12px;background:#e8f1fd;border-radius:6px;margin:12px 0 22px;max-width:420px}
    .meter .fill{height:100%;background:#2a78d6;border-radius:6px}
    .meter .mark{position:absolute;top:-4px;bottom:-4px;width:2px;background:#0b0b0b}
    .meter .mark span{position:absolute;top:100%;left:50%;transform:translateX(-50%);font-size:.7rem;color:#52514e;white-space:nowrap}
    .verdict{display:flex;gap:10px;align-items:center;font-weight:600;font-size:1.05rem;margin:8px 0 4px}
    .verdict .icon{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:#fff}
    .verdict.pos .icon{background:#d03b3b}.verdict.neg .icon{background:#0ca30c}
    .contrib{display:grid;grid-template-columns:max-content 160px max-content;gap:6px 12px;align-items:center;font-size:.85rem}
    .contrib .track{height:10px;position:relative;background:linear-gradient(#c3c2b7,#c3c2b7) center/1px 100% no-repeat}
    .contrib .bar{position:absolute;top:0;bottom:0}.contrib .bar.up{left:50%;background:#d03b3b}.contrib .bar.down{right:50%;background:#2a78d6}
    .report-tables{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 24px}
    table{border-collapse:collapse;width:100%;font-size:.85rem}td{padding:5px 0;border-bottom:1px solid #e1e0d9}td:last-child{text-align:right;font-weight:600;white-space:nowrap;padding-left:10px}
    .notice{background:#fdf3dc;color:#6b4a00;border-radius:8px;padding:12px 16px;font-size:.9rem;margin-top:20px}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}`;

  $("download").addEventListener("click", () => {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>CKD screening model report</title><style>${REPORT_CSS}</style></head><body>${$("report-body").innerHTML}</body></html>`;
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
})();
