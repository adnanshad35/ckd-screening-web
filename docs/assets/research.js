(function () {
  const R = window.CKD_RESULTS;
  const { lineChart, columnChart, hbars, dataTable, el } = window.CKDCharts;
  const $ = (id) => document.getElementById(id);
  const css = (name) => `var(--${name})`;
  const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";
  const f3 = (v) => v.toFixed(3);
  const num = (v) => v.toLocaleString("en-US");

  const MODEL_NAMES = {
    LogisticRegression: "Logistic Regression", RandomForest: "Random Forest",
    XGBoost: "XGBoost", SVM: "SVM", "Engineered CatBoost": "Engineered CatBoost",
  };
  const cb = R.models.find((m) => m.Model === "Engineered CatBoost");
  const nTest = R.dataset.split.test[0];
  const nTestNon = nTest - R.dataset.split.test[1];

  function tiles(host, items) {
    items.forEach(([label, value, note]) => {
      const card = el("div", "card tile");
      card.append(el("div", "label", label), el("div", "value", value));
      if (note) card.appendChild(el("div", "note", note));
      host.appendChild(card);
    });
  }

  // ---- Headline and dataset tiles ----
  tiles($("headline-tiles"), [
    ["CKD sensitivity", pct(cb.Sensitivity), `${cb.TPs} of ${cb.TPs + cb.FNs} CKD cases found`],
    ["Specificity", pct(cb.Specificity), `${cb.TNs} of ${nTestNon} non-CKD records cleared`],
    ["Balanced accuracy", pct(cb.BalancedAcc), "Single test split"],
    ["ROC-AUC", f3(cb.ROC_AUC), `Test set, n = ${nTest}`],
  ]);
  tiles($("dataset-tiles"), [
    ["Patient records", num(R.dataset.records)],
    ["Modelling features", String(R.dataset.features), `of ${R.dataset.rawColumns} original columns`],
    ["CKD records", num(R.dataset.ckd), pct(R.dataset.ckd / R.dataset.records)],
    ["Non-CKD records", num(R.dataset.nonCkd), pct(R.dataset.nonCkd / R.dataset.records)],
  ]);
  $("dropped-note").textContent = `${R.dataset.dropped.length} columns were removed before modelling: ${R.dataset.dropped.join(", ")}.`;

  // ---- Class balance (two-part bar with labels) ----
  (function () {
    const host = $("class-balance");
    const bar = el("div", "split");
    [[R.dataset.ckd, "series-1"], [R.dataset.nonCkd, "series-2"]].forEach(([n, c]) => {
      const seg = el("span");
      seg.style.flex = n;
      seg.style.background = css(c);
      bar.appendChild(seg);
    });
    const legend = el("div", "legend");
    legend.style.marginTop = "12px";
    [["CKD", R.dataset.ckd, "series-1"], ["Non-CKD", R.dataset.nonCkd, "series-2"]].forEach(([name, n, c]) => {
      const item = el("span");
      const key = el("i");
      key.style.background = css(c);
      key.style.height = "10px";
      item.append(key, document.createTextNode(`${name}: ${num(n)} (${pct(n / R.dataset.records)})`));
      legend.appendChild(item);
    });
    host.append(bar, legend);
  })();

  // ---- Split table ----
  (function () {
    const t = $("split-table");
    const head = el("tr");
    ["Partition", "Records", "CKD", "Non-CKD", "CKD share"].forEach((h) => head.appendChild(el("th", "", h)));
    t.appendChild(head);
    [["Training", "train"], ["Validation", "valid"], ["Test", "test"]].forEach(([name, key]) => {
      const [n, pos] = R.dataset.split[key];
      const tr = el("tr");
      [name, num(n), num(pos), num(n - pos), pct(pos / n)].forEach((c) => tr.appendChild(el("td", "", c)));
      t.appendChild(tr);
    });
  })();

  // ---- Feature explorer ----
  (function () {
    const select = $("feature-select");
    R.importance.forEach((it) => {
      const o = el("option", "", window.ckdLabel(it.feature));
      o.value = it.feature;
      select.appendChild(o);
    });
    const draw = () => {
      const name = select.value;
      const h = R.hists[name];
      const info = window.CKD_FEATURES.info[name] || {};
      const meta = R.features.find((f) => f.name === name);
      const cats = h.discrete
        ? h.labels.map((v) => (info.options ? info.options[v] : String(v)))
        : h.labels.slice(0, -1).map((lo, i) => `${+lo.toFixed(1)}–${+h.labels[i + 1].toFixed(1)}`);
      const share = (counts, total) => counts.map((c) => c / total);
      const ckd = share(h.ckd, R.dataset.ckd), non = share(h.non, R.dataset.nonCkd);
      $("explore-sub").textContent =
        `Share of each group falling in each range. Median: ${meta.medianCKD} for CKD, ${meta.medianNonCKD} for non-CKD` +
        (info.unit ? ` (${info.unit}).` : ".");
      columnChart($("feature-chart"), {
        cats,
        series: [
          { name: "CKD", color: css("series-1"), vals: ckd },
          { name: "Non-CKD", color: css("series-2"), vals: non },
        ],
        x: { label: info.label || name },
        y: { label: "Share of group", fmt: (v) => pct(v, 0) },
        table: {
          headers: [info.label || name, "CKD records", "CKD share", "Non-CKD records", "Non-CKD share"],
          rows: cats.map((c, i) => [c, h.ckd[i], pct(ckd[i]), h.non[i], pct(non[i])]),
        },
      });
    };
    select.addEventListener("change", draw);
    draw();
  })();

  // ---- Model comparison ----
  (function () {
    const METRICS = [
      ["BalancedAcc", "Balanced accuracy"], ["Sensitivity", "Sensitivity (CKD recall)"],
      ["Specificity", "Specificity"], ["Accuracy", "Accuracy"], ["PPV", "Precision (PPV)"],
      ["NPV", "Negative predictive value"], ["ROC_AUC", "ROC-AUC"], ["F1", "F1-score"],
    ];
    const select = $("metric-select");
    METRICS.forEach(([key, label]) => {
      const o = el("option", "", label);
      o.value = key;
      select.appendChild(o);
    });
    const draw = () => {
      const key = select.value;
      const label = METRICS.find((m) => m[0] === key)[1];
      const sorted = R.models.slice().sort((a, b) => b[key] - a[key]);
      $("compare-sub").textContent = `${label} on the held-out test set (n = ${nTest}), each model at its own validation-tuned threshold`;
      hbars($("compare-chart"), sorted.map((m) => ({
        label: MODEL_NAMES[m.Model], value: m[key], emph: m.Model === "Engineered CatBoost",
      })), { max: 1, fmt: f3 });
    };
    select.addEventListener("change", draw);
    draw();

    const t = $("compare-table");
    const cols = [["Accuracy", f3], ["BalancedAcc", f3], ["Sensitivity", f3], ["Specificity", f3], ["PPV", f3],
      ["NPV", f3], ["ROC_AUC", f3], ["F1", f3], ["FPs", String], ["FNs", String]];
    const head = el("tr");
    ["Model", "Accuracy", "Balanced acc.", "Sensitivity", "Specificity", "PPV", "NPV", "ROC-AUC", "F1",
      "False pos.", "False neg."].forEach((h) => head.appendChild(el("th", "", h)));
    t.appendChild(head);
    R.models.slice().sort((a, b) => b.BalancedAcc - a.BalancedAcc).forEach((m) => {
      const tr = el("tr", m.Model === "Engineered CatBoost" ? "highlight" : "");
      tr.appendChild(el("td", "", MODEL_NAMES[m.Model] + (m.fromNotebook ? " *" : "")));
      cols.forEach(([k, fmt]) => tr.appendChild(el("td", "", fmt(m[k]))));
      t.appendChild(tr);
    });
    const reruns = R.models.filter((m) => m.fromNotebook);
    if (reruns.length) {
      $("compare-note").textContent = "* Figures as recorded in the thesis notebook. Retraining with current library versions gives " +
        reruns.map((m) => `${MODEL_NAMES[m.Model]}: balanced accuracy ${f3(m.rerun.BalancedAcc)}, ${m.rerun.FPs} false positives, ${m.rerun.FNs} false negatives`).join("; ") +
        ". The other three models reproduce exactly.";
    }
  })();

  // ---- Robustness check (repeated cross-validation, build/evaluate.py) ----
  (function () {
    const X = window.CKD_ROBUST;
    if (!X) { $("robustness").hidden = true; return; }
    const D = X.design, P = X.physiology;
    const ref = X.models[0];
    const METRICS = [["BalancedAcc", "Balanced accuracy"], ["ROC_AUC", "ROC-AUC"], ["Sensitivity", "Sensitivity"], ["Specificity", "Specificity"]];
    const pm = (m) => `${f3(m.mean)} ± ${f3(m.sd)}`;
    const li = (host, text) => host.appendChild(el("li", "", text));

    $("robust-intro").textContent =
      `The comparison above rests on one test split holding only ${nTestNon} non-CKD records, where one or two patients change the ranking. ` +
      `To check it, every model was refitted and re-tested ${D.folds} times (${D.splits}-fold cross-validation repeated ${D.repeats} times), ` +
      `each time tuning its threshold on a validation part and scoring about ${D.testSize} unseen records, roughly ${D.nonCkdPerFold} of them non-CKD.`;

    const select = $("robust-metric");
    METRICS.forEach(([key, label]) => {
      const o = el("option", "", label);
      o.value = key;
      select.appendChild(o);
    });
    const draw = () => {
      const key = select.value;
      $("robust-sub").textContent = `Mean ${METRICS.find((m) => m[0] === key)[1].toLowerCase()} over ${D.folds} test folds`;
      hbars($("robust-chart"), X.models.slice().sort((a, b) => b[key].mean - a[key].mean).map((m) => ({
        label: m.Model, value: m[key].mean, emph: m === ref,
      })), { max: 1, fmt: f3 });
    };
    select.addEventListener("change", draw);
    draw();

    const t = $("robust-table");
    const head = el("tr");
    ["Model", "ROC-AUC", "Balanced acc.", "Sensitivity", "Specificity", "Difference (p)"].forEach((h) => head.appendChild(el("th", "", h)));
    t.appendChild(head);
    X.models.forEach((m) => {
      const tr = el("tr", m === ref ? "highlight" : "");
      const vs = m.vsThesis_BalancedAcc;
      [m.Model, pm(m.ROC_AUC), pm(m.BalancedAcc), pm(m.Sensitivity), pm(m.Specificity),
        vs ? `${Math.abs(vs.diff) < 0.0005 ? "" : vs.diff > 0 ? "+" : "−"}${Math.abs(vs.diff).toFixed(3)} (p = ${vs.p.toFixed(2)})` : "reference",
      ].forEach((c) => tr.appendChild(el("td", "", c)));
      t.appendChild(tr);
    });

    const by = (name) => X.models.find((m) => m.Model.startsWith(name));
    const rf = by("Random Forest"), xgb = by("XGBoost (corrected"), xgbOld = by("XGBoost (thesis"),
      lr = by("Logistic"), svm = by("SVM"), all = by("CatBoost (all"), plain = by("CatBoost (no class");
    const findings = $("robust-findings");
    li(findings, `CatBoost, Random Forest and XGBoost perform the same: balanced accuracy ${f3(ref.BalancedAcc.mean)}, ${f3(rf.BalancedAcc.mean)} and ${f3(xgb.BalancedAcc.mean)}, with no significant difference (p = ${rf.vsThesis_BalancedAcc.p.toFixed(2)} and ${xgb.vsThesis_BalancedAcc.p.toFixed(2)}). The data do not support ranking CatBoost above them.`);
    li(findings, `Logistic Regression and SVM are weaker on balanced accuracy (${f3(lr.BalancedAcc.mean)} and ${f3(svm.BalancedAcc.mean)}; p = ${lr.vsThesis_BalancedAcc.p.toFixed(2)} and ${svm.vsThesis_BalancedAcc.p.toFixed(2)}), because they clear fewer non-CKD records.`);
    li(findings, `XGBoost in the thesis was held back by its class weight (scale_pos_weight = 10), which favoured CKD, already the majority class. With the weight corrected its specificity rises from ${f3(xgbOld.Specificity.mean)} to ${f3(xgb.Specificity.mean)}.`);
    li(findings, `Dropping the fifteen columns made no measurable difference: CatBoost on all columns scores ${f3(all.BalancedAcc.mean)} (p = ${all.vsThesis_BalancedAcc.p.toFixed(2)}). Neither did removing the class weights (${f3(plain.BalancedAcc.mean)}, p = ${plain.vsThesis_BalancedAcc.p.toFixed(2)}).`);
    li(findings, `Expected performance of the CatBoost pipeline on new records from this dataset: sensitivity ${f3(ref.Sensitivity.mean)}, specificity ${f3(ref.Specificity.mean)}, ROC-AUC ${f3(ref.ROC_AUC.mean)}.`);

    const rule = X.rules[0];
    const data = $("robust-data");
    li(data, `The measurements are unrelated to one another. Serum creatinine and GFR, which move in opposite directions in any real patient, have a rank correlation of ${P.creatinine_gfr.toFixed(3)}; systolic and diastolic blood pressure, ${P.systolic_diastolic.toFixed(3)}; LDL and total cholesterol, ${P.ldl_total_cholesterol.toFixed(3)}.`);
    li(data, `${P.impossible} records combine a serum creatinine above 3 mg/dL with a GFR above 90, which does not occur clinically.`);
    li(data, `The diagnosis label barely follows kidney function: ${pct(P.ckdShareGfrOver90)} of records with a normal GFR (90 or more) are labelled CKD, against ${pct(P.ckdShareGfrUnder60)} of those below 60.`);
    li(data, `The standard clinical rule (GFR below 60 or ACR of 30 or more) reaches a balanced accuracy of only ${f3(rule.BalancedAcc)} here, close to guessing.`);
    li(data, "Together these indicate the values were generated independently rather than measured from patients. The results describe this dataset and should not be read as performance on real people.");

    const cal = X.calibration[ref.Model];
    $("lim-data").textContent = `The dataset does not behave like patient data: its measurements are statistically independent of each other (creatinine and GFR correlate at ${P.creatinine_gfr.toFixed(3)}), so findings may not transfer to real patients.`;
    $("lim-rank").textContent = `Under repeated cross-validation CatBoost is not distinguishable from Random Forest or a correctly weighted XGBoost. Its score is also not a calibrated probability: it averages ${pct(cal.meanPredicted, 0)} where ${pct(R.dataset.ckd / R.dataset.records, 0)} of records are CKD.`;
  })();

  // ---- CatBoost detail ----
  tiles($("catboost-tiles"), [
    ["Decision threshold", R.catboost.threshold.toFixed(3), `Sensitivity kept ≥ ${R.catboost.minRecall}`],
    ["Precision (PPV)", pct(cb.PPV)],
    ["Negative predictive value", pct(cb.NPV)],
    ["PR-AUC", f3(cb.PR_AUC)],
  ]);

  (function () {
    $("cm-sub").textContent = `Test set, n = ${nTest}, threshold ${R.catboost.threshold.toFixed(3)}`;
    const cm = $("cm");
    const cell = (n, label, ok) => {
      const c = el("div", "cell" + (ok ? " ok" : ""));
      c.append(el("b", "", String(n)), document.createTextNode(label));
      return c;
    };
    cm.append(
      el("div", "h", ""), el("div", "h", "Predicted non-CKD"), el("div", "h", "Predicted CKD"),
      el("div", "h", "Actual non-CKD"), cell(cb.TNs, "True negative", true), cell(cb.FPs, "False positive"),
      el("div", "h", "Actual CKD"), cell(cb.FNs, "False negative"), cell(cb.TPs, "True positive", true),
    );
    $("cm-note").textContent = `${cb.FNs} CKD cases were missed and ${cb.FPs} of the ${nTestNon} non-CKD records were flagged.`;
    $("lim-test").textContent = `The test set contains only ${nTestNon} non-CKD records, so the specificity and negative predictive value estimates are uncertain.`;
  })();

  lineChart($("sweep-chart"), {
    series: [
      { name: "Sensitivity", color: css("series-1"), pts: R.catboost.sweep.map((s) => [s[0], s[1]]) },
      { name: "Specificity", color: css("series-2"), pts: R.catboost.sweep.map((s) => [s[0], s[2]]) },
      { name: "Balanced accuracy", color: css("series-3"), pts: R.catboost.sweep.map((s) => [s[0], s[3]]) },
    ],
    x: { domain: [0.05, 0.95], label: "Threshold", fmt: (v) => v.toFixed(2) },
    y: { domain: [0, 1], label: "Score", fmt: (v) => v.toFixed(1) },
    vline: { x: R.catboost.threshold, label: `Chosen: ${R.catboost.threshold.toFixed(3)}` },
    table: {
      headers: ["Threshold", "Sensitivity", "Specificity", "Balanced accuracy"],
      rows: R.catboost.sweep.filter((_, i) => i % 5 === 0).map((s) => [s[0].toFixed(2), f3(s[1]), f3(s[2]), f3(s[3])]),
    },
  });

  $("roc-sub").textContent = `Test set, AUC = ${f3(cb.ROC_AUC)}. The diagonal is a random guess.`;
  lineChart($("roc-chart"), {
    series: [{ name: "True positive rate", color: css("series-1"), pts: R.catboost.roc.fpr.map((x, i) => [x, R.catboost.roc.tpr[i]]) }],
    x: { domain: [0, 1], label: "False positive rate", fmt: (v) => v.toFixed(2) },
    y: { domain: [0, 1], label: "True positive rate", fmt: (v) => v.toFixed(2) },
    diagonal: true,
    table: { headers: ["False positive rate", "True positive rate"], rows: R.catboost.roc.fpr.map((x, i) => [f3(x), f3(R.catboost.roc.tpr[i])]) },
  });

  $("pr-sub").textContent = `Test set, AUC = ${f3(cb.PR_AUC)}`;
  (function () {
    const pts = R.catboost.pr.recall.map((x, i) => [x, R.catboost.pr.precision[i]]).reverse();
    const lo = Math.floor(Math.min(...pts.map((p) => p[1])) * 20) / 20;
    lineChart($("pr-chart"), {
      series: [{ name: "Precision", color: css("series-1"), pts }],
      x: { domain: [0, 1], label: "Recall", fmt: (v) => v.toFixed(2) },
      y: { domain: [lo, 1], label: "Precision", fmt: (v) => v.toFixed(2) },
      table: { headers: ["Recall", "Precision"], rows: pts.filter((_, i) => i % 5 === 0).map((p) => [f3(p[0]), f3(p[1])]) },
    });
  })();

  // ---- Importance ----
  (function () {
    const buttons = [...$("imp-toggle").querySelectorAll("button")];
    const draw = (key) => {
      const sorted = R.importance.slice().sort((a, b) => b[key] - a[key]);
      const top = sorted.slice(0, 12);
      const fmt = key === "native" ? (v) => v.toFixed(1) + "%" : (v) => v.toFixed(3);
      $("imp-sub").textContent = key === "native"
        ? "Top 12 by CatBoost's built-in importance (share of total, all features sum to 100%)"
        : "Top 12 by mean absolute SHAP value on the test set (log-odds units)";
      hbars($("imp-chart"), top.map((it) => ({ label: window.ckdLabel(it.feature), value: it[key] })),
        { max: top[0][key], fmt, single: true });
      $("imp-table").replaceChildren();
      dataTable($("imp-table"), ["Feature", "CatBoost importance", "Mean |SHAP|"],
        sorted.map((it) => [window.ckdLabel(it.feature), it.native.toFixed(2) + "%", it.shap.toFixed(4)]));
    };
    buttons.forEach((b) => b.addEventListener("click", () => {
      buttons.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      draw(b.dataset.key);
    }));
    draw("native");
  })();
})();
