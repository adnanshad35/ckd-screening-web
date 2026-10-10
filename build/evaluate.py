"""Robust evaluation of the thesis models.

The thesis scored each model once on a 166-record test set holding 14 non-CKD
records. This script repeats the whole procedure (fit, tune the threshold on a
validation part, score on unseen records) over repeated stratified
cross-validation so that every record is tested several times, and adds:

  * XGBoost with the class weight pointing the right way
  * CatBoost without class weights, and CatBoost on all columns (no feature selection)
  * a clinical rule baseline (KDIGO: GFR < 60 or ACR >= 30) and "everyone has CKD"
  * a corrected paired t-test of each model against the thesis CatBoost
  * calibration of the CatBoost probabilities
  * checks of whether the dataset follows basic kidney physiology

Writes docs/data/robust.js. Run:  .venv\\Scripts\\python.exe build\\evaluate.py
"""
import json
import math
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier
from scipy import stats
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.model_selection import RepeatedStratifiedKFold, train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import CSV, DROP_COLS, MIN_RECALL, OUT, TARGET_COL, pr_auc, threshold_tuning, write_js  # noqa: E402

warnings.filterwarnings("ignore")

N_SPLITS, N_REPEATS, SEED = 5, 10, 42
VALID_SHARE = 0.22  # of the training part, as in the thesis (20% of 90%)
METRICS = ["ROC_AUC", "PR_AUC", "BalancedAcc", "Sensitivity", "Specificity"]
CACHE = Path(__file__).resolve().parent / "eval_cache.json"


def catboost(weights="Balanced"):
    return CatBoostClassifier(
        iterations=4000, learning_rate=0.03, depth=6, l2_leaf_reg=6, bagging_temperature=0.6,
        random_strength=1.0, loss_function="Logloss", eval_metric="AUC", auto_class_weights=weights,
        random_seed=42, od_type="Iter", od_wait=250, verbose=False, allow_writing_files=False, thread_count=4)


def fit_predict(kind, Xtr, ytr, Xva, yva, Xte):
    """Returns (validation probabilities, test probabilities) for one model kind."""
    if kind in ("LogisticRegression", "SVM"):
        scaler = StandardScaler().fit(Xtr)
        Xtr, Xva, Xte = scaler.transform(Xtr), scaler.transform(Xva), scaler.transform(Xte)
        model = (LogisticRegression(max_iter=5000, class_weight="balanced", random_state=42)
                 if kind == "LogisticRegression"
                 else SVC(probability=True, class_weight="balanced", random_state=42))
        model.fit(Xtr, ytr)
    elif kind == "RandomForest":
        model = RandomForestClassifier(n_estimators=500, class_weight="balanced", random_state=42, n_jobs=-1)
        model.fit(Xtr, ytr)
    elif kind.startswith("XGBoost"):
        # The thesis used scale_pos_weight=10, which up-weights CKD, already the majority class.
        weight = 10.0 if kind == "XGBoost (thesis weight)" else float((ytr == 0).sum() / (ytr == 1).sum())
        model = XGBClassifier(n_estimators=800, learning_rate=0.05, max_depth=5, random_state=42,
                              scale_pos_weight=weight, n_jobs=-1, eval_metric="logloss")
        model.fit(Xtr, ytr)
    else:
        model = catboost(None if kind == "CatBoost (no class weights)" else "Balanced")
        model.fit(Xtr, ytr, eval_set=(Xva, yva), use_best_model=True)
    return model.predict_proba(Xva)[:, 1], model.predict_proba(Xte)[:, 1]


def score(y, proba, threshold):
    pred = proba >= threshold
    sens = float((pred & (y == 1)).sum() / (y == 1).sum())
    spec = float((~pred & (y == 0)).sum() / (y == 0).sum())
    return {"ROC_AUC": float(roc_auc_score(y, proba)), "PR_AUC": pr_auc(y, proba),
            "BalancedAcc": (sens + spec) / 2, "Sensitivity": sens, "Specificity": spec}


