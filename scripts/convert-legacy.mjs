#!/usr/bin/env node
/**
 * scripts/convert-legacy.mjs — アイコンの変換を明示的に実行する入口。
 *
 * 10月 SR-A1-CHK-1 の対応で、パッケージ入口（dist/index.mjs / dist/index.cjs）の
 * 読み込み時に走っていた変換をここへ移した。旧挙動（import で ./ai を ./dest へ変換）に
 * 頼る箇所は残さない。piconvert は devDependencies なので、`Converter` を factory として
 * 明示的に渡す。
 *
 *   pnpm run convert                 # ./ai -> ./dest
 *   pnpm run convert -- <input> <out>
 *   pnpm run convert -- --help       # 変換せずに使い方を表示する
 *
 * 実際の変換（AI → SVG）には Inkscape が要る。`pnpm run inkscape` で導入する。
 */
import { Converter } from 'piconvert';
import { convert } from '../dist/convert.mjs';

const USAGE = `使い方: pnpm run convert -- [入力ディレクトリ] [出力ディレクトリ]

  --help, -h   この使い方を表示して終了する（変換は行わない）

引数を省略した場合は ./ai を ./dest へ変換します。
実際の変換には Inkscape が必要です（pnpm run inkscape）。`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

const inputPath = args[0] ?? './ai';
const outputDirectory = args[1] ?? './dest';

try {
  const manifest = await convert({
    inputPath,
    outputDirectory,
    mode: 'legacy',
    converterFactory: () => new Converter(),
  });
  console.log(
    `変換しました: ${manifest.input.path} -> ${outputDirectory}（${manifest.outputs.length} 件）`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  const exitCode = error && typeof error.exitCode === 'number' ? error.exitCode : 3;
  process.exit(exitCode);
}
