#!/usr/bin/env node
/**
 * ci/verify-artifact-smoke.mjs — Cycle 2 m1-t5（設計 §6.3）
 *
 * CI が同一 job 内で upload → download した package artifact（`pnpm pack` の .tgz）を展開し、
 * **配布物そのもの**に対して smoke を実行する。
 * outer rule-0014「『手元でビルドして動いた』は CI 成果物の検証にならない」の実装である。
 *
 *   node ci/verify-artifact-smoke.mjs --artifact-dir=<dir> --report=<path>
 *
 * 依存は Node 標準機能のみ（node:fs / node:path / node:child_process）。
 * 新規 devDependency を追加しない（設計 §9.5 項1）。
 *
 * 検査（3 repo 共通の骨格）:
 *   S1 --artifact-dir 直下に .tgz がちょうど1件
 *   S2 package/package.json が読め、name / version が repo の package.json と一致する
 *   S3 package/README.md と package/README.ja.md がともに存在する
 *   S4 exports / main / module / types が指すファイルがすべて tarball 内に実在する
 *   S5 repo 固有 smoke（本ファイルで差し替わる唯一の部分）
 *   S6 結果を --report のパスへ書き出す
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ---------------------------------------------------------------------------
// repo 固有の定義（3 repo でここだけが異なる）
// ---------------------------------------------------------------------------

const REPO = "Chokei";

/**
 * S5 の driver。staging ディレクトリ（`node_modules/<pkg>` に展開済み package を置いた場所）
 * で `node` に実行させ、`[label, ok, detail]` の JSON 配列を stdout へ出させる。
 * package 名で解決させることで、exports map そのものを検査対象にする。
 */
const SMOKE_DRIVER_SOURCE = `
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const results = [];
const push = (label, ok, detail) => results.push([label, Boolean(ok), String(detail)]);
const pkgDir = path.join(process.cwd(), "node_modules", "chokei");

// (a) CommonJS の解決が index.js を経由すること。
//     実行はしない — dist/index.cjs は読み込み時に convert() を起動する副作用を持ち、
//     外部 runtime 依存 piconvert を要する。∴ exports map 経由の「解決」で示す。
try {
  const resolved = require.resolve("chokei");
  // 解決先が staging（＝配布された tarball の中身）であることも同時に要求する。
  // repo の作業ツリーへ解決されたら S5 は成立していない。
  const staged = resolved.startsWith(process.cwd() + path.sep);
  push("S5a require('chokei') が staging の index.js へ解決する", staged && /(^|[\\\\/])index\\.js$/.test(resolved), resolved);
} catch (error) {
  push("S5a require('chokei') が staging の index.js へ解決する", false, error.message);
}

// (b) ./convert subpath の型定義と ESM / CJS 実体
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  const entry = manifest.exports?.["./convert"] ?? {};
  const missing = ["types", "import", "require"].filter(
    (condition) => !entry[condition] || !fs.existsSync(path.join(pkgDir, entry[condition])),
  );
  push("S5b ./convert の types / import / require が実在する", missing.length === 0, JSON.stringify(entry));
} catch (error) {
  push("S5b ./convert の types / import / require が実在する", false, error.message);
}
try {
  const esm = await import("chokei/convert");
  const cjs = require("chokei/convert");
  const wanted = ["convert", "convertCli", "ConversionError"];
  push(
    "S5b ./convert の ESM export",
    wanted.every((key) => typeof esm[key] !== "undefined"),
    Object.keys(esm).sort().join(","),
  );
  push(
    "S5b ./convert の CJS export",
    wanted.every((key) => typeof cjs[key] !== "undefined"),
    Object.keys(cjs).sort().join(","),
  );
} catch (error) {
  push("S5b ./convert の ESM / CJS export", false, error.message);
}

// (c) manifest schema の形が期待どおりであること（ConvertManifest の宣言を配布された型定義から読む）
try {
  const dts = fs.readFileSync(path.join(pkgDir, "dist", "convert-adapter.d.ts"), "utf8");
  const block = /export type ConvertManifest = \\{[\\s\\S]*?\\n\\};/.exec(dts)?.[0] ?? "";
  const fields = ["input", "outputs", "success", "diagnostics"];
  const absent = fields.filter((field) => !new RegExp("(^|\\\\n)\\\\s*" + field + "[?]?:").test(block));
  push("S5c ConvertManifest が " + fields.join(" / ") + " を宣言する", block !== "" && absent.length === 0, absent.join(",") || "ok");
} catch (error) {
  push("S5c ConvertManifest の宣言", false, error.message);
}

process.stdout.write(JSON.stringify(results));
`;

