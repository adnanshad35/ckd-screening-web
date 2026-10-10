"""Rebuild the website's data from the thesis pipeline.

Reproduces ckd_catboost_screening.ipynb (same columns, split, models and
threshold rule) and writes two files the website loads:

    docs/data/results.js   dataset statistics, model metrics, curves, importances
    docs/data/model.js     the trained CatBoost trees, evaluated in the browser

Run from the project folder:
    .venv\\Scripts\\python.exe build\\build.py
"""
import json
import tempfile
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier, Pool
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, auc, balanced_accuracy_score,
                             confusion_matrix, precision_recall_curve,
                             roc_auc_score, roc_curve)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "data" / "Chronic_Kidney_Dsease_data.csv"
OUT = ROOT / "docs" / "data"

TARGET_COL = "Diagnosis"
DROP_COLS = [
    "PatientID", "DoctorInCharge", "Edema", "Ethnicity", "Statins",
    "Diuretics", "FamilyHistoryHypertension", "ACEInhibitors",
    "UrinaryTractInfections", "AntidiabeticMedications",
    "FamilyHistoryDiabetes", "OccupationalExposureChemicals",
    "PreviousAcuteKidneyInjury", "WaterQuality", "HeavyMetalsExposure",
]
MIN_RECALL = 0.92
HIST_BINS = 10

# Test-set values printed in the thesis notebook (Table 4.3). A rebuilt model that
# does not reproduce its row (library versions change Random Forest and XGBoost
# slightly) is shown on the site with the notebook's figures, and the rebuilt
# figures are kept alongside under "rerun".
_COLS = ["Accuracy", "BalancedAcc", "Sensitivity", "Specificity", "PPV", "NPV", "ROC_AUC", "F1", "FPs", "FNs"]
NOTEBOOK = {name: dict(zip(_COLS, row)) for name, row in {
    "Engineered CatBoost": [0.9277, 0.7660, 0.9605, 0.5714, 0.9605, 0.5714, 0.8210, 0.9605, 6, 6],
    "RandomForest": [0.9157, 0.7594, 0.9474, 0.5714, 0.9600, 0.5000, 0.8313, 0.9536, 6, 8],
    "LogisticRegression": [0.9217, 0.7303, 0.9605, 0.5000, 0.9542, 0.5385, 0.7744, 0.9574, 7, 6],
    "SVM": [0.9096, 0.6913, 0.9539, 0.4286, 0.9477, 0.4615, 0.7914, 0.9508, 8, 7],
    "XGBoost": [0.9458, 0.6786, 1.0000, 0.3571, 0.9441, 1.0000, 0.8341, 0.9712, 9, 0],
}.items()}


def threshold_tuning(y_true, proba_pos, min_recall=MIN_RECALL):
    """Highest balanced accuracy among thresholds that keep CKD recall >= min_recall."""
    thresholds = np.linspace(0.05, 0.95, 181)
    best_bal_acc, best_threshold = None, 0.5
    for t in thresholds:
        y_pred = (proba_pos >= t).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
        recall_pos = tp / (tp + fn + 1e-12)
        recall_neg = tn / (tn + fp + 1e-12)
        bal_acc = (recall_pos + recall_neg) / 2
        if recall_pos >= min_recall and (best_bal_acc is None or bal_acc > best_bal_acc):
            best_bal_acc, best_threshold = bal_acc, t
    return float(best_threshold)


def pr_auc(y_true, proba_pos):
    precision, recall, _ = precision_recall_curve(y_true, proba_pos)
    order = np.argsort(recall)[::-1]
    return float(auc(recall[order], precision[order]))


def metrics_at(y_true, proba, threshold, name):
    y_pred = (proba >= threshold).astype(int)
    tn, fp, fn, tp = (int(v) for v in confusion_matrix(y_true, y_pred).ravel())
    sens = tp / (tp + fn)
    spec = tn / (tn + fp)
    ppv = tp / (tp + fp) if tp + fp else 0.0
    npv = tn / (tn + fn) if tn + fn else 0.0
    return {
        "Model": name,
        "Accuracy": float(accuracy_score(y_true, y_pred)),
        "BalancedAcc": float(balanced_accuracy_score(y_true, y_pred)),
        "Sensitivity": sens,
        "Specificity": spec,
        "PPV": ppv,
        "NPV": npv,
        "ROC_AUC": float(roc_auc_score(y_true, proba)),
        "PR_AUC": pr_auc(y_true, proba),
        "F1": 2 * ppv * sens / (ppv + sens) if ppv + sens else 0.0,
        "Threshold": threshold,
        "TPs": tp, "TNs": tn, "FPs": fp, "FNs": fn,
    }


