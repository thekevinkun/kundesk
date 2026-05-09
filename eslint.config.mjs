import js from "@eslint/js"
import nextPlugin from "@next/eslint-plugin-next"
import tseslint from "typescript-eslint"

export default tseslint.config(
  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  {
    // Apply Next.js plugin rules
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      // Next.js core web vitals rules
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,

      // Zero `any` — hard error not warning
      "@typescript-eslint/no-explicit-any": "error",

      // No unused variables — prefix with _ to intentionally ignore
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],

      // React 19 makes this rule unnecessary — removing instead of disabling
      // to avoid needing to register the React plugin separately
      "react/react-in-jsx-scope": "off",
    },
  },

  {
    // Ignore generated files
    ignores: [".next/**", "node_modules/**"],
  }
)
