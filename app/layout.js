import { Inter } from "next/font/google";
import "./globals.css";
import Header from "../components/Header";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "CKD Screening",
  description: "Chronic kidney disease information and a machine-learning screening model from an undergraduate thesis.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Header />
        {children}
        <footer>
          <div className="wrap">
            Undergraduate thesis project by Abu Adnan Shad and team · Research prototype, not a diagnostic tool ·{" "}
            <a href="/#model">How the model was built and tested</a> · <a href="/#report">Image credits</a> ·{" "}
            <a href="https://github.com/adnanshad35/ckd-catboost-screening">Source code on GitHub</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
