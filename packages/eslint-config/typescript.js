import globals from "globals";
import { config as baseConfig } from "./base.js";

export const config = [
  ...baseConfig,
  {
    files: ["**/*.ts"],
    languageOptions: { globals: { ...globals.node, ...globals.es2022 } },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
];
