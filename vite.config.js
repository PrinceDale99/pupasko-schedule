import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
 * glisse decides whether to bend the live backdrop with SVG displacement
 * filters by sniffing for Chrome. On phones those filters are re-rendered on
 * the CPU every scroll frame, which makes the whole page lag. This gates the
 * check behind window.__glisseLite (set in src/main.jsx for touch devices),
 * so phones get frosted glass without the per-frame refraction.
 */
const REFRACTS = "const refractsBackdrop = () => /Chrom(?:e|ium)\\//.test(navigator.userAgent);";
const glisseLite = {
  name: "glisse-lite",
  enforce: "pre",
  transform(code, id) {
    if (!/[\\/]glisse[\\/]dist[\\/]index\.js(\?|$)/.test(id)) return null;
    if (!code.includes(REFRACTS)) {
      this.warn("glisse-lite: refraction check not found; phones will refract (slower).");
      return null;
    }
    return code.replace(
      REFRACTS,
      "const refractsBackdrop = () => !window.__glisseLite && /Chrom(?:e|ium)\\//.test(navigator.userAgent);"
    );
  },
};

export default defineConfig({
  plugins: [glisseLite, react()],
  // Keep glisse out of the dev pre-bundle so the transform above applies in dev too.
  optimizeDeps: { exclude: ["glisse"] },
});
