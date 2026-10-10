# CKD Screening website

Web version of the thesis *Engineered CatBoost for Imbalanced Chronic Kidney Disease Screening*
([notebook and data](https://github.com/adnanshad35/ckd-catboost-screening)).

Built with [Next.js](https://nextjs.org) (App Router). The CatBoost model is exported as
JSON and evaluated in the visitor's browser, so no Python runs on the server.

| Page | Address | Purpose |
|---|---|---|
| About | `/` | CKD information, the model (dataset and method) and the report (results, robustness check, limitations) |
| Check CKD Model | `/check` | Form that runs the trained model and produces a downloadable one-page report |

## Run it locally

Needs [Node.js](https://nodejs.org) 20 or newer.

```powershell
npm install
npm run dev
```

Then open http://localhost:3000. For a production build use `npm run build` and `npm start`.

## Deploy

Import the repository on [Vercel](https://vercel.com). It detects Next.js and needs no settings;
every push to `main` redeploys.

## Project layout

```text
app/          pages: layout.js, page.js (About), check/page.js, globals.css
components/   Header, and the client components that start the charts and the form
lib/          charts, model evaluation, form and report logic, feature labels, examples
lib/data/     generated: results.json, model.json, robust.json
public/img/   photos (credits are on the About page)
data/         the dataset (CSV)
build/        Python scripts that train the model and write lib/data/
```

The charts and the form are drawn by plain JavaScript in `lib/` that runs after the page
loads; the React components in `components/` only start it.

## Rebuild the data

Every number and chart comes from the files in `lib/data/`, which the Python scripts
generate from the dataset. This is only needed after changing the dataset or the model.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r build\requirements.txt
.venv\Scripts\python.exe build\build.py
npm run check-model
```

- `build.py` repeats the notebook's pipeline, prints a comparison with the notebook's
  recorded results and writes `results.json` and `model.json`.
- `npm run check-model` confirms the browser code gives the same probabilities as CatBoost in Python.
- `build\evaluate.py` produces the robustness check (`robust.json`). It takes about an hour
  and resumes if interrupted.
