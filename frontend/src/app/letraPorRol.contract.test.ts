import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **L29 — la letra se escribe por rol, no en píxeles, en los módulos sin dueño.**
 *
 * Los ocho roles viven en `app/tipografia.css` (`var(--pulso-type-<rol>-size)`).
 * Este ratchet cuenta los `font-size` literales en px por hoja de Home,
 * Dashboard, Formularios, Analítica, Carga y Procesamiento, y sólo deja que
 * bajen: una hoja nueva con literales o una que suma falla. Al migrar una hoja
 * se baja su conteo aquí. Home es la primera migrada (2026-11-01, 76 → 2): las
 * dos que quedan son títulos de presentación de 20 px, entre `title` y
 * `display`, con su motivo junto a la declaración.
 * Foto del 2026-11-01: 105 hojas, 1949 declaraciones.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULOS = ["features/home", "features/dashboard", "features/xlsformEditor", "features/analitica", "features/carga", "features/procesamiento"];
const LITERAL = /font-size\s*:\s*\d+(?:\.\d+)?px/g;

const SNAPSHOT_LITERALES: Record<string, number> = {
  "features/dashboard/customize/customize.css": 30,
  "features/dashboard/shared/fullscreen.css": 4,
  "features/dashboard/tabs/BaseDatosTab/baseDatos.css": 14,
  "features/dashboard/tabs/DimensionesTab/dimensiones.css": 19,
  "features/dashboard/tabs/DimensionesTab/foda.css": 39,
  "features/dashboard/tabs/DimensionesTab/indicador-assembly.css": 8,
  "features/dashboard/tabs/DimensionesTab/matriz_unidades.css": 9,
  "features/dashboard/tabs/RelacionTab/relacion.css": 7,
  "features/dashboard/theme/tokens.css": 78,
  "features/home/home-v2.css": 2,
  "features/xlsformEditor/ajustes/calidadCampo.css": 7,
  "features/xlsformEditor/canvas-graph/condicionPanel.css": 16,
  "features/xlsformEditor/canvas-graph/detalleNodo.css": 4,
  "features/xlsformEditor/canvas-graph/listaLogica.css": 20,
  "features/xlsformEditor/canvas-graph/vistaLista.css": 4,
  "features/xlsformEditor/canvas/constructor/panelConfiguracion.css": 1,
  "features/xlsformEditor/canvas/constructor/tarjetaPregunta.css": 2,
  "features/xlsformEditor/canvas/contenidoSeccion.css": 5,
  "features/xlsformEditor/canvas/ficha/ficha.css": 59,
  "features/xlsformEditor/cuestionario/cuestionario.css": 23,
  "features/xlsformEditor/impreso/impreso.css": 17,
  "features/xlsformEditor/kit/kit.css": 17,
  "features/xlsformEditor/kit/riel.css": 18,
  "features/xlsformEditor/listas/listas.css": 20,
  "features/xlsformEditor/opciones/opciones.css": 22,
  "features/xlsformEditor/outline/estructura.css": 12,
  "features/xlsformEditor/pestanas/armador/armador.css": 19,
  "features/xlsformEditor/pestanas/pestanas.css": 52,
  "features/xlsformEditor/resumen/tiposConMaqueta.css": 3,
  "features/xlsformEditor/sheets/editorXlsform.css": 9,
  "features/xlsformEditor/shell/addElementMenu.css": 3,
  "features/xlsformEditor/shell/simulador/panelesPrueba.css": 13,
  "features/xlsformEditor/styles/xf-campana/01-campana-complementaria-adr-0.css": 16,
  "features/xlsformEditor/styles/xf-campana/02-leyenda-del-umbral-junto-al.css": 20,
  "features/xlsformEditor/styles/xf-canvas.css": 8,
  "features/xlsformEditor/styles/xf-choice-filters.css": 38,
  "features/xlsformEditor/styles/xf-detalle.css": 6,
  "features/xlsformEditor/styles/xf-editor-chrome.css": 6,
  "features/xlsformEditor/styles/xf-graph/01-movido-desde-app-theme-css-r.css": 10,
  "features/xlsformEditor/styles/xf-graph/02-mini-map.css": 5,
  "features/xlsformEditor/styles/xf-graph/03-leyenda-minimap-indicador-de.css": 2,
  "features/xlsformEditor/styles/xf-home/01-xf-home-css-hub-biblioteca-d.css": 16,
  "features/xlsformEditor/styles/xf-home/02-avisos-de-publicacion-p-ej-u.css": 18,
  "features/xlsformEditor/styles/xf-home/03-tarjeta-expandida-ocupa-la-f.css": 9,
  "features/xlsformEditor/styles/xf-inspector.css": 10,
  "features/xlsformEditor/styles/xf-leyenda.css": 6,
  "features/xlsformEditor/styles/xf-logic.css": 12,
  "features/xlsformEditor/styles/xf-logica-externa.css": 12,
  "features/xlsformEditor/styles/xf-preview-inputs.css": 9,
  "features/xlsformEditor/styles/xf-sheets.css": 15,
  "features/xlsformEditor/styles/xf-simulator.css": 17,
  "features/xlsformEditor/styles/xf-sm-import/01-dialogo-traducir-encuesta-de.css": 18,
  "features/xlsformEditor/styles/xf-sm-import/02-buscador-de-encuestas-u5.css": 26,
  "features/xlsformEditor/styles/xf-summary/01-el-overlay-de-antes-sigue-ex.css": 13,
  "features/xlsformEditor/styles/xf-summary/02-secciones.css": 12,
  "features/xlsformEditor/styles/xf-surveymonkey-dialog.css": 8,
  "features/xlsformEditor/styles/xf-text-rules.css": 14,
  "features/xlsformEditor/styles/xlsform-v2/01-movido-desde-app-theme-css-r.css": 10,
  "features/xlsformEditor/styles/xlsform-v2/02-fila-con-campo-numerico-tope.css": 12,
  "features/xlsformEditor/styles/xlsform-v2/03-seccion-fila-de-apertura-com.css": 16,
  "features/xlsformEditor/styles/xlsform-v2/04-header-de-columnas-fila-no-e.css": 22,
  "features/xlsformEditor/styles/xlsform-v2/05-choice-row-fila-ordenable-de.css": 21,
  "features/xlsformEditor/styles/xlsform-v2/06-toggle-segmentado-valor-preg.css": 21,
  "features/xlsformEditor/styles/xlsform-v2/07-secciones-largas-20-pregunta.css": 14,
  "features/xlsformEditor/styles/xlsform-v2/08-sub-paso-elegir-lista-para-p.css": 18,
  "features/xlsformEditor/styles/xlsform-v2/09-cataloginfoblock-seccion-din.css": 29,
  "features/xlsformEditor/styles/xlsform-v2/10-aa-en-texto-chico-sobre-soft.css": 21,
  "features/xlsformEditor/styles/xlsform-v2/11-parte.css": 17,
  "features/xlsformEditor/styles/xlsform-v2/12-el-contenido-de-un-details-n.css": 20,
};

