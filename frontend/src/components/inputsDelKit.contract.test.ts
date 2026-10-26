import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **K1 — todo booleano es un switch; el checkbox no existe en el kit.**
 * («reemplazar check por switcher, a veces siento que no te decides por uno u
 * otro», spec remasterización §4.)
 *
 * Dos cláusulas:
 *
 * (a) ARCHIVOS MIGRADOS al kit: cero casillas y cero `<input`/`<select`
 *     crudos. Sus controles son PulsoSwitch, PulsoInput, PulsoSelect y
 *     PulsoField. Un archivo entra aquí cuando se migra por completo.
 * (b) RATCHET del resto del árbol: el conteo de `type="checkbox"` por archivo
 *     solo puede BAJAR. Subir un conteo o abrir un archivo nuevo con casillas
 *     falla. Para bajar un conteo se edita el snapshot de abajo (y, si llega a
 *     cero, se borra la entrada).
 *
 * Y una tercera, de C1: (c) dos `PulsoField` hermanos van dentro de un
 * `PulsoFieldRow`, que declara su grupo geométrico. Sueltos, el runner los
 * cuenta como colección sin contrato (`geometry-undeclared`).
 *
 * **Falsos negativos conocidos** (el escaneo es textual, no un AST):
 * - `type` que llega por spread (`{...props}`) o por ternario/variable
 *   (`type={esBool ? "checkbox" : "text"}`) no casa con el patrón;
 * - una casilla artesanal con `role="checkbox"` sobre un `<div>`/`<button>`
 *   no se cuenta como casilla;
 * - solo se recorren `.tsx`: un `createElement("input", { type: "checkbox" })`
 *   en un `.ts` queda fuera;
 * - (c) solo ve hermanos ADYACENTES en el texto (`</PulsoField>` seguido de
 *   `<PulsoField`); dos campos separados por otro nodo o generados en un
 *   `.map` escapan, y la fila se reconoce por el `<PulsoFieldRow` abierto más
 *   cercano hacia atrás, sin entender anidamiento.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Migrados por completo (L27 Cálculo de muestra › Marco, Aulas y Salida, y
 * Validación › Roles). Analítica › Datos (L26) se migró en la rama del 10/10
 * pero no entró en el rescate: main ya la había rehecho; queda por migrar.
 */
const ARCHIVOS_MIGRADOS = [
  "features/calcMuestra/universidad/aulas/AulasObjetivoTab.tsx",
  "features/calcMuestra/universidad/aulas/AulasRerandomizacionTab.tsx",
  "features/calcMuestra/universidad/aulas/DescuentoRepetidosControl.tsx",
  "features/calcMuestra/universidad/aulas/VariablesBalanceControl.tsx",
  "features/calcMuestra/universidad/criterios/FacultadesExcluidasCard.tsx",
  "features/calcMuestra/universidad/marco/GruposTamanoEditor.tsx",
  "features/calcMuestra/universidad/salidas/SalidasEntregablesTab.tsx",
  "features/calcMuestra/universidad/salidas/SalidasResultadosTab.tsx",
  "features/validacion/components/RolesDeclarados.tsx",
] as const;

/** Las primitivas del kit: no son consumidores, no entran al ratchet. */
const KIT = new Set([
  "components/PulsoSwitch.tsx",
  "components/PulsoInput.tsx",
  "components/PulsoSelect.tsx",
  "components/PulsoField.tsx",
  "components/Switch.tsx",
]);

/**
 * Casillas por archivo. En la rama del 2026-10-11 eran 85 (105 en L26, y
 * L27 tanda 2 bajó Cálculo de muestra › Aulas/Salida y Validación). Al rescatar
 * la rama sobre main (2026-10-26) la foto se tomó de nuevo sobre el árbol de
 * hoy: 79 en 53 archivos. Solo baja.
 */