def r(values, digits=4):
    return [round(float(v), digits) for v in values]


def write_js(path, name, payload):
    path.write_text(f"window.{name} = {json.dumps(payload, separators=(',', ':'))};\n", encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KB)")


def main():
    raw = pd.read_csv(CSV)
    n_raw_cols = raw.shape[1]
    df = raw.drop(columns=[c for c in DROP_COLS if c in raw.columns])

    X = df.drop(columns=[TARGET_COL]).apply(pd.to_numeric, errors="coerce")
    missing = int(X.isna().sum().sum())
    X = X.fillna(X.median())
    y = df[TARGET_COL].astype(int).values
    features = X.columns.tolist()

    X_train, X_vt, y_train, y_vt = train_test_split(
        X, y, train_size=0.70, random_state=42, stratify=y)
    X_valid, X_test, y_valid, y_test = train_test_split(
        X_vt, y_vt, test_size=0.333, random_state=42, stratify=y_vt)

    # ---- Baselines (notebook section 3) ----
    results = []

    def run_baseline(model, name, scale=False):
        tr, va, te = X_train, X_valid, X_test
        if scale:
            scaler = StandardScaler().fit(X_train)
            tr, va, te = scaler.transform(tr), scaler.transform(va), scaler.transform(te)
        model.fit(tr, y_train)
        t = threshold_tuning(y_valid, model.predict_proba(va)[:, 1])
        results.append(metrics_at(y_test, model.predict_proba(te)[:, 1], t, name))

    run_baseline(LogisticRegression(max_iter=5000, class_weight="balanced", random_state=42),
                 "LogisticRegression", scale=True)
    run_baseline(RandomForestClassifier(n_estimators=500, class_weight="balanced",
                                        random_state=42, n_jobs=-1), "RandomForest")
    run_baseline(XGBClassifier(n_estimators=800, learning_rate=0.05, max_depth=5, random_state=42,
                               scale_pos_weight=10.0, n_jobs=-1, eval_metric="logloss"), "XGBoost")
    run_baseline(SVC(probability=True, class_weight="balanced", random_state=42, max_iter=1000),
                 "SVM", scale=True)

    # ---- Engineered CatBoost (notebook section 4) ----
    train_pool = Pool(X_train, y_train)
    valid_pool = Pool(X_valid, y_valid)
    test_pool = Pool(X_test, y_test)
    cb = CatBoostClassifier(
        iterations=4000, learning_rate=0.03, depth=6, l2_leaf_reg=6,
        bagging_temperature=0.6, random_strength=1.0, loss_function="Logloss",
        eval_metric="AUC", auto_class_weights="Balanced", random_seed=42,
        od_type="Iter", od_wait=250, verbose=False, allow_writing_files=False,
    )
    cb.fit(train_pool, eval_set=valid_pool, use_best_model=True)

    proba_valid = cb.predict_proba(valid_pool)[:, 1]
    proba_test = cb.predict_proba(test_pool)[:, 1]
    threshold = threshold_tuning(y_valid, proba_valid)
    cb_metrics = metrics_at(y_test, proba_test, threshold, "Engineered CatBoost")
    results.append(cb_metrics)

    # ---- Check against the notebook ----
    print(f"\nCatBoost best iteration {cb.get_best_iteration()}, threshold {threshold:.3f} (notebook: 59, 0.425)")
    print(f"{'Model':<20} {'BalAcc':>7} {'Sens':>7} {'Spec':>7} {'FP':>3} {'FN':>3}   notebook")
    all_match = True
    for m in results:
        nb = NOTEBOOK[m["Model"]]
        same = all(abs(m[k] - v) < 5e-4 for k, v in nb.items())
        all_match &= same
        print(f"{m['Model']:<20} {m['BalancedAcc']:>7.4f} {m['Sensitivity']:>7.4f} {m['Specificity']:>7.4f} "
              f"{m['FPs']:>3} {m['FNs']:>3}   {'match' if same else 'DIFFERS, site shows notebook values'}")
        if not same:
            m["rerun"] = {k: round(m[k], 4) for k in _COLS}
            m.update(nb)
            m["fromNotebook"] = True
    if cb_metrics.get("fromNotebook"):
        raise SystemExit("The rebuilt CatBoost model does not reproduce the thesis result; "
                         "the site's live prediction would not match the reported metrics.")
    print("All models match the notebook." if all_match else "Some baselines differ from the notebook.")

    # ---- Curves and threshold sweep ----
    fpr, tpr, _ = roc_curve(y_test, proba_test)
    prec, rec, _ = precision_recall_curve(y_test, proba_test)
    sweep = []
    for t in np.linspace(0.05, 0.95, 91):
        pred = (proba_valid >= t).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_valid, pred).ravel()
        sens, spec = tp / (tp + fn), tn / (tn + fp)
        sweep.append([round(float(t), 3), round(sens, 4), round(spec, 4), round((sens + spec) / 2, 4)])

    # ---- Importances (native + SHAP, labelled by the model's own feature order) ----
    native = cb.get_feature_importance(train_pool)
    shap = cb.get_feature_importance(test_pool, type="ShapValues")[:, :-1]
    shap_abs = np.abs(shap).mean(axis=0)
    importance = sorted(
        ({"feature": f, "native": round(float(n), 3), "shap": round(float(s), 4)}
         for f, n, s in zip(features, native, shap_abs)),
        key=lambda d: -d["native"])

    # ---- Dataset description ----
    feature_meta, hists = [], {}
    for f in features:
        col = X[f]
        uniq = np.sort(col.unique())
        discrete = len(uniq) <= 5
        feature_meta.append({
            "name": f, "min": round(float(col.min()), 3), "max": round(float(col.max()), 3),
            "median": round(float(col.median()), 3), "mean": round(float(col.mean()), 3),
            "discrete": discrete, "values": [int(v) for v in uniq] if discrete else None,
            "medianCKD": round(float(col[y == 1].median()), 3),
            "medianNonCKD": round(float(col[y == 0].median()), 3),
        })
        if discrete:
            edges = None
            labels = [int(v) for v in uniq]
            counts = lambda s: [int((s == v).sum()) for v in uniq]
        else:
            edges = np.linspace(col.min(), col.max(), HIST_BINS + 1)
            labels = r(edges, 2)
            counts = lambda s: [int(c) for c in np.histogram(s, bins=edges)[0]]
        hists[f] = {"discrete": discrete, "labels": labels,
                    "ckd": counts(col[y == 1]), "non": counts(col[y == 0])}

    # ---- Example patients for the prediction form (taken from the test set) ----
    test = X_test.assign(_y=y_test, _p=proba_test)
    picks = {
        "Test patient with CKD (model: likely CKD)": test[test._y == 1].sort_values("_p").iloc[-len(test) // 4],
        "Test patient without CKD (model: unlikely)": test[test._y == 0].sort_values("_p").iloc[0],
    }
    examples = [{"label": k, "actual": int(row._y), "probability": round(float(row._p), 4),
                 "values": {f: round(float(row[f]), 3) for f in features}} for k, row in picks.items()]

    OUT.mkdir(parents=True, exist_ok=True)
    write_js(OUT / "results.js", "CKD_RESULTS", {
        "dataset": {
            "records": int(len(df)), "rawColumns": int(n_raw_cols), "features": len(features),
            "dropped": DROP_COLS, "ckd": int((y == 1).sum()), "nonCkd": int((y == 0).sum()),
            "missingValues": missing,
            "split": {"train": [int(len(y_train)), int(y_train.sum())],
                      "valid": [int(len(y_valid)), int(y_valid.sum())],
                      "test": [int(len(y_test)), int(y_test.sum())]},
        },
        "features": feature_meta,
        "hists": hists,
        "models": results,
        "catboost": {
            "bestIteration": int(cb.get_best_iteration()), "trees": int(cb.tree_count_),
            "threshold": round(threshold, 3), "minRecall": MIN_RECALL,
            "roc": {"fpr": r(fpr), "tpr": r(tpr)},
            "pr": {"recall": r(rec), "precision": r(prec)},
            "sweep": sweep,
        },
        "importance": importance,
        "examples": examples,
        "matchesNotebook": bool(all_match),
    })

    # ---- Export the trees for in-browser prediction ----
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "model.json"
        cb.save_model(str(path), format="json")
        exported = json.loads(path.read_text(encoding="utf-8"))
    scale, bias = exported["scale_and_bias"]
    trees = [{"f": [s["float_feature_index"] for s in t["splits"]],
              "b": [s["border"] for s in t["splits"]],
              "v": t["leaf_values"]} for t in exported["oblivious_trees"]]
    write_js(OUT / "model.js", "CKD_MODEL", {
        "features": features, "trees": trees, "scale": scale,
        "bias": bias[0] if isinstance(bias, list) else bias,
        "threshold": round(threshold, 3),
    })

    # Rows used by build/check_parity.js to confirm the browser maths matches CatBoost.
    parity = {"rows": X_test.values.tolist(), "proba": proba_test.tolist()}
    (ROOT / "build" / "parity.json").write_text(json.dumps(parity), encoding="utf-8")


if __name__ == "__main__":
    main()
