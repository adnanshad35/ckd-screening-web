"use client";

import { useEffect } from "react";
import { initCheck } from "../lib/check";

// Builds the form and wires up the model and report once the page has loaded.
export default function CheckClient() {
  useEffect(() => {
    initCheck();
  }, []);
  return null;
}
