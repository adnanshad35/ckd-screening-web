# CKD Screening website

Web version of the thesis *Engineered CatBoost for Imbalanced Chronic Kidney Disease Screening*
([notebook and data](https://github.com/adnanshad35/ckd-catboost-screening)).

The site is static: three HTML pages with no server. The CatBoost model is exported as
JSON and evaluated in the visitor's browser.

| Page | Purpose |
|---|---|
| `docs/index.html` | About: CKD information, the model (dataset and method) and the report (results, robustness check, limitations) |
| `docs/predict.html` | Check CKD Model: form that runs the trained model and produces a downloadable report |

`build/evaluate.py` produces the robustness check (repeated cross-validation of every
model, written to `docs/data/robust.js`). It takes about an hour and resumes if interrupted.

## View it

Open `docs/index.html` in a browser. No install is needed.

## Rebuild the data

Every number and chart on the site comes from `docs/data/results.js` and
`docs/data/model.js`, which `build/build.py` generates from the dataset.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe build\build.py
node build\check_parity.js
```

`build.py` repeats the notebook's pipeline and prints a comparison with the notebook's
recorded results. `check_parity.js` confirms the browser code gives the same probabilities
as CatBoost in Python.

## Publish on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, open Settings → Pages.
3. Under "Build and deployment", choose "Deploy from a branch", then branch `main` and folder `/docs`.

## Files

```text
data/      the dataset (CSV)
build/     build.py (training + export), check_parity.js
docs/      the website
  assets/  styles, charts, page scripts, feature labels
  data/    generated results.js and model.js
```
