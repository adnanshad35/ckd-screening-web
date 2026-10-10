// Sample patients offered in the "Load an example" list on the prediction page.
// Each fills the two required sections; optional fields stay at typical values.
// `label` is the label supplied with the sample, not the model's output.
const cols = ["Age", "Gender", "BMI", "Smoking", "FamilyHistoryKidneyDisease", "AlcoholConsumption", "PhysicalActivity",
  "DietQuality", "FatigueLevels", "Itching", "MuscleCramps", "NSAIDsUse", "SerumCreatinine", "GFR", "ProteinInUrine",
  "BUNLevels", "FastingBloodSugar", "HbA1c", "CholesterolTotal", "HemoglobinLevels", "SerumElectrolytesSodium",
  "CholesterolTriglycerides"];
// Gender: 0 male, 1 female. Smoking and family history: 0 no, 1 yes.
const rows = [
  [62, 0, 28.4, 1, 1, 2, 1, 4, 7, 6, 4, 3, 2.4, 32, 1.8, 38, 132, 7.2, 238, 10.8, 139, 210, "CKD"],
  [71, 1, 26.1, 0, 1, 0, 0.5, 3, 8, 7, 5, 2, 2.9, 27, 2.4, 45, 148, 7.8, 252, 10.2, 138, 195, "CKD"],
  [58, 0, 31.2, 1, 0, 6, 1, 4, 6, 5, 3, 5, 1.9, 41, 1.2, 32, 156, 7.5, 226, 11.4, 140, 240, "CKD"],
  [67, 1, 29.8, 0, 1, 1, 2, 5, 7, 6, 4, 1, 2.1, 36, 1.5, 36, 138, 7.0, 244, 10.9, 137, 180, "CKD"],
  // Hemoglobin supplied as 9.8; entered as 10, the lowest value the form accepts.
  [75, 0, 22.7, 1, 1, 0, 0.5, 2, 9, 8, 6, 4, 3.4, 22, 3.1, 48, 142, 8.1, 260, 10, 136, 225, "CKD"],
  [34, 1, 22.3, 0, 0, 3, 5, 8, 1, 0, 0, 0, 0.8, 98, 0.1, 12, 92, 5.2, 176, 13.6, 140, 110, "Non-CKD"],
  [41, 0, 24.8, 0, 0, 5, 4, 7, 2, 0, 0, 1, 0.9, 92, 0.1, 14, 98, 5.4, 190, 14.1, 141, 130, "Non-CKD"],
  [29, 1, 20.9, 0, 0, 0, 6, 9, 0, 0, 0, 0, 0.7, 105, 0.1, 10, 86, 5.0, 168, 13.2, 139, 95, "Non-CKD"],
  [52, 0, 27.6, 1, 0, 8, 3, 6, 2, 1, 0, 2, 1.0, 88, 0.2, 16, 112, 5.9, 214, 14.5, 140, 165, "Non-CKD"],
  [47, 1, 25.4, 0, 0, 2, 4, 8, 1, 0, 0, 0, 0.8, 96, 0.1, 13, 95, 5.3, 182, 13.8, 142, 120, "Non-CKD"],
];
export const SAMPLES = rows.map((r, i) => ({
  label: `Sample ${i + 1}: ${r[0]}-year-old ${r[1] ? "woman" : "man"}, labelled ${r[22]}`,
  values: Object.fromEntries(cols.map((c, j) => [c, r[j]])),
}));
