import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Phones and tablets: frosted glass without live SVG refraction (see vite.config.js).
const lite =
  window.matchMedia("(pointer: coarse)").matches ||
  (navigator.hardwareConcurrency || 8) <= 4;
window.__glisseLite = lite;
if (lite) document.documentElement.dataset.lite = "";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
