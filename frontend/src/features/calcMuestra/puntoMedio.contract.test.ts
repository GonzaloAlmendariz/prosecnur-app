import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P3 de la pasada de formato — el punto medio no es un separador.**
 *
 * Cálculo de muestra cosía datos con « · » en 348 líneas de código (más 434 en
 * comentarios, que no cuentan): «niveles 2–10 · 2 facultades exentas»,
 * «Respuesta esperada · margen ±5.0%». Una lista se une con coma o con «y»
 * (`lib/enumerar`); datos de distinto tipo van en otra línea. La fuente más
 * repetida eran 38 `join(" · ")`, que pasan a coma el 2 nov 2026.
 *
 * Ratchet por archivo: sólo baja. Lo que queda incluye el producto en una
 * fórmula (`n · deff`), que sí es un punto medio y se queda.
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

/** Líneas de código con « · », sin comentarios de bloque ni de línea. */
function lineasConPunto(fuente: string): number {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, ""))
    .filter((l) => l.includes("·")).length;
}

/** Foto del 2 nov 2026, después de pasar los `join(" · ")` a coma. Sólo baja. */
const SNAPSHOT: Record<string, number> = {
  "CalcMuestraPage.tsx": 4,
  "SelectorTipo.tsx": 2,
  "didactica/MetodoGooEsquema.tsx": 1,
  "didactica/PasoDidactico.tsx": 1,
  "didactica/SeleccionAulasVisual.tsx": 6,
  "didactica/didacticaCharts.ts": 1,
  "didactica/didacticaCopy.ts": 1,
  "didactica/referencia/corpus.ts": 4,
  "dominio/criteriosImpacto.ts": 1,
  "dominio/presets.ts": 2,
  "general/memoriaLatex.ts": 9,
  "motor/ResumenDiseno.tsx": 9,
  "universidad/UniversidadDesk.tsx": 4,
  "universidad/aulas/AulaInspectorPanel.tsx": 4,
  "universidad/aulas/AulasPerfilTab.tsx": 1,
  "universidad/aulas/AulasReemplazosTab.tsx": 1,
  "universidad/aulas/AulasSolidezTab.tsx": 5,
  "universidad/aulas/CertificacionFacultadCard.tsx": 1,
  "universidad/aulas/ClassroomMethodPanels.tsx": 3,
  "universidad/aulas/ClassroomReplacementPanels.tsx": 2,
  "universidad/aulas/ClassroomSelectionMap.tsx": 1,
  "universidad/aulas/DescuentoSecuencialNarrativa.tsx": 2,
  "universidad/aulas/DocenteUnicoAviso.tsx": 1,
  "universidad/aulas/EfectividadExplicadaCard.tsx": 3,
  "universidad/aulas/PerfilSexoBloque.tsx": 1,
  "universidad/aulas/PresupuestoVisitasCard.tsx": 3,
  "universidad/aulas/SeleccionPorFacultadCard.tsx": 3,
  "universidad/aulas/SexoPorFacultadCard.tsx": 1,
  "universidad/aulas/SustentoDimensionamientoCard.tsx": 1,
  "universidad/aulas/classroomHandoff.ts": 2,
  "universidad/aulas/relato/RelatoTab.tsx": 3,
  "universidad/aulas/relato/escenas/EnsamblajeBalanceado.tsx": 1,
  "universidad/aulas/relato/escenas/EscenaSorteo.tsx": 8,
  "universidad/aulas/relato/escenas/EscenaTitulares.tsx": 2,
  "universidad/aulas/relato/escenas/goo.tsx": 6,
  "universidad/aulas/rotulosReservas.ts": 1,
  "universidad/calculo/CadenaAfijacion.tsx": 6,
  "universidad/calculo/CadenaFormulaFacultad.tsx": 1,
  "universidad/calculo/CalculoComparacionEscenarios.tsx": 6,
  "universidad/calculo/CalculoCursosHorarioFacultadTab.tsx": 3,
  "universidad/calculo/CalculoDisenoTab.tsx": 2,
  "universidad/calculo/CalculoDistribucionTab.tsx": 4,
  "universidad/calculo/CalculoPropuestasTab.tsx": 3,
  "universidad/calculo/CertezaCoberturaPanel.tsx": 2,
  "universidad/calculo/DistribucionElegiblesCard.tsx": 3,
  "universidad/calculo/FuenteEfectividadCard.tsx": 1,
  "universidad/calculo/MuestraOperativaCard.tsx": 1,
  "universidad/calculo/TasaEfectividadFacultadCard.tsx": 2,
  "universidad/calculo/TitularesFacultadEditor.tsx": 2,
  "universidad/calculo/calculoDistribucionModel.ts": 4,
  "universidad/criterios/CategoriaEvidencia.tsx": 1,
  "universidad/criterios/CriterioCard.tsx": 6,
  "universidad/criterios/CriterioComposicionCard.tsx": 5,
  "universidad/criterios/DistribucionCategoria.tsx": 1,
  "universidad/criterios/FacultadCategoriaToggles.tsx": 1,
  "universidad/criterios/FichaPorFacultadCard.tsx": 3,
  "universidad/criterios/MinElegiblesCard.tsx": 2,
  "universidad/criterios/PresetCanonicoButton.tsx": 1,
  "universidad/criterios/SaludCriteriosCard.tsx": 1,
  "universidad/criterios/TipoSesionPorFacultad.tsx": 2,
  "universidad/criterios/controles.tsx": 1,
  "universidad/criterios/criteriosMarcoModel.ts": 1,
  "universidad/criterios/facultades.tsx": 1,
  "universidad/definicion/DefBasesTab.tsx": 4,
  "universidad/definicion/DefEstudioTab.tsx": 2,
  "universidad/definicion/DefVariablesTab.tsx": 1,
  "universidad/definicion/ExploradorBasesTab.tsx": 9,
  "universidad/definicion/HistoricoEstudioPanel.tsx": 11,
  "universidad/definicion/RankingDesempenoCard.tsx": 5,
  "universidad/definicion/ReferenciaAsistenciaCard.tsx": 4,
  "universidad/definicion/exploradorBasesValores.ts": 2,
  "universidad/marco/AlumnosPorChMarcoTab.tsx": 3,
  "universidad/marco/AlumnosPorChTira.tsx": 1,
  "universidad/marco/AulasFinalesCard.tsx": 1,
  "universidad/marco/BoxplotElegibles.tsx": 4,
  "universidad/marco/CriteriosEmbudoVivo.tsx": 1,
  "universidad/marco/CriteriosRadiografiaCardDetalle.tsx": 15,
  "universidad/marco/CriteriosRadiografiaConsola.tsx": 2,
  "universidad/marco/CursosHorarioMarcoTab.tsx": 2,
  "universidad/marco/CursosHorarioSexo.tsx": 1,
  "universidad/marco/FacultadDecisionBloque.tsx": 3,
  "universidad/marco/FacultadRadiografiaCard.tsx": 2,
  "universidad/marco/MatrizCascadaCriterios.tsx": 3,
  "universidad/marco/MatrizEmbudoCriterios.tsx": 2,
  "universidad/marco/PanoramaCursosHorario.tsx": 5,
  "universidad/marco/ParticularidadesPanel.tsx": 2,
  "universidad/marco/TipoSesionRadiografia.tsx": 6,
  "universidad/marco/marcoCards.tsx": 2,
  "universidad/marco/marcoCharts.tsx": 2,
  "universidad/marco/matrizCascadaModel.ts": 1,
  "universidad/salidas/EmbudoComparadoFacultades.tsx": 1,
  "universidad/salidas/HistorialCorridas.tsx": 3,
  "universidad/salidas/SalidasMonitoreoTab.tsx": 1,
  "universidad/salidas/SeleccionComparadaCard.tsx": 1,
  "universidad/salidas/sustentoSecciones.ts": 1,
  "universidad/shared/frameIntegrity.ts": 1,
};

