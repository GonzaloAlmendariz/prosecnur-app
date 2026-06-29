#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const engine = path.join(__dirname, "monitoreo-performance-check.mjs");
const args = process.argv.slice(2);

function hasOption(name) {
  return args.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Uso:
node scripts/monitoreo-hydration-performance-check.mjs \\
  --project-territorial "/ruta/ACNURCG.pulso" \\
  --project-acreditacion "/ruta/ACRDCONTA.pulso" \\
  --project-aulas "/ruta/aulas.pulso" \\
  --project-telefonico "/ruta/telefonico.pulso" \\
  --url http://127.0.0.1:5174/ \\
  --api-url http://127.0.0.1:8788 \\
  --out tmp/perf/monitoreo-hydration \\
  --entry-mode session|bootgate \\
  --tab-scope critical|all

Los proyectos omitidos se reportan como skipped: project not provided.
El reporte se escribe en report.json, summary.json, report.md y screenshots/.`);
  process.exit(0);
}

if (!hasOption("--out")) {
  args.push("--out", path.join("tmp", "perf", "monitoreo-hydration"));
}

const child = spawn(process.execPath, [engine, ...args], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[monitoreo-hydration-performance-check] stopped by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
