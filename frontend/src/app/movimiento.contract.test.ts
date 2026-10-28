import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **L37 — contrato de movimiento** (censo docs/qa/censo-animaciones-2026-10-10.md §5).
 *
 * Tres ratchets por hoja de estilo, que sólo bajan:
 *  - `layout`: `transition` sobre width/height/top/left/right/bottom/margin/padding (anima el layout: se siente
 *    pesado y fuerza reflujo; lo de la casa es transform y opacity);
 *  - `infinitas`: `animation … infinite` (sólo spinner y skeleton deberían tenerla: el movimiento que no
 *    informa, distrae);
 *  - `retardo`: `animation-delay` mayor de 90 ms (el escalonado largo se siente lento; tope 4 × 30 ms).
 * Foto del 2026-10-28 fuera de Monitoreo (su sesión): layout 60 en 29 hojas, infinitas 62 en 34, retardo 113 en 21.
 * Al corregir una hoja, se baja su entrada aquí.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUERA_DE_ALCANCE = ["features/monitoreo/"];
const LAYOUT = /\b(width|height|top|left|right|bottom|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?)\b/;

const SNAPSHOT: Record<"layout" | "infinitas" | "retardo", Record<string, number>> = {
  layout: {
    "app/theme.css": 9,
    "features/calcMuestra/calcMuestra.css": 3,
    "features/calcMuestra/didactica/didactica.css": 1,
    "features/calcMuestra/motor/pestanas/cobertura.css": 1,
    "features/calcMuestra/universidad/aulas/perfilMuestra.css": 1,
    "features/calcMuestra/universidad/aulas/relato/relato.css": 2,
    "features/calcMuestra/universidad/criterios/criterios.css": 1,
    "features/calcMuestra/universidad/criterios/mordidasEstudiante.css": 1,
    "features/calcMuestra/universidad/definicion/historicoEstudio.css": 3,
    "features/calcMuestra/universidad/marco/marco.css": 2,
    "features/calcMuestra/universidad/salidas/embudoComparado.css": 1,
    "features/calcMuestra/universidad/salidas/seleccionComparada.css": 1,
    "features/calcMuestra/universidad/shared/graficos/graficos.css": 2,
    "features/calcMuestra/universidad/ui/ui.css": 1,
    "features/carga/carga-v2.css": 3,
    "features/carga/plataforma/importador-plataforma.css": 1,
    "features/dashboard/tabs/DimensionesTab/dimensiones.css": 2,
    "features/dashboard/tabs/DimensionesTab/foda.css": 2,
    "features/dashboard/theme/tokens.css": 2,
    "features/graficos/laminas/maqueta/fichaRanura.css": 2,
    "features/graficos/v2/styles/editor-v2.css": 2,
    "features/home/home-v2.css": 1,
    "features/recopiladores/correos/correosBarra.css": 1,
    "features/recopiladores/correos/correosRecorte.css": 1,
    "features/recopiladores/correos/correosSincronizacion.css": 1,
    "features/xlsformEditor/styles/xf-canvas.css": 1,
    "features/xlsformEditor/styles/xlsform-v2/07-secciones-largas-20-pregunta.css": 1,
  },
  infinitas: {
    "app/boot.css": 5,
    "app/module-warmup.css": 1,
    "app/theme.css": 7,
    "components/bases-inspector.css": 1,
    "components/kit-skeleton.css": 1,
    "components/recent-project-card.css": 1,
    "components/states.css": 1,
    "features/analitica/analitica-v2.css": 3,
    "features/bitacora/cronograma.css": 1,
    "features/calcMuestra/calcMuestra.css": 1,
    "features/calcMuestra/didactica/didactica.css": 1,
    "features/calcMuestra/didactica/metodoGooEsquema.css": 12,
    "features/calcMuestra/universidad/aulas/relato/relato.css": 2,
    "features/calcMuestra/universidad/criterios/confirmadorCriterio.css": 1,
    "features/calcMuestra/universidad/criterios/criterios.css": 1,
    "features/carga/EquivalenciasEsqueleto.css": 1,
    "features/carga/fuentes/formularioPublicado.css": 1,
    "features/carga/plataforma/importador-plataforma.css": 2,
    "features/codificacion/AdaptarAplicacion.css": 1,
    "features/dashboard/customize/customize.css": 1,
    "features/dashboard/tabs/DimensionesTab/dimensiones.css": 1,
    "features/dashboard/tabs/DimensionesTab/foda.css": 1,
    "features/dashboard/tabs/DimensionesTab/indicador-assembly.css": 1,
    "features/dashboard/theme/tokens.css": 1,
    "features/graficos/laminas/visorLamina.css": 1,
    "features/graficos/v2/styles/editor-v2.css": 1,
    "features/procesamiento/processingSheetViewer.css": 1,
    "features/xlsformEditor/impreso/impreso.css": 1,
    "features/xlsformEditor/listas/listas.css": 1,
    "features/xlsformEditor/styles/xf-campana/01-campana-complementaria-adr-0.css": 1,
    "features/xlsformEditor/styles/xf-graph/02-mini-map.css": 2,
    "features/xlsformEditor/styles/xf-home/01-xf-home-css-hub-biblioteca-d.css": 1,
    "features/xlsformEditor/styles/xf-sm-import/01-dialogo-traducir-encuesta-de.css": 1,
  },
  retardo: {
    "app/boot.css": 5,
    "app/theme.css": 2,
    "components/recent-project-card.css": 3,
    "features/analitica/analitica-v2.css": 2,
    "features/calcMuestra/calcMuestra.css": 3,
    "features/calcMuestra/didactica/metodoGooEsquema.css": 1,
    "features/calcMuestra/general/movimiento.css": 8,
    "features/calcMuestra/universidad/aulas/relato/relato.css": 1,
    "features/calcMuestra/universidad/calculo/calculo.css": 4,
    "features/calcMuestra/universidad/definicion/definicion.css": 4,
    "features/calcMuestra/universidad/marco/marco.css": 6,
    "features/calcMuestra/universidad/salidas/salidas.css": 7,
    "features/calcMuestra/universidad/ui/ui.css": 5,
    "features/home/home-v2.css": 2,
    "features/validacion/validacion-v2.css": 3,
    "features/xlsformEditor/styles/xf-graph/02-mini-map.css": 1,
    "features/xlsformEditor/styles/xf-inspector.css": 2,
    "features/xlsformEditor/styles/xf-simulator.css": 3,
    "features/xlsformEditor/styles/xlsform-v2/01-movido-desde-app-theme-css-r.css": 2,
  },
};

