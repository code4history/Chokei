#!/usr/bin/env node
/**
 * scripts/verify-renderer-equivalence.mjs — oct26-m5-t8 設計 §5.2
 *
 * 追跡下の SVG（svg/<base>.svg 177 件）を sharp（librsvg 経由）で 28×40 に描画し、
 * 追跡下の PNG（png/<base>.png 177 件）と「機能・構造等価性」を機械判定する。
 * byte 完全一致は別エンジン間で 0/177（実測）のため廃止し、実測値に基づく許容基準を使う。
 *
 *   許容基準（設計 §5.2）:
 *     1. 寸法: 28×40 完全一致（許容差 0）
 *     2. silhouette: 二値 alpha mask（閾値128）の不一致画素率 ≤ 2%
 *     3. 大色差: 画素ごと RGB 最大チャネル差が 30 を超える画素の割合 ≤ 5%
 *     4. 決定性: 同一 SVG の 2 回描画が byte 完全一致
 *
 *   呼び出し: node scripts/verify-renderer-equivalence.mjs [--report=<path>]
 *   依存は Node 標準機能と sharp（既存 devDependency）のみ。新規 devDependency を追加しない。
 *   追跡下の png/ を書き換えない（描画は一時バッファで行い、参照は HEAD:png/<path> から読む）。
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const WIDTH = 28;
const HEIGHT = 40;
const MASK_THRESHOLD = 128;
const BIG_CHANNEL_DIFF = 30;
const GATE = {
  mask_frac_max: 0.02,
  big_frac_max: 0.05,
};

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** 追跡下の png/<base>.png を git ls-files で列挙（glob でなく実パス）する。 */
function listTrackedPngs() {
  const stdout = execFileSync("git", ["ls-files", "png"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return stdout.trim().split("\n").filter(Boolean).sort();
}

/** 追跡下の参照 PNG を HEAD から読む（作業ツリー png/ の書き換えに依存しない）。 */
function readReferencePng(relPath) {
  return execFileSync("git", ["show", `HEAD:${relPath}`], {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** SVG を sharp で 28×40 に描画して PNG buffer を返す。 */
async function renderPng(svgBuffer) {
  return sharp(svgBuffer).resize(WIDTH, HEIGHT).png().toBuffer();
}

/** PNG buffer を RGBA 生ピクセルへデコードする。 */
async function decodePng(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

/** 2 つの RGBA 生ピクセル（同寸法）を比較し、設計 §5.2 の指標を返す。 */
function comparePixels(existing, rendered) {
  const n = existing.width * existing.height;
  let maskMismatch = 0;
  let bigDiff = 0;
  let anyDiff = 0;
  let maxChannelDiff = 0;
  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    const em = existing.data[o + 3] >= MASK_THRESHOLD ? 1 : 0;
    const rm = rendered.data[o + 3] >= MASK_THRESHOLD ? 1 : 0;
    if (em !== rm) maskMismatch += 1;
    let maxc = 0;
    for (let c = 0; c < 3; c += 1) {
      const d = Math.abs(existing.data[o + c] - rendered.data[o + c]);
      if (d > maxc) maxc = d;
    }
    if (maxc > BIG_CHANNEL_DIFF) bigDiff += 1;
    if (maxc >= 1) anyDiff += 1;
    if (maxc > maxChannelDiff) maxChannelDiff = maxc;
  }
  return {
    mask_frac: maskMismatch / n,
    big_frac: bigDiff / n,
    diff_frac: anyDiff / n,
    max_channel_diff: maxChannelDiff,
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (const item of argv.slice(2)) {
    const match = /^--([^=]+)=(.*)$/.exec(item);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv);
  const reportPath = path.resolve(args.report ?? path.join(repoRoot, "renderer-equivalence.json"));

  const pngs = listTrackedPngs();
  const perFile = [];
  const failures = [];
  let dimMismatch = 0;
  let maskFracMax = 0;
  let maskFracSum = 0;
  let bigFracMax = 0;
  let bigFracSum = 0;
  let allDeterministic = true;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chokei-renderer-eq-"));

  for (const relPath of pngs) {
    const base = path.basename(relPath, ".png");
    const svgPath = path.join(repoRoot, "svg", `${base}.svg`);
    const svgBuffer = fs.readFileSync(svgPath);

    // 決定性: 同一 SVG を 2 回描画して byte 一致を測る。
    const renderA = await renderPng(svgBuffer);
    const renderB = await renderPng(svgBuffer);
    const deterministic = sha256(renderA) === sha256(renderB);
    if (!deterministic) allDeterministic = false;

    const reference = readReferencePng(relPath);
    const referenceInfo = await sharp(reference).metadata();
    const dimOk = referenceInfo.width === WIDTH && referenceInfo.height === HEIGHT;
    if (!dimOk) dimMismatch += 1;

    const failReasons = [];
    if (!dimOk) failReasons.push(`dim ${referenceInfo.width}x${referenceInfo.height}`);
    if (!deterministic) failReasons.push("determinism: 2回描画が不一致");

    let metrics = null;
    if (dimOk) {
      const existing = await decodePng(reference);
      const rendered = await decodePng(renderA);
      metrics = comparePixels(existing, rendered);
      maskFracMax = Math.max(maskFracMax, metrics.mask_frac);
      maskFracSum += metrics.mask_frac;
      bigFracMax = Math.max(bigFracMax, metrics.big_frac);
      bigFracSum += metrics.big_frac;
      if (metrics.mask_frac > GATE.mask_frac_max) {
        failReasons.push(`silhouette ${(metrics.mask_frac * 100).toFixed(3)}% > ${GATE.mask_frac_max * 100}%`);
      }
      if (metrics.big_frac > GATE.big_frac_max) {
        failReasons.push(`big-color ${(metrics.big_frac * 100).toFixed(3)}% > ${GATE.big_frac_max * 100}%`);
      }
    }
    if (failReasons.length > 0) failures.push({ base, reasons: failReasons });

    perFile.push({
      base,
      dim: dimOk ? [WIDTH, HEIGHT] : [referenceInfo.width, referenceInfo.height],
      mask_frac: metrics ? metrics.mask_frac : null,
      big_frac: metrics ? metrics.big_frac : null,
      diff_frac: metrics ? metrics.diff_frac : null,
      max_channel_diff: metrics ? metrics.max_channel_diff : null,
      deterministic,
    });
  }

  const total = pngs.length;
  const mean = (sum) => (total === 0 ? 0 : sum / total);
  const gatePass =
    dimMismatch === 0 &&
    maskFracMax <= GATE.mask_frac_max &&
    bigFracMax <= GATE.big_frac_max &&
    allDeterministic;

  const result = {
    total,
    dim_mismatch: dimMismatch,
    mask_frac_max: maskFracMax,
    mask_frac_mean: mean(maskFracSum),
    big_frac_max: bigFracMax,
    big_frac_mean: mean(bigFracSum),
    determinism: allDeterministic,
    gate: {
      dim: dimMismatch === 0,
      silhouette: maskFracMax <= GATE.mask_frac_max,
      big_color: bigFracMax <= GATE.big_frac_max,
      determinism: allDeterministic,
    },
    gate_pass: gatePass,
    failures,
  };

  const chokeiHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  const sharpMeta = {
    name: "sharp",
    sharp_version: sharp.versions?.sharp ?? "unknown",
    vips_version: sharp.versions?.vips ?? "unknown",
  };

  const evidence = {
    meta: {
      delegation_token: "OCT26-IMPL-M5T8-KONARA",
      generated_at: new Date().toISOString(),
      node: process.version,
      renderer: sharpMeta,
      chokei_head: chokeiHead,
      tracked_png_count: total,
      method: "Chokei/svg/<base>.svg (tracked intermediate) → sharp resize(28,40).png() → compare with HEAD:png/<base>.png",
      gate_definitions: {
        dim: "出力 PNG が既存 PNG と寸法完全一致（28×40）。許容差 0",
        silhouette: "二値 alpha mask（閾値128）の不一致画素率 ≤ 2%",
        big_color: "画素ごと RGB 最大チャネル差が 30 を超える画素の割合 ≤ 5%",
        determinism: "同一 SVG の 2 回描画が byte 完全一致",
      },
    },
    result,
    per_file: perFile,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(evidence, null, 2) + "\n");

  const lines = [
    "# Chokei renderer equivalence report (oct26-m5-t8)",
    `total: ${total}`,
    `dim_mismatch: ${dimMismatch}`,
    `silhouette (mask_frac) max: ${(maskFracMax * 100).toFixed(3)}% (gate ≤ 2%)`,
    `big-color (big_frac) max: ${(bigFracMax * 100).toFixed(3)}% (gate ≤ 5%)`,
    `determinism: ${allDeterministic}`,
    `gate_pass: ${gatePass}`,
    `report: ${reportPath}`,
  ];
  process.stdout.write(lines.join("\n") + "\n");

  if (!gatePass) {
    process.stdout.write(`failures: ${JSON.stringify(failures, null, 2)}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