def corrected_t(diffs, n_train, n_test):
    """Nadeau-Bengio corrected resampled t-test for repeated cross-validation."""
    d = np.asarray(diffs)
    var = d.var(ddof=1)
    if var == 0:
        return 1.0
    t = d.mean() / math.sqrt((1 / len(d) + n_test / n_train) * var)
    return float(2 * stats.t.sf(abs(t), len(d) - 1))


def main():
    raw = pd.read_csv(CSV)
    y = raw[TARGET_COL].astype(int).values
    X38 = raw.drop(columns=DROP_COLS + [TARGET_COL])
    Xall = raw.drop(columns=["PatientID", "DoctorInCharge", TARGET_COL])

    runs = [  # (display name, model kind, feature table)
        ("Engineered CatBoost (thesis)", "CatBoost", X38),
        ("CatBoost (no class weights)", "CatBoost (no class weights)", X38),
        ("CatBoost (all columns, no feature selection)", "CatBoost", Xall),
        ("Random Forest", "RandomForest", X38),
        ("Logistic Regression", "LogisticRegression", X38),
        ("SVM", "SVM", X38),
        ("XGBoost (corrected class weight)", "XGBoost", X38),
        ("XGBoost (thesis weight)", "XGBoost (thesis weight)", X38),
    ]
    folds = list(RepeatedStratifiedKFold(n_splits=N_SPLITS, n_repeats=N_REPEATS, random_state=SEED).split(X38, y))
    per_fold = {name: [] for name, _, _ in runs}
    oof = {name: np.zeros((N_REPEATS, len(y))) for name in ("Engineered CatBoost (thesis)", "CatBoost (no class weights)")}

    # Finished folds are cached, so an interrupted run resumes where it stopped.
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    for i, (train_idx, test_idx) in enumerate(folds):
        if str(i) not in cache:
            tr_idx, va_idx = train_test_split(train_idx, test_size=VALID_SHARE, random_state=SEED + i, stratify=y[train_idx])
            done = {}
            for name, kind, X in runs:
                p_va, p_te = fit_predict(kind, X.iloc[tr_idx], y[tr_idx], X.iloc[va_idx], y[va_idx], X.iloc[test_idx])
                done[name] = {"score": score(y[test_idx], p_te, threshold_tuning(y[va_idx], p_va)),
                              "proba": [round(float(v), 5) for v in p_te] if name in oof else None}
            cache[str(i)] = done
            CACHE.write_text(json.dumps(cache))
            print(f"fold {i + 1}/{len(folds)} done", flush=True)
        for name, _, _ in runs:
            per_fold[name].append(cache[str(i)][name]["score"])
            if name in oof:
                oof[name][i // N_SPLITS, test_idx] = cache[str(i)][name]["proba"]

    n_test = len(folds[0][1])
    n_train = len(y) - n_test
    ref = per_fold["Engineered CatBoost (thesis)"]
    models = []
    for name, _, _ in runs:
        rows = per_fold[name]
        entry = {"Model": name}
        for m in METRICS:
            vals = np.array([r[m] for r in rows])
            entry[m] = {"mean": round(float(vals.mean()), 4), "sd": round(float(vals.std(ddof=1)), 4),
                        "lo": round(float(np.percentile(vals, 2.5)), 4), "hi": round(float(np.percentile(vals, 97.5)), 4)}
        if rows is not ref:
            for m in ("ROC_AUC", "BalancedAcc"):
                diffs = [a[m] - b[m] for a, b in zip(rows, ref)]
                entry["vsThesis_" + m] = {"diff": round(float(np.mean(diffs)), 4), "p": round(corrected_t(diffs, n_train, n_test), 4)}
        models.append(entry)

    # ---- Rule baselines on the whole dataset (nothing to fit) ----
    def rule(name, pred):
        sens = float((pred & (y == 1)).sum() / (y == 1).sum())
        spec = float((~pred & (y == 0)).sum() / (y == 0).sum())
        return {"Model": name, "Sensitivity": round(sens, 4), "Specificity": round(spec, 4),
                "BalancedAcc": round((sens + spec) / 2, 4), "Accuracy": round(float((pred == (y == 1)).mean()), 4)}
    rules = [
        rule("Clinical rule: GFR < 60 or ACR ≥ 30", ((raw.GFR < 60) | (raw.ACR >= 30)).values),
        rule("Clinical rule: GFR < 60", (raw.GFR < 60).values),
        rule("Label everyone as CKD", np.ones(len(y), dtype=bool)),
    ]

    # ---- Does the dataset follow kidney physiology? ----
    def rho(a, b):
        return round(float(stats.spearmanr(raw[a], raw[b]).statistic), 3)
    physiology = {
        "creatinine_gfr": rho("SerumCreatinine", "GFR"),
        "creatinine_bun": rho("SerumCreatinine", "BUNLevels"),
        "protein_acr": rho("ProteinInUrine", "ACR"),
        "ldl_total_cholesterol": rho("CholesterolLDL", "CholesterolTotal"),
        "systolic_diastolic": rho("SystolicBP", "DiastolicBP"),
        "impossible": int(((raw.SerumCreatinine > 3) & (raw.GFR > 90)).sum()),
        "ckdShareGfrUnder60": round(float(y[raw.GFR < 60].mean()), 4),
        "ckdShareGfrOver90": round(float(y[raw.GFR >= 90].mean()), 4),
        "aucSingle": {f: round(float(max(a, 1 - a)), 3) for f in ("SerumCreatinine", "GFR", "ProteinInUrine", "BUNLevels", "ACR")
                      for a in [roc_auc_score(y, raw[f])]},
    }

    # ---- Calibration of out-of-fold probabilities (averaged over repeats) ----
    calibration = {}
    for name, probs in oof.items():
        p = probs.mean(axis=0)
        bins = []
        edges = np.linspace(0, 1, 11)
        for lo, hi in zip(edges[:-1], edges[1:]):
            mask = (p >= lo) & (p < hi if hi < 1 else p <= hi)
            if mask.sum() >= 10:
                bins.append([round(float(p[mask].mean()), 3), round(float(y[mask].mean()), 3), int(mask.sum())])
        calibration[name] = {"brier": round(float(brier_score_loss(y, p)), 4), "meanPredicted": round(float(p.mean()), 4),
                             "bins": bins}

    # ---- Print ----
    print(f"\n{N_SPLITS}-fold x {N_REPEATS} repeats, {len(folds)} test folds of ~{n_test} records")
    print(f"{'Model':<46}{'ROC-AUC':>14}{'BalAcc':>14}{'Sens':>14}{'Spec':>14}   vs thesis CatBoost (AUC diff, p)")
    for e in models:
        cells = "".join(f"{e[m]['mean']:>8.3f}±{e[m]['sd']:.3f}" for m in ("ROC_AUC", "BalancedAcc", "Sensitivity", "Specificity"))
        vs = e.get("vsThesis_ROC_AUC")
        print(f"{e['Model']:<46}{cells}   " + (f"{vs['diff']:+.3f}, p={vs['p']:.3f}; BalAcc {e['vsThesis_BalancedAcc']['diff']:+.3f}, p={e['vsThesis_BalancedAcc']['p']:.3f}" if vs else "reference"))
    for r_ in rules:
        print(f"{r_['Model']:<46} sens {r_['Sensitivity']:.3f} spec {r_['Specificity']:.3f} balacc {r_['BalancedAcc']:.3f} acc {r_['Accuracy']:.3f}")
    print("physiology", json.dumps(physiology))
    print("calibration", json.dumps(calibration))

    write_js(OUT / "robust.js", "CKD_ROBUST", {
        "design": {"splits": N_SPLITS, "repeats": N_REPEATS, "folds": len(folds), "testSize": n_test,
                   "nonCkdPerFold": int((y == 0).sum() / N_SPLITS), "minRecall": MIN_RECALL},
        "models": models, "rules": rules, "physiology": physiology, "calibration": calibration,
    })


if __name__ == "__main__":
    main()
