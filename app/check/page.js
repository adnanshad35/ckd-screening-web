import CheckClient from "../../components/CheckClient";

export const metadata = {
  title: "CKD Screening — Check CKD Model",
  description: "Enter patient values and see what the thesis CatBoost model predicts. Research demonstration only.",
};

export default function CheckPage() {
  return (
    <main>
      <div className="hero compact">
          <div className="wrap">
            <div className="hero-grid tight">
              <div>
                <span className="eyebrow">Interactive model</span>
                <h1>Check CKD Model</h1>
                <p className="lead">Fill in your basic information and lab data, press Submit, and the thesis CatBoost model produces a report you can download. The model runs in your browser; nothing you type is sent anywhere.</p>
              </div>
              <img className="hero-art photo" src="/img/blood-pressure.jpg" alt="A clinician measuring a patient's blood pressure, seen from above" width="1200" height="709" />
            </div>
            <p className="notice"><strong>Research demonstration, not a diagnosis.</strong> <span id="caveat"></span> Do not use the result to make health decisions. See a doctor for kidney testing.</p>
          </div>
        </div>

        <div className="wrap">
        <div className="controls toolbar no-print">
          <label htmlFor="example-select">Or load an example:</label>
          <select id="example-select"><option value="">Choose an example…</option></select>
          <button type="button" className="btn ghost sm" id="clear">Clear</button>
        </div>

        <form id="form" className="predict-form no-print" noValidate>
          <div className="submit-row" id="submit-row">
            <button type="submit" className="btn lg">Submit and see report</button>
            <span className="small" id="status" aria-live="polite"></span>
          </div>
        </form>

        <section className="card report" id="report" hidden aria-live="polite">
          <div id="report-body"></div>
          <div className="btn-row no-print" style={{ marginTop: "20px" }}>
            <button type="button" className="btn" id="download">Download report</button>
            <button type="button" className="btn ghost" id="print">Print or save as PDF</button>
            <button type="button" className="btn ghost" id="edit">Edit answers</button>
          </div>
        </section>
        </div>
      <CheckClient />
    </main>
  );
}
