// Evaluates the exported CatBoost model (oblivious trees) on one row of feature values.
// `row` is an array in the order of model.features.
window.ckdPredict = function (model, row) {
  let raw = 0;
  for (const tree of model.trees) {
    let leaf = 0;
    for (let i = 0; i < tree.f.length; i++) {
      if (row[tree.f[i]] > tree.b[i]) leaf |= 1 << i;
    }
    raw += tree.v[leaf];
  }
  raw = raw * model.scale + model.bias;
  const probability = 1 / (1 + Math.exp(-raw));
  return { probability, positive: probability >= model.threshold };
};

// Per-feature contribution: how much the probability moves when one value is
// swapped for the dataset median, holding the others fixed.
window.ckdContributions = function (model, row, medians) {
  const base = window.ckdPredict(model, row).probability;
  return model.features.map((name, i) => {
    const swapped = row.slice();
    swapped[i] = medians[i];
    return { name, delta: base - window.ckdPredict(model, swapped).probability };
  });
};
