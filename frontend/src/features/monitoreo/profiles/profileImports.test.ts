import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const profilesDir = path.dirname(fileURLToPath(import.meta.url));
const profileFolders = ["territorial", "acreditacion", "aulas", "telefonico"];
const importSpecifier = /(?:from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\))/g;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [entryPath] : [];
  });
}

describe("monitoreo profile import boundary", () => {
  for (const folder of profileFolders) {
    test(`${folder} no importa MonitoreoPage`, () => {
      const files = sourceFiles(path.join(profilesDir, folder));
      const offenders = files
        .filter((file) => {
          const source = fs.readFileSync(file, "utf8");
          return Array.from(source.matchAll(importSpecifier)).some((match) => {
            const specifier = match[1] ?? match[2] ?? "";
            return path.basename(specifier) === "MonitoreoPage";
          });
        })
        .map((file) => path.relative(profilesDir, file));

      expect(offenders).toEqual([]);
    });
  }
});
