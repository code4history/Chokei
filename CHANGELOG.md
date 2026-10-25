# Changelog

このプロジェクトの主な変更を記録します。版数は [Semantic Versioning](https://semver.org/) に従います。Chokei は npm に公開せず、GitHub のタグと Release で版を示します。

## [2.1.0-rc.1] - 2026-10-26

### Changed
- 入口の読み込みで変換が走らなくなった。変換は `pnpm run convert` で行う（10月 SR-A1-CHK-1）
- piconvert を実行時の依存から外した（devDependencies へ移動。11月 SR-NOV26-A1-3）
- npm に出さないことを package.json で明示した（`"private": true`）

## [2.0.2] - 2026-10-05

### Changed
- 変換器の正規化を実装し、生成物（`dist`）をリポジトリで管理するようにした
- README を英語を主・日本語（`README.ja.md`）を併記する二言語の構成にし、アイコン表を二言語で生成するようにした
- SVG→PNG の生成を phantomjs 系から sharp に置き換えた。配布しないツールを devDependencies へ移した
- 依存関係を更新

### Fixed
- README の画像リンクと表記を修正（#2）
