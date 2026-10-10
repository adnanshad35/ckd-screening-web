"use client";

import { useEffect } from "react";
import { renderResearch } from "../lib/research";

// Fills the About page's tiles, tables and charts after the page has loaded,
// and highlights the sub-navigation item for the part currently in view.
export default function ResearchCharts() {
  useEffect(() => {
    renderResearch();

    const links = [...document.querySelectorAll("#subnav a")];
    const parts = links.map((a) => document.querySelector(a.getAttribute("href")));
    const update = () => {
      let active = -1;
      parts.forEach((p, i) => { if (p.getBoundingClientRect().top <= 160) active = i; });
      links.forEach((a, i) => a.classList.toggle("active", i === active));
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);
  return null;
}
