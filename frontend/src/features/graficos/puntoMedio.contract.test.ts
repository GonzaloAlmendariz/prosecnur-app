import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P3 de la pasada de formato — el punto medio no es un separador.**
 *
 * La UI de Gráficos cosía datos con « · » en 38 líneas de código: «Informe
 * compartido · 4 bases», «3 seleccionadas · 120 disponibles», avisos del
 * motor encadenados con « · ». Una lista se une con coma o «y»; avisos, con
 * punto y coma; un dato que precisa a otro va entre paréntesis.
 *
 * Meta 0 salvo las líneas declaradas abajo, que no son separadores de texto:
 * leen el formato de los mensajes del backend («… · E_CODIGO») o el rótulo
 * «Lámina N · “título”» que el motor de exportación también emite, y el punto
 * que marca una casilla sin gráficos en el reparto.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : archivos(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");

function lineasConPunto(fuente: string): number {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, ""))
    .filter((l) => l.includes("·")).length;
}

/** Líneas que leen o reproducen un formato ajeno (backend, motor), no separan texto. */
const DECLARADAS: Record<string, number> = {
  "ExportarInformeMenu.tsx": 2,
  // Lee el formato de los errores del backend («mensaje · E_CODIGO», api/core.ts) para quitar el código del mensaje.
  "laminas/diferencias/useDiferencias.ts": 1,
  "humanizeExportError.ts": 1,
  "laminas/citas/useCitasCandidatas.ts": 1,
  "laminas/miniaturas/loteMiniaturas.ts": 1,
  "laminas/useCategoriasGrafico.ts": 1,
  "avisosExportacion/avisosExportacionModel.ts": 1,
  "rotuloLamina.ts": 1,
  "laminas/selectores/RepartoGraficos.tsx": 1,
};

describe("punto medio en Gráficos (P3)", () => {
  it("ningún archivo usa « · » como separador fuera de los declarados", () => {
    const fuentes = archivos(aqui);
    expect(fuentes.length).toBeGreaterThan(300);
    const hallazgos = fuentes
      .map((f) => [rel(f), lineasConPunto(readFileSync(f, "utf8"))] as const)
      .filter(([f, n]) => n > (DECLARADAS[f] ?? 0))
      .map(([f, n]) => `${f}: ${DECLARADAS[f] ?? 0} → ${n}`);
    expect(hallazgos, "Une con coma o «y»; avisos con punto y coma; una precisión entre paréntesis.").toEqual([]);
  });
});
