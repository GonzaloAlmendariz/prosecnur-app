import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **L28 — una tabla nueva usa components/PulsoTable.**
 *
 * PulsoTable declara el ancho de cada columna, deja una línea por celda con el
 * texto entero en `title`, alinea las cifras y pega la cabecera: lo que cada
 * `<table>` a mano resolvía a su manera y el censo encontró recortado.
 *
 * RATCHET: el conteo de `<table` escritas a mano por archivo sólo puede BAJAR.
 * Subir un conteo o abrir un archivo nuevo con `<table` falla; al migrar una a
 * PulsoTable se baja su conteo aquí (y si llega a cero, se borra la entrada).
 * Foto del 2026-10-28: 83 archivos, 106 tablas.
 *
 * Monitoreo queda fuera mientras lo trabaja su sesión. Las tablas de Cálculo
 * con la gramática `cmv2-tabla` (contrato V9) están en la foto: si PulsoTable
 * las reemplaza o conviven es decisión pendiente del dueño.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUERA_DE_ALCANCE = ["features/monitoreo/"];
const PRIMITIVA = "components/PulsoTable.tsx";

const SNAPSHOT_TABLAS: Record<string, number> = {
  "features/analitica/MetadatosEditor.tsx": 1,
  "features/analitica/panes/PanelBasePane.tsx": 2,
  "features/calcMuestra/ComponenteTablas.tsx": 2,
  // La tabla de metas por actor era la de Actores (2026-11-12): Actores pasó a PulsoTable y la tabla a mano se mudó a Meta.
  "features/calcMuestra/general/MetaAcreditacion.tsx": 1,
  "features/calcMuestra/general/EstratosGeneral.tsx": 1,
  "features/calcMuestra/general/FichaCorrida.tsx": 1,
  "features/calcMuestra/general/RepartoEstratosGrafico.tsx": 1,
  "features/calcMuestra/general/ResultadosComponentes.tsx": 1,
  "features/calcMuestra/general/ResumenMarcoDeclarado.tsx": 2,
  "features/calcMuestra/general/TablaUnidades.tsx": 1,
  "features/calcMuestra/universidad/aulas/AulasObjetivoTab.tsx": 1,
  "features/calcMuestra/universidad/aulas/CertificacionFacultadCard.tsx": 1,
  "features/calcMuestra/universidad/aulas/ClassroomMethodPanels.tsx": 1,
  "features/calcMuestra/universidad/aulas/ClassroomReplacementPanels.tsx": 2,
  "features/calcMuestra/universidad/aulas/ClassroomSelectionPanels.tsx": 2,
  "features/calcMuestra/universidad/aulas/DescuentoRepetidosPanel.tsx": 1,
  "features/calcMuestra/universidad/aulas/EfectividadExplicadaCard.tsx": 2,
  "features/calcMuestra/universidad/aulas/MargenPorFacultadCard.tsx": 1,
  "features/calcMuestra/universidad/aulas/PresupuestoVisitasCard.tsx": 1,
  "features/calcMuestra/universidad/aulas/SexoPorFacultadCard.tsx": 1,
  "features/calcMuestra/universidad/aulas/SustentoDimensionamientoCard.tsx": 1,
  "features/calcMuestra/universidad/aulas/relato/escenas/EscenaEstratos.tsx": 1,
  "features/calcMuestra/universidad/aulas/relato/escenas/EscenaProbabilidades.tsx": 1,
  "features/calcMuestra/universidad/aulas/relato/escenas/EscenaSorteo.tsx": 1,
  "features/calcMuestra/universidad/aulas/relato/escenas/EscenaTitulares.tsx": 1,
  "features/calcMuestra/universidad/calculo/CalculoCursosHorarioFacultadTab.tsx": 1,
  "features/calcMuestra/universidad/calculo/CalculoDisenoTab.tsx": 1,
  "features/calcMuestra/universidad/calculo/CalculoDistribucionTab.tsx": 3,
  "features/calcMuestra/universidad/calculo/CalculoPropuestasTab.tsx": 1,
  "features/calcMuestra/universidad/calculo/CertezaCoberturaPanel.tsx": 1,
  "features/calcMuestra/universidad/criterios/CriteriosGeneralesCard.tsx": 1,
  "features/calcMuestra/universidad/criterios/FichaPorFacultadCard.tsx": 1,
  "features/calcMuestra/universidad/definicion/RankingDesempenoCard.tsx": 1,
  "features/calcMuestra/universidad/marco/AlumnosPorChMarcoTab.tsx": 1,
  "features/calcMuestra/universidad/marco/CriteriosEmbudoVivo.tsx": 1,
  "features/calcMuestra/universidad/marco/FacultadRadiografiaCard.tsx": 1,
  "features/calcMuestra/universidad/marco/MatrizCascadaCriterios.tsx": 1,
  "features/calcMuestra/universidad/marco/MatrizEmbudoCriterios.tsx": 1,
  "features/calcMuestra/universidad/marco/PanoramaCursosHorario.tsx": 1,
  "features/calcMuestra/universidad/marco/TipoSesionRadiografia.tsx": 1,
  "features/calcMuestra/universidad/salidas/HistorialCorridas.tsx": 1,
  "features/calcMuestra/universidad/salidas/SalidasEntregablesTab.tsx": 1,
  "features/calcMuestra/universidad/salidas/SalidasResultadosTab.tsx": 1,
  "features/calcMuestra/universidad/salidas/SeleccionComparadaCard.tsx": 1,
  "features/carga/ArmonizacionFilaEditor.tsx": 1,
  "features/carga/FuentesEmparejamientoTabla.tsx": 1,
  "features/carga/ImportarBloquesDialog.tsx": 2,
  "features/carga/MapaBasesPanel.tsx": 1,
  "features/carga/SavNormalizationReviewDialog.tsx": 1,
  "features/carga/fuentes/VariableComparadaTarjeta.tsx": 1,
  "features/carga/fuentes/VistaPreviaFormularioPublicado.tsx": 1,
  "features/carga/segmentos/SegmentoEnBase.tsx": 1,
  "features/carga/segmentos/SegmentosPanel.tsx": 1,
  "features/carga/variablesBase/CalculadaEditor.tsx": 1,
  "features/codificacion/AgruparCategoriasCodificador.tsx": 3,
  "features/dashboard/tabs/BaseDatosTab/index.tsx": 2,
  "features/dashboard/tabs/DimensionesTab/MatrizUnidadesView.tsx": 1,
  "features/dashboard/tabs/RelacionTab/index.tsx": 1,
  "features/graficos/estiloInforme/SeccionCalculos.tsx": 1,
  "features/graficos/laminas/selectores/MedidasEstandar.tsx": 1,
  "features/procesamiento/ProcessingSheetViewer.tsx": 1,
  "features/recopiladores/AccessSection.tsx": 1,
  "features/recopiladores/OrigenDiferencias.tsx": 1,
  "features/recopiladores/PlanSection.tsx": 1,
  "features/recopiladores/correos/contactos/CruceDeVariables.tsx": 1,
  "features/recopiladores/correos/contactos/ListaDeContactos.tsx": 1,
  "features/xlsformEditor/choiceFilters/MatrizCascada.tsx": 1,
  "features/xlsformEditor/choiceFilters/MatrizPorOpcion.tsx": 1,
  "features/xlsformEditor/listas/OpcionesChips.tsx": 1,
  "features/xlsformEditor/pestanas/ProbarRestriccion.tsx": 1,
  "features/xlsformEditor/resumen/TablaSecciones.tsx": 1,
  "features/xlsformEditor/sheets/TablaHoja.tsx": 1,
  "features/xlsformEditor/shell/RuleWizard.tsx": 1,
  "features/xlsformEditor/shell/VistaCuestionario.tsx": 1,
};

