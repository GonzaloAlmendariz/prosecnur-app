import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P4 de la pasada de formato — un conteo de Gráficos lleva separador de millares.**
 *
 * Un `{x.length}` pegado en el JSX escribe «1234 disponibles» al lado de un
 * «1,234» formateado. Los que cuentan variables o preguntas (los únicos que
 * pasan de 999 en un estudio real) van por `formatoConteo` de `lib/formatoNumero`
 * desde el 2 nov 2026; el resto cuenta láminas, avisos o capítulos y este
 * ratchet sólo los deja bajar. `toLocaleString` suelto no vuelve.
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
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const LENGTH_CRUDO = /(?<![=\w])\{[\w.!?]+\.length\}|\$\{[\w.!?]+\.length\}/g;

/** Foto del 2 nov 2026. Sólo baja. */
const SNAPSHOT_LENGTH_CRUDO: Record<string, number> = {
  "ArgField.tsx": 7,
  "GraficadorPicker.tsx": 1,
  "GraficosHeader.tsx": 4,
  "IconosEditor.tsx": 1,
  "MultibaseReportMenu.tsx": 1,
  "PlanCoverageBadge.tsx": 2,
  "PlanHealthBadge.tsx": 5,
  "SuggestedPlanButton.tsx": 1,
  "avisosPlan.ts": 1,
  "compartir/accionesCompartir.ts": 1,
  "estilo/ColoresRespuestas.tsx": 6,
  "estiloInforme/SeccionCalculos.tsx": 1,
  "indice/EditorIndice.tsx": 2,
  "laminas/DatosGrafico.tsx": 2,
  "laminas/EstructuraInforme.tsx": 1,
  "laminas/InspectorLamina.tsx": 2,
  "laminas/OrdenCategoriasGrafico.tsx": 1,
  "laminas/PanelAvisos.tsx": 2,
  "laminas/TiraMiniaturas.tsx": 2,
  "laminas/VisorLamina.tsx": 1,
  "laminas/citas/CitasAprobadas.tsx": 2,
  "laminas/contenidoEspecial/ActoresObjetivo.tsx": 2,
  "laminas/contenidoEspecial/FilasFichaTecnica.tsx": 1,
  "laminas/maqueta/fichaModelo.ts": 1,
  "laminas/maqueta/geometriaFicha.ts": 1,
  "laminas/miniaturas/anuncioTira.ts": 1,
  "laminas/selectores/SelectorTipoGrafico.tsx": 1,
  "laminas/selectores/SelectorTipoLamina.tsx": 1,
  "multiApiladasScale.ts": 1,
  "multiapiladas/TemasPorPublico.tsx": 1,
  "temasEquivalentes/temasEquivalentesModel.ts": 1,
  "usePlanValidator.ts": 1,
  "v2/inspector/FiltersPanel.tsx": 2,
  "v2/timeline/SlidePicker.tsx": 1,
  "vistaGeneral/EstructuraLateral.tsx": 2,
  "vistaGeneral/modeloVistaGeneral.ts": 1,
  "word/DetalleGraficos.tsx": 1,
  "word/PestanaWord.tsx": 1,
};

describe("cifras de Gráficos por el formateador compartido · P4", () => {
  const conteo: Record<string, number> = {};
  for (const f of archivos(aqui)) {
    const n = sinComentarios(readFileSync(f, "utf8")).match(LENGTH_CRUDO)?.length ?? 0;
    if (n > 0) conteo[rel(f)] = n;
  }

  it("ningún archivo suma conteos crudos ni aparece uno nuevo", () => {
    expect(archivos(aqui).length).toBeGreaterThan(300);
    const regresiones = Object.entries(conteo)
      .filter(([f, n]) => n > (SNAPSHOT_LENGTH_CRUDO[f] ?? 0))
      .map(([f, n]) => `${f}: ${SNAPSHOT_LENGTH_CRUDO[f] ?? 0} → ${n}`);
    expect(regresiones, "Usa formatoConteo(x.length) de lib/formatoNumero.").toEqual([]);
  });

  it("el snapshot no guarda conteos que ya bajaron", () => {
    const viejos = Object.entries(SNAPSHOT_LENGTH_CRUDO)
      .filter(([f, n]) => (conteo[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${conteo[f] ?? 0}`);
    expect(viejos).toEqual([]);
  });

  it("nadie formatea por su cuenta con toLocaleString", () => {
    const hallazgos = archivos(aqui)
      .filter((f) => /\.toLocaleString\(\s*["'`]es/.test(sinComentarios(readFileSync(f, "utf8"))))
      .map(rel);
    expect(hallazgos).toEqual([]);
  });
});
