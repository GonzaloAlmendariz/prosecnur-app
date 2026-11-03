import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Carga deja de pintar «·» (P3 de la pasada de formato).** Gonzalo, 3 nov 2026: «No
 * entiendo esa necesidad de seguir agregando puntos … cuando ya te dije que no los uses».
 * Los datos se unen con coma o con `enumerar` (lib/enumerar.ts). Ratchet por archivo: el
 * conteo sólo BAJA y un archivo nuevo con «·» falla; al limpiar uno, se baja su número aquí.
 *
 * Foto del 3 nov 2026: 194 en 54 archivos (218 en 56 antes de limpiar CargaPage y BasesPanel).
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

const SNAPSHOT: Record<string, number> = {
  "AcreditacionBatchPanel.tsx": 1,
  "ArmonizacionEscalaCompartida.tsx": 1,
  "CargaBaseFilePicker.tsx": 3,
  "CargaHidratando.tsx": 1,
  "CargaManualBaseLanes.tsx": 1,
  "CargaMonitoringDiscovery.tsx": 3,
  "CargaPlanCoverageModel.ts": 4,
  "CargaPlanOverview.tsx": 1,
  "CargaReviewSummary.tsx": 2,
  "CargaStructureWorkbench.tsx": 1,
  "CargaUniverseFilter.tsx": 3,
  "ChoiceMappingReviewDialog.tsx": 2,
  "EquivalenciasPanel.tsx": 4,
  "EscalaChip.tsx": 1,
  "IntegratedInstrumentsWizard.tsx": 9,
  "MapaBasesPanel.tsx": 1,
  "OrigenExternoPanel.tsx": 1,
  "PreguntaCombobox.tsx": 1,
  "PreguntasPanel.tsx": 4,
  "ProcessingIntakePanel.tsx": 2,
  "RespuestasResumen.tsx": 2,
  "SavBundleImportPanel.tsx": 5,
  "SeccionesPanel.tsx": 1,
  "acreditacionBatchModel.ts": 1,
  "armonizacionModel.ts": 1,
  "cargaReviewFuentesModel.ts": 3,
  "esquemaBaseModel.ts": 2,
  "fuentes/BasesDelEstudio.tsx": 1,
  "fuentes/CompararFuentesVista.tsx": 2,
  "fuentes/NuevaBaseFormularioPublicado.tsx": 1,
  "fuentes/VariableComparadaTarjeta.tsx": 2,
  "fuentes/VistaPreviaFormularioPublicado.tsx": 1,
  "fuentes/compararFuentesModel.ts": 2,
  "fuentes/formularioPublicadoModel.ts": 2,
  "importEnSegundoPlano.ts": 1,
  "independiente/IndependentSiblingsWizard.tsx": 51,
  "independiente/SmDecisionSuite.tsx": 9,
  "indicadorCompuestoModel.ts": 4,
  "origenExternoModel.ts": 1,
  "plataforma/ImportadorPlataforma.tsx": 3,
  "preguntaEquivalenteModel.ts": 1,
  "processingIntakeModel.ts": 3,
  "reconciliacionModel.ts": 1,
  "recorridoSerie/recorridoSerieModel.ts": 5,
  "respuestasResumenModel.ts": 1,
  "savBundleImportModel.ts": 4,
  "segmentos/SegmentoEnBase.tsx": 1,
  "segmentos/segmentosModel.ts": 3,
  "smEstructuraFuente.ts": 4,
  "surveymonkey/smBasesModel.ts": 17,
  "variablesBase/AnexarColumnas.tsx": 3,
  "variablesBase/ColumnasDeLaBase.tsx": 1,
  "variablesBase/SelectorPreguntas.tsx": 1,
  "variablesBase/variablesBaseModel.ts": 8,
};

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return fuentes(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const puntos = (f: string) =>
  (f.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n").match(/·/g) ?? []).length;

describe("Carga no suma «·»", () => {
  const conteo = fuentes(aqui).map((f) => [path.relative(aqui, f).split(path.sep).join("/"), puntos(readFileSync(f, "utf8"))] as const);

  it("el barrido ve Carga (centinela)", () => {
    expect(conteo.length).toBeGreaterThan(100);
  });

  it("ningún archivo suma «·» ni aparece uno nuevo con «·»", () => {
    const regresiones = conteo
      .filter(([archivo, n]) => n > (SNAPSHOT[archivo] ?? 0))
      .map(([archivo, n]) => `${archivo}: ${SNAPSHOT[archivo] ?? 0} → ${n}`);
    expect(regresiones).toEqual([]);
  });
});
