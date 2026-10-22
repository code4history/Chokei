// パッケージの入口。読み込むだけで変換を実行しない（10月 SR-A1-CHK-1）。
// アイコンの変換は `pnpm run convert`（scripts/convert-legacy.mjs）で明示的に行う。
// piconvert は実行時依存ではないため、ここから import しない。
export { convert } from './convert-adapter';
export type {
  ConverterFactory,
  ConverterLike,
  ConvertManifest,
  ConvertOptions,
} from './convert-adapter';