function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return archivos(ruta);
    if (!/\.tsx$/.test(entrada.name) || /\.(test|spec)\.tsx$/.test(entrada.name)) return [];
    return [ruta];
  });
}

function conteoActual(): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const ruta of archivos(SRC)) {
    const archivo = path.relative(SRC, ruta).split(path.sep).join("/");
    if (archivo === PRIMITIVA || FUERA_DE_ALCANCE.some((prefijo) => archivo.startsWith(prefijo))) continue;
    const n = (sinComentarios(fs.readFileSync(ruta, "utf8")).match(/<table[\s>]/g) ?? []).length;
    if (n > 0) conteo[archivo] = n;
  }
  return conteo;
}

describe("tablas del kit · L28", () => {
  const actual = conteoActual();

  test("el barrido encuentra las tablas de la foto: si su filtro deja de casar, no puede quedar verde", () => {
    expect(Object.keys(actual).length).toBeGreaterThan(50);
  });

  test("ningún archivo suma tablas a mano ni aparece uno nuevo", () => {
    const regresiones = Object.entries(actual)
      .filter(([archivo, n]) => n > (SNAPSHOT_TABLAS[archivo] ?? 0))
      .map(([archivo, n]) => `${archivo}: ${SNAPSHOT_TABLAS[archivo] ?? 0} → ${n}`);
    expect(regresiones, "Usa components/PulsoTable.tsx para una tabla nueva.").toEqual([]);
  });

  test("el snapshot no guarda conteos que ya bajaron (se edita al migrar)", () => {
    const viejos = Object.entries(SNAPSHOT_TABLAS)
      .filter(([archivo, n]) => (actual[archivo] ?? 0) < n)
      .map(([archivo, n]) => `${archivo}: ${n} → ${actual[archivo] ?? 0}`);
    expect(viejos).toEqual([]);
  });
});