const SNAPSHOT_CASILLAS: Record<string, number> = {
  "features/analitica/dimensiones/shared/CombinarVarsPanel.tsx": 1,
  "features/analitica/panes/CodebookPane.tsx": 1,
  "features/analitica/panes/ComparativosLista.tsx": 2,
  "features/analitica/panes/CrucesPane.tsx": 1,
  "features/analitica/panes/EnumeradoresPane.tsx": 1,
  "features/carga/AcreditacionBatchPanel.tsx": 1,
  "features/carga/ArmonizacionEscalaCompartida.tsx": 2,
  "features/carga/ArmonizacionFilaEditor.tsx": 1,
  "features/carga/BasesPanel.tsx": 3,
  "features/carga/MapaBasesPanel.tsx": 1,
  "features/carga/ReconciliacionExtraDialog.tsx": 1,
  "features/carga/fuentes/NuevaBaseFormularioPublicado.tsx": 1,
  "features/carga/segmentos/SegmentoEnBase.tsx": 1,
  "features/carga/variablesBase/AnexarColumnas.tsx": 1,
  "features/carga/variablesBase/CalculadaEditor.tsx": 1,
  "features/carga/variablesBase/ColumnasDeLaBase.tsx": 2,
  "features/codificacion/CodingConfigActions.tsx": 2,
  "features/codificacion/PalabrasPanel.tsx": 1,
  "features/codificacion/RespuestasCodificador.tsx": 1,
  "features/dashboard/curation/DashboardCurationGate.tsx": 2,
  "features/dashboard/customize/DashboardCustomizeDialog.tsx": 5,
  "features/dashboard/publish/DashboardPublishDialog.tsx": 1,
  "features/dashboard/source/DashboardSourceGate.tsx": 1,
  "features/dashboard/tabs/BaseDatosTab/index.tsx": 2,
  "features/dashboard/tabs/DimensionesTab/index.tsx": 2,
  "features/dashboard/tabs/RelacionTab/index.tsx": 1,
  "features/dashboard/tabs/ResumenTab/FiltrosMultiRow.tsx": 2,
  "features/graficos/SuggestedPlanButton.tsx": 1,
  "features/graficos/compartir/PlanPortatilContenido.tsx": 1,
  "features/graficos/compartir/SeccionesJsonContenido.tsx": 1,
  "features/graficos/estilo/DialogoLinea.tsx": 3,
  "features/graficos/laminas/brecha/BrechaEntreGrupos.tsx": 1,
  "features/graficos/laminas/matriz/MatrizCuadrantes.tsx": 1,
  "features/graficos/temasEquivalentes/EditorTemasEquivalentes.tsx": 1,
  "features/graficos/v2/timeline/SlidePicker.tsx": 1,
  "features/hojasRuta/HojasRutaPage.tsx": 1,
  "features/home/GlobalSettingsDialog.tsx": 1,
  "features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx": 5,
  "features/monitoreo/profiles/acreditacion/fuentes/ActoresDelEstudio.tsx": 1,
  "features/monitoreo/profiles/acreditacion/modelo/DistribucionPorActor.tsx": 1,
  "features/monitoreo/profiles/aulas/AulasFiltrosDeEfectiva.tsx": 1,
  "features/monitoreo/profiles/telefonico/TelefonicoMonitoreoPage.tsx": 7,
  "features/monitoreo/profiles/territorial/TerritorialQuotaConsistencyPanel.tsx": 1,
  "features/recopiladores/AccessSection.tsx": 1,
  "features/recopiladores/correos/ImportarSecciones.tsx": 1,
  "features/recopiladores/editor/AjustesDelBloque.tsx": 1,
  "features/xlsformEditor/choiceFilters/ListaFija.tsx": 1,
  "features/xlsformEditor/choiceFilters/VistaEncuestado.tsx": 1,
  "features/xlsformEditor/inspector/BasicTab.tsx": 1,
  "features/xlsformEditor/inspector/MoreTab.tsx": 1,
  "features/xlsformEditor/shell/MatrizPulsoDialog.tsx": 1,
  "features/xlsformEditor/shell/SmConexionSection.tsx": 1,
  "features/xlsformEditor/shell/SmImportResumen.tsx": 1,
};

