import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **L1 — un overlay nuevo usa components/Dialog o Sideover.**
 *
 * La primitiva (`components/Dialog.tsx` + `Sideover.tsx`, sobre Radix Dialog)
 * trae lo que los diálogos artesanales no tenían: focus trap, Escape,
 * `aria-modal`, foco de vuelta al disparador, apertura por `?panel=` y el
 * acento del módulo re-inyectado en el portal.
 *
 * RATCHET: el conteo de `role="dialog"` escrito a mano por archivo solo puede
 * BAJAR. Subir un conteo o abrir un archivo nuevo con `role="dialog"` falla.
 * Al migrar un overlay a la primitiva se baja su conteo editando el snapshot
 * de abajo (y si llega a cero, se borra la entrada). La meta de V1 es 0.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Las primitivas mismas: no son consumidoras, no entran al ratchet.
 *
 * `components/Popover.tsx` es la primitiva de clase popover (no modal, sin
 * focus trap) y escribe su `role="dialog"` a mano porque no monta Radix: el
 * GOAL V1 se enmendó en el commit 9bf1e15 para contarla como primitiva del
 * kit, igual que Dialog y Sideover.
 */
const PRIMITIVA = new Set([
  "components/Dialog.tsx",
  "components/Sideover.tsx",
  "components/Popover.tsx",
]);

/** Primitivas que NO escriben `role="dialog"` a mano: lo pone Radix. */
const PRIMITIVA_RADIX = ["components/Dialog.tsx", "components/Sideover.tsx"];

/**
 * `role="dialog"` por archivo a fecha de 2026-10-11, sin las primitivas: 56 en
 * total, antes 62 (61 consumidores + Popover). Bajaron 5: Reconciliación y los
 * tres diálogos del Dashboard migraron a `Dialog`; EscalaChip se mudó a
 * `Popover`, que no es Dialog sino la primitiva de clase popover. Solo baja.
 */
const SNAPSHOT_DIALOGOS: Record<string, number> = {
  "components/LogsPanel.tsx": 1,
  "features/analitica/dimensiones/confirmar-import/JsonImportPanel.tsx": 1,
  "features/bitacora/Calendar.tsx": 1,
  "features/bitacora/avisos/CentroDeAvisos.tsx": 1,
  "features/bitacora/canvas/ExploradorDeReferencias.tsx": 1,
  "features/bitacora/portabilidad/PanelImportar.tsx": 1,
  "features/bitacora/vinculos/SelectorDeVinculo.tsx": 1,
  "features/calcMuestra/universidad/criterios/PresetCanonicoButton.tsx": 1,
  "features/carga/CargaPage.tsx": 1,
  "features/dashboard/shared/FullscreenWrapper.tsx": 1,
  "features/dashboard/tabs/DimensionesTab/index.tsx": 1,
  "features/graficos/ArgField.tsx": 1,
  "features/graficos/DefaultsModal.tsx": 1,
  "features/graficos/ExportarInformeMenu.tsx": 1,
  "features/graficos/GraficosHeader.tsx": 3,
  "features/graficos/MultiApiladasBuilder.tsx": 1,
  "features/graficos/MultibaseReportMenu.tsx": 1,
  "features/graficos/PlanCoverageBadge.tsx": 1,
  "features/graficos/PlanHealthBadge.tsx": 1,
  "features/graficos/ShortcutsModal.tsx": 1,
  "features/graficos/SlidePreview.tsx": 1,
  "features/graficos/SuggestedPlanButton.tsx": 1,
  "features/graficos/VariablePicker.tsx": 1,
  "features/graficos/VarsListPicker.tsx": 1,
  "features/graficos/laminas/EditorAmplio.tsx": 1,
  "features/graficos/v2/shell/EstiloGlobalDialog.tsx": 1,
  "features/graficos/v2/timeline/TimelinePanelV2.tsx": 1,
  "features/home/CreditsDrawer.tsx": 1,
  "features/home/GlobalSettingsDialog.tsx": 1,
  "features/home/ModulePickerDialog.tsx": 1,
  "features/home/ReleaseNotesDrawer.tsx": 1,
  "features/monitoreo/fuentes/ConectarFuente.tsx": 1,
  "features/monitoreo/profiles/aulas/AulasPopoverReemplazo.tsx": 1,
  "features/monitoreo/profiles/aulas/AulasPopoverRefuerzo.tsx": 1,
  "features/monitoreo/profiles/aulas/RegistroDeCampo.tsx": 1,
  "features/monitoreo/profiles/territorial/TerritorialFieldOccurrencesWorkbench.tsx": 1,
  "features/monitoreo/profiles/territorial/TerritorialOccurrencesSourceBar.tsx": 1,
  "features/monitoreo/profiles/territorial/TerritorialValidationGeoWorkbench.tsx": 1,
  "features/project/ProjectLifecycleDialog.tsx": 1,
  "features/validacion/components/ContextLens.tsx": 1,
  "features/validacion/components/CrossBar.tsx": 1,
  "features/xlsformEditor/XlsformEditorPage.tsx": 3,
  "features/xlsformEditor/canvas-graph/ConnectionConditionPicker.tsx": 1,
  "features/xlsformEditor/canvas-graph/LogicCanvas.tsx": 1,
  "features/xlsformEditor/choiceFilters/ChoiceFiltersView.tsx": 1,
  "features/xlsformEditor/shell/Coachmarks.tsx": 1,
  "features/xlsformEditor/shell/ConfigurarPdfDialog.tsx": 1,
  "features/xlsformEditor/shell/DiagnosticsPopover.tsx": 1,
  "features/xlsformEditor/shell/FormSimulator.tsx": 1,
  "features/xlsformEditor/shell/FormSummaryView.tsx": 1,
  "features/xlsformEditor/shell/ImportSurveyMonkeyDialog.tsx": 1,
  "features/xlsformEditor/shell/MatrizPulsoDialog.tsx": 1,
};

