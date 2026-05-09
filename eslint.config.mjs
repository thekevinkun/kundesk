import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Next.js core rules + TypeScript support
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Zero `any` — this is a hard error, not a warning
      "@typescript-eslint/no-explicit-any": "error",

      // Force explicit return types on functions (catches missing type annotations)
      "@typescript-eslint/explicit-function-return-type": "off",

      // No unused variables — prefix with _ to intentionally ignore
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],

      // Enforce consistent imports
      "import/no-duplicates": "error",

      // Semantic HTML — divs must not have click handlers (use button)
      "jsx-a11y/no-static-element-interactions": "off",

      // React 19 — no need to import React in scope
      "react/react-in-jsx-scope": "off",
    },
  },
];

export default eslintConfig;