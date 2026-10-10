import ResearchCharts from "../components/ResearchCharts";

export const metadata = {
  title: "CKD Screening — About CKD, the model and the report",
  description: "Chronic kidney disease explained, plus the dataset, method and results of an undergraduate thesis on machine-learning CKD screening.",
};

export default function AboutPage() {
  return (
    <main>
      <div className="hero">
          <div className="wrap">
            <div className="hero-grid">
              <div>
                <span className="eyebrow">Undergraduate thesis project</span>
                <h1>Screening for chronic kidney disease with machine learning</h1>
                <p className="lead">Chronic kidney disease usually develops silently over years. This site explains the disease, presents a CatBoost model built to screen for it, and reports how well that model performed.</p>
                <div className="btn-row">
                  <a className="btn lg" href="/check">Check CKD Model</a>
                  <a className="btn ghost lg" href="#about">Learn about CKD</a>
                </div>
              </div>
              <img className="hero-art photo" src="/img/kidney-anatomy.jpg" alt="Medical rendering of a kidney in cross-section, showing the cortex, renal artery, renal vein and ureter" width="1200" height="829" />
            </div>
            <div className="grid cols-4" id="headline-tiles"></div>
          </div>
        </div>

        <div className="subnav" id="subnav">
          <div className="wrap">
            <a href="#about">About CKD</a>
            <a href="#model">The model</a>
            <a href="#report">Report</a>
          </div>
        </div>

        
        <div className="wrap part" id="about">
          <div className="part-head">
            <span className="num">1</span>
            <div>
              <h2>About CKD</h2>
              <p>What chronic kidney disease is, who is at risk and how it is found.</p>
            </div>
          </div>

          <section>
            <div className="grid cols-2">
              <div className="card">
                <h3>What the kidneys do</h3>
                <p>Your two kidneys filter waste and extra fluid out of the blood and pass them out as urine. They also help control blood pressure, keep minerals such as sodium and potassium in balance, and support the production of red blood cells.</p>
              </div>
              <div className="card">
                <h3>What goes wrong</h3>
                <p>In CKD the kidneys are damaged and gradually lose their ability to filter. It is called chronic when the damage or reduced function lasts three months or longer. Roughly one in ten adults worldwide is estimated to have some degree of CKD, and most do not know it.</p>
              </div>
            </div>
          </section>

          <section>
            <h3>Who is at higher risk?</h3>
            <div className="grid cols-3">
              <div className="card hover"><div className="icon"><svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z"/></svg></div><h3>Diabetes</h3><p>High blood sugar damages the kidney's small filters over time. Diabetes is the leading cause of CKD.</p></div>
              <div className="card hover"><div className="icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg></div><h3>High blood pressure</h3><p>Raised pressure strains the kidney's blood vessels. It is both a cause and a result of kidney damage.</p></div>
              <div className="card hover"><div className="icon"><svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.500"/><path d="M2.500 20c0-3.500 2.500-5.500 5.500-5.500s5.500 2 5.500 5.500M15 14.500c3 0 6 1.500 6 5"/></svg></div><h3>Family history</h3><p>Having a close relative with kidney disease raises your own risk.</p></div>
              <div className="card hover"><div className="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><h3>Older age</h3><p>Kidney function declines naturally with age, so risk rises after about 60.</p></div>
              <div className="card hover"><div className="icon"><svg viewBox="0 0 24 24"><path d="M3 16h13v3H3zM19 16v3M21.500 16v3M17 12c2 0 4-1 3-3.500S17 6 18 4"/></svg></div><h3>Smoking and obesity</h3><p>Both harm blood vessels and make diabetes and high blood pressure more likely.</p></div>
              <div className="card hover"><div className="icon"><svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/></svg></div><h3>Frequent painkillers</h3><p>Long-term, heavy use of NSAID painkillers such as ibuprofen can injure the kidneys.</p></div>
            </div>
          </section>

          <section>
            <div className="grid cols-2">
              <div className="card">
                <h3>Symptoms in early stages</h3>
                <p>Usually there are none. Most people feel well until a large part of kidney function has been lost, which is why testing people at risk matters.</p>
              </div>
              <div className="card">
                <h3>Symptoms in later stages</h3>
                <ul>
                  <li>Tiredness and poor concentration</li>
                  <li>Swollen ankles, feet or hands</li>
                  <li>Itchy skin and muscle cramps</li>
                  <li>Nausea and loss of appetite</li>
                  <li>Changes in how often you pass urine, or foamy urine</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h3>How CKD is found</h3>
            <div className="grid cols-2">
              <div className="grid">
                <div className="card media">
                  <img src="/img/blood-test.jpg" alt="Blood sample tubes in a medical laboratory" width="900" height="800" loading="lazy" />
                  <div>
                    <h3>Blood test (eGFR)</h3>
                    <p>Serum creatinine is measured and used to estimate the glomerular filtration rate: how much blood the kidneys filter each minute.</p>
                  </div>
                </div>
                <div className="card media">
                  <img src="/img/urine-test.jpg" alt="A urine sample in a collection container" width="900" height="675" loading="lazy" />
                  <div>
                    <h3>Urine test (ACR)</h3>
                    <p>The albumin-to-creatinine ratio shows whether protein is leaking into the urine, an early sign of damage.</p>
                  </div>
                </div>
              </div>
              <div className="card">
                <h3>Stages by filtration rate</h3>
                <div className="table-scroll">
                  <table>
      <tbody>
                    <tr><th>Stage</th><th>eGFR (mL/min/1.73 m²)</th><th>Kidney function</th></tr>
                    <tr><td>G1</td><td>90 or more</td><td>Normal</td></tr>
                    <tr><td>G2</td><td>60–89</td><td>Mildly reduced</td></tr>
                    <tr><td>G3a</td><td>45–59</td><td>Mild to moderate</td></tr>
                    <tr><td>G3b</td><td>30–44</td><td>Moderate to severe</td></tr>
                    <tr><td>G4</td><td>15–29</td><td>Severely reduced</td></tr>
                    <tr><td>G5</td><td>Below 15</td><td>Kidney failure</td></tr>
                  </tbody>
      </table>
                </div>
                <p className="small" style={{ margin: "12px 0 0" }}>Stages G1 and G2 count as CKD only when there are other signs of kidney damage, such as protein in the urine. Staging follows the KDIGO guideline.</p>
              </div>
            </div>
          </section>

          <section>
            <h3>Protecting your kidneys</h3>
            <div className="card">
              <ul>
                <li>Keep blood pressure and blood sugar within the targets your doctor sets.</li>
                <li>Eat less salt, stay active and keep a healthy weight.</li>
                <li>Do not smoke.</li>
                <li>Use painkillers such as ibuprofen only as directed.</li>
                <li>If you have diabetes, high blood pressure or a family history of kidney disease, ask for a kidney check (blood and urine test) once a year.</li>
              </ul>
            </div>
          </section>
        </div>

        
        <div className="wrap part" id="model">
          <div className="part-head">
            <span className="num">2</span>
            <div>
              <h2>The model</h2>
              <p>An engineered CatBoost pipeline, tuned to keep sensitivity high on a heavily imbalanced dataset and compared with Logistic Regression, Random Forest, XGBoost and SVM.</p>
            </div>
          </div>

          <section>
            <h3>Research objective</h3>
            <div className="grid cols-2">
              <div className="card">
                <h3>Class imbalance</h3>
                <p>About 92% of the records are CKD cases. A model can score high accuracy by labelling everyone as CKD, so accuracy alone says little.</p>
              </div>
              <div className="card">
                <h3>Sensitivity first</h3>
                <p>In screening, a missed case costs more than a false alarm. The study requires at least 92% CKD sensitivity, then looks for the best performance on the minority non-CKD class.</p>
              </div>
            </div>
          </section>

          <section>
            <h3>Dataset</h3>
            <div className="grid cols-4" id="dataset-tiles"></div>
            <div className="grid cols-2" style={{ marginTop: "18px" }}>
              <div className="card">
                <div className="chart-title">Class balance</div>
                <div className="chart-sub">Share of all records by diagnosis</div>
                <div id="class-balance"></div>
              </div>
              <div className="card">
                <div className="chart-title">Stratified split</div>
                <div className="chart-sub">Records in each partition (random_state = 42)</div>
                <div className="table-scroll"><table id="split-table"></table></div>
              </div>
            </div>
            <div className="card" style={{ marginTop: "18px" }}>
              <div className="chart-title">Explore a feature</div>
              <div className="chart-sub" id="explore-sub"></div>
              <div className="controls">
                <label htmlFor="feature-select">Feature</label>
                <select id="feature-select"></select>
              </div>
              <div id="feature-chart"></div>
            </div>
            <p className="small" style={{ marginTop: "14px" }}>Source: <a href="https://www.kaggle.com/datasets/rabieelkharoua/chronic-kidney-disease-dataset-analysis">Chronic Kidney Disease Dataset</a> by Rabie El Kharoua on Kaggle. <span id="dropped-note"></span></p>
          </section>

          <section>
            <h3>Method</h3>
            <div className="card">
              <ol className="steps">
                <li><div><strong>Preprocessing.</strong> Identifier and provider columns are removed, values converted to numeric and missing values filled with the median.</div></li>
                <li><div><strong>Feature selection.</strong> Fifteen weak features, identified by agreement between Random Forest, XGBoost and Logistic Regression importances and checked against KDIGO guidance, are dropped.</div></li>
                <li><div><strong>Stratified split.</strong> 70% training, 20% validation and 10% testing, preserving the class ratio in each part.</div></li>
                <li><div><strong>Imbalance handling.</strong> Balanced class weights make errors on the rare non-CKD class count more during training.</div></li>
                <li><div><strong>Model training.</strong> CatBoost (depth 6, learning rate 0.03, L2 regularisation 6, early stopping on validation AUC) and four baselines are trained on the same data.</div></li>
                <li><div><strong>Threshold optimisation.</strong> On the validation set, the decision threshold with the highest balanced accuracy is chosen among those keeping CKD sensitivity at 0.92 or above.</div></li>
                <li><div><strong>Evaluation.</strong> Every model is scored once on the held-out test set with screening metrics, and the CatBoost model is interpreted with feature importance and SHAP values.</div></li>
              </ol>
            </div>
          </section>
        </div>

        
        <div className="wrap part" id="report">
          <div className="part-head">
            <span className="num">3</span>
            <div>
              <h2>Report</h2>
              <p>How the models performed on the held-out test set, what the CatBoost model relies on, and the limits of the study.</p>
            </div>
          </div>

          <section>
            <div className="card">
              <div className="chart-title">Model comparison</div>
              <div className="chart-sub" id="compare-sub"></div>
              <div className="controls">
                <label htmlFor="metric-select">Metric</label>
                <select id="metric-select"></select>
              </div>
              <div id="compare-chart"></div>
              <div className="table-scroll" style={{ marginTop: "18px" }}><table id="compare-table"></table></div>
              <p className="small" id="compare-note" style={{ margin: "12px 0 0" }}></p>
            </div>
          </section>

          <section id="robustness">
            <h3>Robustness check</h3>
            <p className="lead" id="robust-intro" style={{ fontSize: "1rem" }}></p>
            <div className="card">
              <div className="chart-title">Repeated cross-validation</div>
              <div className="chart-sub" id="robust-sub"></div>
              <div className="controls">
                <label htmlFor="robust-metric">Metric</label>
                <select id="robust-metric"></select>
              </div>
              <div id="robust-chart"></div>
              <div className="table-scroll" style={{ marginTop: "18px" }}><table id="robust-table"></table></div>
              <p className="small" style={{ margin: "12px 0 0" }}>Values are the mean ± standard deviation over all test folds. The last column is the difference in balanced accuracy from the thesis CatBoost model, with the p-value of a corrected paired t-test; values below 0.05 indicate a difference unlikely to be chance.</p>
            </div>
            <div className="grid cols-2" style={{ marginTop: "18px" }}>
              <div className="card">
                <h3>What the check shows</h3>
                <ul id="robust-findings"></ul>
              </div>
              <div className="card">
                <h3>What it shows about the dataset</h3>
                <ul id="robust-data"></ul>
              </div>
            </div>
          </section>

          <section>
            <h3>Engineered CatBoost in detail</h3>
            <div className="grid cols-4" id="catboost-tiles"></div>
            <div className="grid cols-2" style={{ marginTop: "18px" }}>
              <div className="card">
                <div className="chart-title">Confusion matrix</div>
                <div className="chart-sub" id="cm-sub"></div>
                <div className="cm" id="cm"></div>
                <p className="small" id="cm-note" style={{ margin: "14px 0 0" }}></p>
              </div>
              <div className="card">
                <div className="chart-title">Choosing the threshold</div>
                <div className="chart-sub">Validation-set metrics as the decision threshold moves</div>
                <div id="sweep-chart"></div>
              </div>
              <div className="card">
                <div className="chart-title">ROC curve</div>
                <div className="chart-sub" id="roc-sub"></div>
                <div id="roc-chart"></div>
              </div>
              <div className="card">
                <div className="chart-title">Precision–recall curve</div>
                <div className="chart-sub" id="pr-sub"></div>
                <div id="pr-chart"></div>
              </div>
            </div>
          </section>

          <section>
            <h3>What the model relies on</h3>
            <div className="card">
              <div className="chart-title">Most important predictors</div>
              <div className="chart-sub" id="imp-sub"></div>
              <div className="controls">
                <div className="seg" id="imp-toggle" role="group" aria-label="Importance measure">
                  <button type="button" data-key="native" aria-pressed="true">CatBoost importance</button>
                  <button type="button" data-key="shap" aria-pressed="false">SHAP</button>
                </div>
              </div>
              <div id="imp-chart"></div>
              <div id="imp-table"></div>
            </div>
            <p className="small" style={{ marginTop: "14px" }}>Importance describes how the model behaves. It is not evidence that a feature causes kidney disease.</p>
          </section>

          <section>
            <h3>Limitations</h3>
            <div className="card">
              <ul>
                <li>The analysis uses a single dataset and has not been validated externally or prospectively.</li>
                <li id="lim-data"></li>
                <li id="lim-rank"></li>
                <li id="lim-test"></li>
                <li>The optimised threshold needs to be evaluated on an independent dataset.</li>
                <li>Feature importance does not establish causal relationships.</li>
                <li>The model is a research prototype and is not intended for clinical diagnosis or deployment.</li>
              </ul>
            </div>
          </section>

          <section>
            <h3>Team and code</h3>
            <div className="card">
              <p>The work was completed by a two-student research team under faculty supervision. Abu Adnan Shad led the model architecture, implementation and results analysis. A conference manuscript based on the thesis is being revised for submission.</p>
              <div className="btn-row" style={{ marginTop: "16px" }}>
                <a className="btn sm" href="/check">Check CKD Model</a>
                <a className="btn ghost sm" href="https://github.com/adnanshad35/ckd-catboost-screening">Notebook and data on GitHub</a>
              </div>
            </div>
          </section>

          <section>
            <h3>Image credits</h3>
            <p className="small">Photos are from Wikimedia Commons.
              Kidney anatomy: <a href="https://commons.wikimedia.org/wiki/File:3D_Medical_Animation_depicting_Kidney_Layers_2.jpg">3D Medical Animation depicting Kidney Layers</a> by scientificanimations.com, <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>.
              Urine sample: <a href="https://commons.wikimedia.org/wiki/File:Urine_sample_for_Culture_and_Sensitivity.jpg">Urine sample for Culture and Sensitivity</a> by Ajay Kumar Chaurasiya, <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>.
              Blood sample tubes: <a href="https://commons.wikimedia.org/wiki/File:Laboratory_Test_Tubes;_from_a_medical_laboratory_in_Abuja,_Nigeria.jpg">Laboratory Test Tubes</a> by Frankincense Diala, CC0.
              Blood pressure check: <a href="https://commons.wikimedia.org/wiki/File:Blood_pressure_monitoring.jpg">Blood pressure monitoring</a> by rawpixel.com, CC0.
              Images are resized; no other changes were made.</p>
          </section>

          <p className="notice"><strong>This site is for education and research.</strong> It does not give medical advice and cannot diagnose kidney disease. If you are worried about your kidneys, speak to a doctor.</p>
        </div>
      <ResearchCharts />
    </main>
  );
}