function hojas(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return hojas(ruta);
    return entrada.name.endsWith(".css") ? [ruta] : [];
  });
}

function conteoActual(): { conteo: Record<string, number>; vistas: number } {
  const conteo: Record<string, number> = {};
  let vistas = 0;
  for (const modulo of MODULOS) {
    for (const ruta of hojas(path.join(SRC, modulo))) {
      vistas += 1;
      const archivo = path.relative(SRC, ruta).split(path.sep).join("/");
      const css = fs.readFileSync(ruta, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      const n = css.match(LITERAL)?.length ?? 0;
      if (n > 0) conteo[archivo] = n;
    }
  }
  return { conteo, vistas };
}

describe("letra por rol en los módulos sin dueño · L29", () => {
  const { conteo, vistas } = conteoActual();

  test("el barrido ve las hojas: si deja de casar, no puede quedar verde", () => {
    expect(vistas).toBeGreaterThan(40);
  });

  test("ninguna hoja suma font-size en px ni aparece una nueva", () => {
    const regresiones = Object.entries(conteo)
      .filter(([archivo, n]) => n > (SNAPSHOT_LITERALES[archivo] ?? 0))
      .map(([archivo, n]) => `${archivo}: ${SNAPSHOT_LITERALES[archivo] ?? 0} → ${n}`);
    expect(regresiones, "Usa var(--pulso-type-<rol>-size) de app/tipografia.css.").toEqual([]);
  });

  test("el snapshot no guarda conteos que ya bajaron", () => {
    const viejos = Object.entries(SNAPSHOT_LITERALES)
      .filter(([archivo, n]) => (conteo[archivo] ?? 0) < n)
      .map(([archivo, n]) => `${archivo}: ${n} → ${conteo[archivo] ?? 0}`);
    expect(viejos).toEqual([]);
  });
});