// ---------------------------------------------------------------------------
// 以下は3 repo で同一の骨格
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const parsed = {};
  for (const item of argv.slice(2)) {
    const match = /^--([^=]+)=(.*)$/.exec(item);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

/** exports の入れ子から、配布物内の相対パスを指す葉をすべて集める。 */
function collectExportTargets(node, sink) {
  if (typeof node === "string") {
    if (node.startsWith("./")) sink.add(node);
    return sink;
  }
  if (node && typeof node === "object") {
    for (const value of Object.values(node)) collectExportTargets(value, sink);
  }
  return sink;
}

function main() {
  const args = parseArgs(process.argv);
  const artifactDir = path.resolve(args["artifact-dir"] ?? "ci-artifact-smoke");
  const reportPath = path.resolve(args.report ?? path.join("ci-evidence", "artifact-smoke.txt"));
  const checks = [];
  const record = (label, ok, detail) => checks.push({ label, ok: Boolean(ok), detail: String(detail ?? "") });

  // ---- S1: .tgz がちょうど1件 ----
  let tarball = null;
  if (!fs.existsSync(artifactDir)) {
    record("S1 --artifact-dir に .tgz がちょうど1件", false, artifactDir + " が存在しません");
  } else {
    const found = fs.readdirSync(artifactDir).filter((name) => name.endsWith(".tgz"));
    record("S1 --artifact-dir に .tgz がちょうど1件", found.length === 1, found.join(",") || "0 件");
    if (found.length === 1) tarball = path.join(artifactDir, found[0]);
  }

  // 展開先は実行ごとに一意な名前にする。既存ディレクトリを消して作り直さない
  // （破壊的操作を持ち込まない。残置しても後続の実行に干渉しない）。
  const runId = new Date().toISOString().replace(/[^0-9]/g, "") + "-" + process.pid;
  const extractRoot = path.join(artifactDir, ".smoke-extract-" + runId);
  const stageDir = path.join(artifactDir, ".smoke-stage-" + runId);
  let packageDir = null;
  let manifest = null;

  if (tarball) {
    fs.mkdirSync(extractRoot, { recursive: true });
    execFileSync("tar", ["-xzf", tarball, "-C", extractRoot], { stdio: "inherit" });
    packageDir = path.join(extractRoot, "package");
  }

  // ---- S2: package.json の name / version が repo と一致する ----
  if (packageDir && fs.existsSync(path.join(packageDir, "package.json"))) {
    manifest = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
    const local = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
    const same = manifest.name === local.name && manifest.version === local.version;
    record("S2 name / version が repo の package.json と一致する", same, manifest.name + "@" + manifest.version);
  } else {
    record("S2 name / version が repo の package.json と一致する", false, "package/package.json を読めません");
  }

  // ---- S3: README.md と README.ja.md が同梱される ----
  if (packageDir) {
    const absent = ["README.md", "README.ja.md"].filter((name) => !fs.existsSync(path.join(packageDir, name)));
    record("S3 README.md と README.ja.md がともに同梱される", absent.length === 0, absent.join(",") || "ok");
  } else {
    record("S3 README.md と README.ja.md がともに同梱される", false, "展開できていません");
  }

  // ---- S4: exports / main / module / types の指す先が実在する ----
  if (packageDir && manifest) {
    const targets = collectExportTargets(manifest.exports ?? {}, new Set());
    for (const key of ["main", "module", "types"]) {
      if (typeof manifest[key] === "string") targets.add(manifest[key]);
    }
    const absent = [...targets].filter((target) => !fs.existsSync(path.join(packageDir, target)));
    record(
      "S4 exports / main / module / types の指す先が tarball 内に実在する",
      absent.length === 0,
      absent.join(",") || [...targets].sort().join(","),
    );
  } else {
    record("S4 exports / main / module / types の指す先が tarball 内に実在する", false, "展開できていません");
  }

  // ---- S5: repo 固有 smoke（配布された tarball の中身だけを対象にする） ----
  if (packageDir && manifest) {
    try {
      const stagedPackage = path.join(stageDir, "node_modules", manifest.name);
      fs.mkdirSync(path.dirname(stagedPackage), { recursive: true });
      fs.cpSync(packageDir, stagedPackage, { recursive: true });
      // staging 直下に別名の package.json を置く。これが無いと Node の self-reference
      // （package.json の name で自分自身を解決する機能）が働き、staging ではなく
      // **repo の作業ツリー**が解決されてしまう（実測で検出した。設計 §6.3
      // 「S5 は配布された tarball の中身だけで実行する」を破る経路である）。
      fs.writeFileSync(
        path.join(stageDir, "package.json"),
        JSON.stringify({ name: "cycle2-artifact-smoke-stage", version: "0.0.0", private: true }, null, 2) + "\n",
      );
      const driverPath = path.join(stageDir, "smoke-driver.mjs");
      fs.writeFileSync(driverPath, SMOKE_DRIVER_SOURCE);
      const stdout = execFileSync(process.execPath, [driverPath], { cwd: stageDir, encoding: "utf8" });
      for (const [label, ok, detail] of JSON.parse(stdout)) record(label, ok, detail);
    } catch (error) {
      record("S5 " + REPO + " 固有 smoke", false, error.message);
    }
  } else {
    record("S5 " + REPO + " 固有 smoke", false, "展開できていません");
  }

  // ---- S6: レポート出力 ----
  const failed = checks.filter((check) => !check.ok);
  const lines = [
    "# Cycle 2 artifact smoke report",
    "repo: " + REPO,
    "package: " + (manifest ? manifest.name + "@" + manifest.version : "(unknown)"),
    "node: " + process.version,
    "platform: " + process.platform + "/" + process.arch,
    "artifact-dir: " + artifactDir,
    "tarball: " + (tarball ? path.basename(tarball) : "(none)"),
    "timestamp: " + new Date().toISOString(),
    "",
    ...checks.map((check) => (check.ok ? "PASS " : "FAIL ") + check.label + " — " + check.detail),
    "",
    "result: " + (failed.length === 0 ? "PASS" : "FAIL (" + failed.length + "/" + checks.length + ")"),
  ];
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, lines.join("\n") + "\n");
  process.stdout.write(lines.join("\n") + "\n");

  if (failed.length > 0) process.exitCode = 1;
}

main();
