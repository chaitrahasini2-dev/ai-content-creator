import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: ["legacy-prototype/**", ".next/**", "node_modules/**", "dist/**", "supabase/seed/**", "next-env.d.ts"]
  },
  ...nextCoreWebVitals,
  ...nextTypescript
];

export default eslintConfig;