function contar(css: string): { layout: number; infinitas: number; retardo: number } {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const layout = [...limpio.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)/g)].filter(([, valor]) => LAYOUT.test(valor)).length;
  const infinitas = [...limpio.matchAll(/animation(?:-iteration-count)?\s*:[^;}]*\binfinite\b/g)].length;
  const retardo = [...limpio.matchAll(/animation-delay\s*:\s*([^;}]+)/g)].filter(([, valor]) =>
    [...valor.matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/g)].some(([, n, unidad]) => Number(n) * (unidad === "s" ? 1000 : 1) > 90),
  ).length;
  return { layout, infinitas, retardo };
}

function hojas(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return hojas(ruta);
    return entrada.name.endsWith(".css") ? [ruta] : [];
  });
}

const actual: Record<"layout" | "infinitas" | "retardo", Record<string, number>> = { layout: {}, infinitas: {}, retardo: {} };
let vistas = 0;
for (const ruta of hojas(SRC)) {
  const archivo = path.relative(SRC, ruta).split(path.sep).join("/");
  if (FUERA_DE_ALCANCE.some((prefijo) => archivo.startsWith(prefijo))) continue;
  vistas += 1;
  const n = contar(fs.readFileSync(ruta, "utf8"));
  for (const eje of ["layout", "infinitas", "retardo"] as const) if (n[eje] > 0) actual[eje][archivo] = n[eje];
}

describe("contrato de movimiento · L37", () => {
  test("el barrido ve las hojas: si deja de casar, no puede quedar verde", () => {
    expect(vistas).toBeGreaterThan(100);
    expect(Object.keys(actual.layout).length).toBeGreaterThan(5);
  });

  for (const eje of ["layout", "infinitas", "retardo"] as const) {
    test(`${eje}: ninguna hoja suma ni aparece una nueva`, () => {
      const regresiones = Object.entries(actual[eje])
        .filter(([archivo, n]) => n > (SNAPSHOT[eje][archivo] ?? 0))
        .map(([archivo, n]) => `${archivo}: ${SNAPSHOT[eje][archivo] ?? 0} → ${n}`);
      expect(regresiones).toEqual([]);
    });

    test(`${eje}: el snapshot no guarda conteos que ya bajaron`, () => {
      const viejos = Object.entries(SNAPSHOT[eje])
        .filter(([archivo, n]) => (actual[eje][archivo] ?? 0) < n)
        .map(([archivo, n]) => `${archivo}: ${n} → ${actual[eje][archivo] ?? 0}`);
      expect(viejos).toEqual([]);
    });
  }
});
