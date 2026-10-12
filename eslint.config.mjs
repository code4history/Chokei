// ESLint の設定（nov26-m8-t3・NayutaProducts#33）。形は m8 設計の C-m8-1
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier"; // 書式の規則は prettier に任せる。no-unexpected-multiline 等の書式の規則を off にする

export default [
  // 全体の除外は ignores だけを持つ要素に書く（他のキーと同居させると全体の除外にならない。C-m8-1 (b)）
  { ignores: ["dist/**", "node_modules/**", "coverage/**", "tests/fixtures/invalid-config.js"] }, // invalid-config.js は不正な設定の入力として壊してある fixture（convert-adapter.test.ts が使う）。直さない
  { linterOptions: { reportUnusedDisableDirectives: true } },
  // recommended は独立した要素に置き、files を付けない（lint する全ファイルに当てる。C-m8-1 (a)）
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: { parser: tsParser },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "no-undef": "off", // TS では未定義の識別子を tsc（pnpm run typecheck）が検査する。no-undef は DOM・型の大域を知らず誤検出する（typescript-eslint の推奨）
      "no-unused-vars": "off", // @typescript-eslint/no-unused-vars（warn・_ 始まりを除外）で代替する
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
  // tests/fixtures の設定は CommonJS（module.exports）。sourceType を commonjs にすると require・module・exports が大域になる
  { files: ["tests/fixtures/**/*.js"], languageOptions: { sourceType: "commonjs" } },
  prettier,
];