const ROLE_DIALOG = /role=(?:"dialog"|'dialog'|\{\s*["']dialog["']\s*\})/g;
const MENSAJE = "un overlay nuevo usa components/Dialog o Sideover";

function archivosTsx(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    if (entrada.name === "node_modules") return [];
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return archivosTsx(completo);
    if (!entrada.name.endsWith(".tsx") || /\.test\.tsx$/.test(entrada.name)) return [];
    return [completo];
  });
}

const relativo = (archivo: string) => path.relative(SRC, archivo).split(path.sep).join("/");

function conteoActual(): Record<string, number> {
  const actual: Record<string, number> = {};
  for (const archivo of archivosTsx(SRC)) {
    const rel = relativo(archivo);
    if (PRIMITIVA.has(rel)) continue;
    const n = (fs.readFileSync(archivo, "utf8").match(ROLE_DIALOG) ?? []).length;
    if (n > 0) actual[rel] = n;
  }
  return actual;
}

describe("overlays del kit · L1", () => {
  test("ratchet: ningún archivo sube su conteo de role=\"dialog\" ni aparece uno nuevo", () => {
    const actual = conteoActual();
    const regresiones = Object.entries(actual)
      .filter(([archivo, n]) => n > (SNAPSHOT_DIALOGOS[archivo] ?? 0))
      .map(([archivo, n]) => `${archivo}: ${SNAPSHOT_DIALOGOS[archivo] ?? 0} → ${n}`);
    expect(regresiones, MENSAJE).toEqual([]);
  });

  test("ratchet: el snapshot no guarda conteos que ya bajaron (se edita al migrar)", () => {
    const actual = conteoActual();
    const desfasados = Object.entries(SNAPSHOT_DIALOGOS).filter(
      ([archivo, n]) => (actual[archivo] ?? 0) < n,
    );
    expect(
      desfasados.map(([archivo, n]) => `${archivo}: snapshot ${n} → ${actual[archivo] ?? 0}`),
      "Bajó un conteo de role=\"dialog\": actualiza SNAPSHOT_DIALOGOS para que el ratchet no ceda terreno.",
    ).toEqual([]);
  });

  test("las primitivas no figuran en el snapshot", () => {
    for (const archivo of PRIMITIVA) expect(SNAPSHOT_DIALOGOS[archivo]).toBeUndefined();
  });

  test("la primitiva no escribe role=\"dialog\" a mano: lo pone Radix", () => {
    for (const archivo of PRIMITIVA_RADIX) {
      const texto = fs.readFileSync(path.join(SRC, archivo), "utf8");
      expect((texto.match(ROLE_DIALOG) ?? []).length, archivo).toBe(0);
    }
  });
});