describe("punto medio en Cálculo de muestra · P3", () => {
  const conteo: Record<string, number> = {};
  for (const f of archivos(aqui)) {
    const n = lineasConPunto(readFileSync(f, "utf8"));
    if (n > 0) conteo[rel(f)] = n;
  }

  it("el barrido ve el feature", () => {
    expect(archivos(aqui).length).toBeGreaterThan(300);
  });

  it("ningún archivo suma « · » ni aparece uno nuevo", () => {
    const regresiones = Object.entries(conteo)
      .filter(([f, n]) => n > (SNAPSHOT[f] ?? 0))
      .map(([f, n]) => `${f}: ${SNAPSHOT[f] ?? 0} → ${n}`);
    expect(regresiones, "Une con coma o con «y» (lib/enumerar); datos de otro tipo, en otra línea.").toEqual([]);
  });

  it("el snapshot no guarda conteos que ya bajaron", () => {
    const viejos = Object.entries(SNAPSHOT)
      .filter(([f, n]) => (conteo[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${conteo[f] ?? 0}`);
    expect(viejos).toEqual([]);
  });

  it("join con punto medio no vuelve", () => {
    const hallazgos = archivos(aqui).filter((f) => /join\(["'`] · ["'`]\)/.test(readFileSync(f, "utf8"))).map(rel);
    expect(hallazgos).toEqual([]);
  });
});
