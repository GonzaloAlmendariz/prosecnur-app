#!/usr/bin/env node
import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_VERSION = 2;
const STAMP_SCHEMA = "prosecnur_frontend_build_stamp_v1";
const ENV_KEYS = ["VITE_BASE_PATH", "VITE_PULSO_PUBLIC_MODE"];
const IGNORE_FILE_NAMES = new Set([".DS_Store"]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const frontendDir = path.join(repoRoot, "frontend");
const buildDir = path.join(repoRoot, "api", "inst", "www");
const buildIndex = path.join(buildDir, "index.html");
const stampPath = path.join(buildDir, ".frontend-build-stamp.json");

function rel(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function statOrNull(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function listFiles(filePath) {
  const st = await statOrNull(filePath);
  if (!st) return [];
  if (st.isFile()) {
    return IGNORE_FILE_NAMES.has(path.basename(filePath)) ? [] : [filePath];
  }
  if (!st.isDirectory()) return [];

  const entries = await fs.readdir(filePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (IGNORE_FILE_NAMES.has(entry.name)) continue;
    const child = path.join(filePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(child));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

async function frontendRootFiles() {
  const entries = await fs.readdir(frontendDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => (
      name === "index.html" ||
      name === "package.json" ||
      name === "pnpm-lock.yaml" ||
      /^vite\.config\.[cm]?[jt]s$/.test(name) ||
      /^tsconfig.*\.json$/.test(name)
    ))
    .map((name) => path.join(frontendDir, name));
}

async function inputFiles() {
  const roots = [
    path.join(frontendDir, "src"),
    path.join(frontendDir, "public"),
    ...await frontendRootFiles(),
  ];
  const files = [];
  for (const root of roots) {
    files.push(...await listFiles(root));
  }
  return Array.from(new Set(files.map((file) => path.resolve(file)))).sort();
}

async function fingerprintInputs() {
  const files = await inputFiles();
  const fileHashes = {};
  const hash = crypto.createHash("sha256");
  hash.update(`schema:${STAMP_SCHEMA}\n`);
  hash.update(`script_version:${SCRIPT_VERSION}\n`);

  const env = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key] || ""]));
  hash.update(`env:${JSON.stringify(env)}\n`);

  for (const file of files) {
    const st = fsSync.statSync(file);
    const fileHash = `${st.size}:${Math.floor(st.mtimeMs)}`;
    const key = rel(file);
    fileHashes[key] = fileHash;
    hash.update(`${key}\0${fileHash}\n`);
  }

  return {
    fingerprint: hash.digest("hex"),
    env,
    files: fileHashes,
    files_count: files.length,
  };
}

async function readStamp() {
  try {
    return JSON.parse(await fs.readFile(stampPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    return { invalid: true, error: error.message };
  }
}

function diffFiles(previous = {}, current = {}) {
  const changed = [];
  const removed = [];
  const added = [];
  const allKeys = Array.from(new Set([...Object.keys(previous), ...Object.keys(current)])).sort();
  for (const key of allKeys) {
    if (!(key in previous)) added.push(key);
    else if (!(key in current)) removed.push(key);
    else if (previous[key] !== current[key]) changed.push(key);
  }
  return { added, changed, removed };
}

function summarizeDiff(diff) {
  const parts = [];
  for (const [label, files] of [
    ["modificados", diff.changed],
    ["agregados", diff.added],
    ["eliminados", diff.removed],
  ]) {
    if (!files.length) continue;
    const sample = files.slice(0, 6).join(", ");
    const suffix = files.length > 6 ? `, +${files.length - 6} mas` : "";
    parts.push(`${label}: ${sample}${suffix}`);
  }
  return parts;
}

async function checkStatus() {
  const current = await fingerprintInputs();
  const reasons = [];

  if (!await exists(buildIndex)) {
    reasons.push(`falta ${rel(buildIndex)}`);
  }

  const stamp = await readStamp();
  if (!stamp) {
    reasons.push(`falta ${rel(stampPath)}`);
  } else if (stamp.invalid) {
    reasons.push(`stamp ilegible: ${stamp.error}`);
  } else {
    if (stamp.schema !== STAMP_SCHEMA) reasons.push("schema de stamp distinto");
    if (stamp.script_version !== SCRIPT_VERSION) reasons.push("version de fingerprint distinta");
    if (stamp.fingerprint !== current.fingerprint) {
      reasons.push("fingerprint de inputs cambio");
      reasons.push(...summarizeDiff(diffFiles(stamp.files, current.files)));
    }
    const previousEnv = JSON.stringify(stamp.env || {});
    const currentEnv = JSON.stringify(current.env);
    if (previousEnv !== currentEnv) {
      reasons.push(`variables de build cambiaron: ${previousEnv} -> ${currentEnv}`);
    }
  }

  return { fresh: reasons.length === 0, reasons, current };
}

async function writeStamp() {
  if (!await exists(buildIndex)) {
    console.error(`No puedo escribir stamp: falta ${rel(buildIndex)}.`);
    process.exit(2);
  }
  const current = await fingerprintInputs();
  const stamp = {
    schema: STAMP_SCHEMA,
    script_version: SCRIPT_VERSION,
    created_at: new Date().toISOString(),
    fingerprint: current.fingerprint,
    env: current.env,
    files_count: current.files_count,
    files: current.files,
    build_index: rel(buildIndex),
  };
  await fs.mkdir(buildDir, { recursive: true });
  await fs.writeFile(stampPath, `${JSON.stringify(stamp, null, 2)}\n`);
  console.log(`OK Stamp frontend actualizado (${current.fingerprint.slice(0, 12)}, ${current.files_count} archivos).`);
}

function usage() {
  console.error("Uso: node scripts/frontend-build-status.mjs [--check|--stamp]");
}

const mode = process.argv[2] || "--check";
if (!["--check", "--stamp"].includes(mode)) {
  usage();
  process.exit(2);
}

if (mode === "--stamp") {
  await writeStamp();
} else {
  const status = await checkStatus();
  if (status.fresh) {
    console.log(`OK Frontend vigente; saltando build (${status.current.fingerprint.slice(0, 12)}, ${status.current.files_count} archivos).`);
    process.exit(0);
  }
  console.log("Frontend faltante o desactualizado:");
  for (const reason of status.reasons) console.log(`  - ${reason}`);
  process.exit(1);
}