const CASILLA = /type=\{?["']checkbox["']\}?/g;
const INPUT_CRUDO = /<input[\s/>]/g;
const SELECT_CRUDO = /<select[\s/>]/g;
const MENSAJE = "todo booleano es un switch: usa PulsoSwitch (components/PulsoSwitch.tsx)";

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
const contar = (texto: string, patron: RegExp) => (texto.match(patron) ?? []).length;

/** Posiciones de `PulsoField` hermanos adyacentes que no están dentro de un `PulsoFieldRow`. */
function hermanosSinFila(texto: string): number[] {
  const fuera: number[] = [];
  const adyacentes = /<\/PulsoField>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<PulsoField[\s>]/g;
  for (const match of texto.matchAll(adyacentes)) {
    const antes = texto.slice(0, match.index);
    const abre = antes.lastIndexOf("<PulsoFieldRow");
    const cierra = antes.lastIndexOf("</PulsoFieldRow>");
    if (abre === -1 || cierra > abre) fuera.push(match.index ?? 0);
  }
  return fuera;
}

describe("inputs del kit · C1 de PulsoField", () => {
  test("detecta hermanos sueltos y acepta los que van en fila", () => {
    const suelto = '<div><PulsoField label="A"><x /></PulsoField>\n<PulsoField label="B"><y /></PulsoField></div>';
    const enFila = '<PulsoFieldRow geometryGroup="g"><PulsoField label="A"><x /></PulsoField><PulsoField label="B"><y /></PulsoField></PulsoFieldRow>';
    expect(hermanosSinFila(suelto)).toHaveLength(1);
    expect(hermanosSinFila(enFila)).toEqual([]);
    expect(hermanosSinFila(`${enFila}${suelto}`)).toHaveLength(1);
  });

  test("ningún archivo deja dos PulsoField hermanos fuera de un PulsoFieldRow", () => {
    const sueltos = archivosTsx(SRC)
      .filter((archivo) => !KIT.has(relativo(archivo)))
      .filter((archivo) => hermanosSinFila(fs.readFileSync(archivo, "utf8")).length > 0)
      .map(relativo);
    expect(sueltos, "envuelve los PulsoField hermanos en un PulsoFieldRow con geometryGroup").toEqual([]);
  });
});

describe("inputs del kit · K1", () => {
  test.each(ARCHIVOS_MIGRADOS)("%s no tiene casillas ni inputs/selects crudos", (archivo) => {
    const texto = fs.readFileSync(path.join(SRC, archivo), "utf8");
    expect(contar(texto, CASILLA), `${archivo}: ${MENSAJE}`).toBe(0);
    expect(contar(texto, INPUT_CRUDO), `${archivo}: usa PulsoInput dentro de PulsoField`).toBe(0);
    expect(contar(texto, SELECT_CRUDO), `${archivo}: usa PulsoSelect dentro de PulsoField`).toBe(0);
  });

  test("las primitivas del kit no traen casillas", () => {
    for (const archivo of KIT) {
      const texto = fs.readFileSync(path.join(SRC, archivo), "utf8");
      expect(contar(texto, CASILLA), archivo).toBe(0);
    }
  });

  test("ratchet: ningún archivo sube su conteo de casillas ni aparece uno nuevo", () => {
    const actual: Record<string, number> = {};
    for (const archivo of archivosTsx(SRC)) {
      const rel = relativo(archivo);
      if (KIT.has(rel)) continue;
      const n = contar(fs.readFileSync(archivo, "utf8"), CASILLA);
      if (n > 0) actual[rel] = n;
    }
    const regresiones = Object.entries(actual)
      .filter(([rel, n]) => n > (SNAPSHOT_CASILLAS[rel] ?? 0))
      .map(([rel, n]) => `${rel}: ${SNAPSHOT_CASILLAS[rel] ?? 0} → ${n}`);
    expect(
      regresiones,
      `${MENSAJE}. Casillas nuevas en:\n${regresiones.join("\n")}\n` +
        "Si bajaste un conteo, edita SNAPSHOT_CASILLAS en este archivo.",
    ).toEqual([]);
  });

  test("ratchet: el snapshot no guarda conteos que ya bajaron (se edita al migrar)", () => {
    const desfasados = Object.entries(SNAPSHOT_CASILLAS).filter(([rel, n]) => {
      const archivo = path.join(SRC, rel);
      const actual = fs.existsSync(archivo) ? contar(fs.readFileSync(archivo, "utf8"), CASILLA) : 0;
      return actual < n;
    });
    expect(
      desfasados.map(([rel, n]) => `${rel}: snapshot ${n}`),
      "Bajó un conteo de casillas: actualiza SNAPSHOT_CASILLAS para que el ratchet no ceda terreno.",
    ).toEqual([]);
  });

  test("los migrados no figuran en el snapshot", () => {
    for (const archivo of ARCHIVOS_MIGRADOS) expect(SNAPSHOT_CASILLAS[archivo]).toBeUndefined();
  });
});
