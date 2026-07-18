import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Design-system guard: keep hardcoded hex colors out of app code so the semantic color
 * tokens in `src/app/globals.css` (var(--success), var(--warning), …) stay the single
 * source of truth. New hex literals error; today's legitimate ones are grandfathered in
 * `eslint-suppressions.json`.
 *
 *  - Re-baseline after intentionally adding hex:  `eslint --suppress-rule no-restricted-syntax`
 *  - Shrink the baseline as code gets tokenized:  `eslint --prune-suppressions`
 *  - One-off hex that genuinely can't take a CSS var (accent-math like `${accent}66`,
 *    a canvas sink) → add `// eslint-disable-next-line no-restricted-syntax` with a reason.
 *
 * 3D/canvas components and the color-source data files are exempt outright: three.js and
 * <canvas> can't resolve `var()`, and `src/data` is where the raw palette legitimately lives.
 */
const noHardcodedHexColors = {
  files: ["src/**/*.{ts,tsx}"],
  ignores: [
    "src/data/**",
    "src/components/CocktailScene.tsx",
    "src/components/MobileCocktailScene.tsx",
    "src/components/CocktailLayers.tsx",
    "src/components/LuxuryLighting.tsx",
    "src/components/BackgroundFX.tsx",
  ],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        // A string literal whose whole value is a hex color: color:'#34d399', fill="#7dd3fc".
        selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/i]",
        message:
          "Hardcoded hex color — use a semantic token (e.g. var(--success) from globals.css) or a Tailwind color class. For 3D/canvas/accent-math that can't take a CSS var, add `// eslint-disable-next-line no-restricted-syntax` with a reason.",
      },
      {
        // A Tailwind arbitrary color value: text-[#34d399], bg-[#fbbf24]/20, from-[#7dd3fc].
        selector: "Literal[value=/-\\[#[0-9a-fA-F]{3,8}\\]/]",
        message:
          "Hardcoded hex in a Tailwind arbitrary value — use a token class or text-[var(--token)]. Add `// eslint-disable-next-line no-restricted-syntax` with a reason if a var() won't work here.",
      },
      {
        // A Tailwind arbitrary font-size: text-[13px]. Use the named scale (globals.css @theme):
        // text-10/11/13/15/17/19/22/26 for custom steps, or text-xs/sm/base/lg/xl/2xl for defaults.
        selector: "Literal[value=/text-\\[[0-9.]+px\\]/]",
        message:
          "Hardcoded font size — use the named type scale (text-10, text-11, text-13, … or text-xs/sm/base/lg). Add a size token in globals.css @theme if a new step is truly needed.",
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noHardcodedHexColors,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
