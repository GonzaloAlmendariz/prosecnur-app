import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P2 de la pasada de formato — un bloque con marco es un `Panel`.**
 *
 * Cada vista armaba su caja con borde, radio y padding propios: de ahí salen los
 * bloques sin cabecera, las tarjetas de grosores distintos y la meta en sitios
 * distintos. La gramática es una: contenedor `components/Panel`, cifras
 * `CifrasEnTarjeta`, avance `BarraDeAvance`. Este ratchet cuenta, por hoja, las
 * reglas que dibujan una caja (borde sólido, radio y padding en la misma regla)
 * y sólo deja que bajen: una vista que pasa al kit baja su conteo, y una hoja
 * nueva no estrena cajas propias.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function hojas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return hojas(completo);
    return e.name.endsWith(".css") ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");

export function cajasDeLaHoja(css: string): number {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("}")
    .filter((b) => /border\s*:[^;]*solid/.test(b) && /border-radius/.test(b) && /padding/.test(b)).length;
}

/** Foto del 2 nov 2026. Sólo baja. */
const SNAPSHOT: Record<string, number> = {
  "BarraExtraControl.css": 1,
  "armarDesde/armarDesde.css": 1,
  "avisosExportacion/avisosExportacion.css": 3,
  "compartir/compartir.css": 2,
  "estilo/coloresPendientes.css": 1,
  "estilo/coloresRespuestas.css": 2,
  "estilo/estilo.css": 16,
  "estiloInforme/casos.css": 1,
  "estiloInforme/estiloInforme.css": 6,
  "graficadorPicker.css": 4,
  "indice/editorIndice.css": 4,
  "indice/fijadosIndice.css": 2,
  "laminas/barraLaminas.css": 3,
  "laminas/citas/citasAprobadas.css": 2,
  "laminas/colores/coloresGrafico.css": 1,
  "laminas/colores/paletaDelGrafico.css": 3,
  "laminas/contenidoEspecial/contenidoEspecial.css": 2,
  "laminas/datosGrafico.css": 6,
  "laminas/estructuraInforme.css": 2,
  "laminas/guias/guias.css": 3,
  "laminas/inspectorLamina.css": 4,
  "laminas/laminasWorkbench.css": 1,
  "laminas/maquetaLamina.css": 1,
  "laminas/ordenCategorias.css": 2,
  "laminas/panelAvisos.css": 1,
  "laminas/selectores/selectores.css": 5,
  "laminas/tiraMiniaturas.css": 4,
  "laminas/visorLamina.css": 5,
  "lineaFijadaRecetario.css": 2,
  "multiapiladas/multiapiladas.css": 4,
  "subpestanas/segmentado.css": 1,
  "subpestanas/subpestanas.css": 1,
  "temasEquivalentes/temasEquivalentes.css": 3,
  "v2/styles/editor-v2.css": 287,
  "v2/timeline/slidePicker.css": 5,
  "vistaGeneral/vistaGeneral.css": 8,
  "word/word.css": 2,
};

describe("cajas propias (P2)", () => {
  const conteo: Record<string, number> = {};
  for (const f of hojas(aqui)) {
    const n = cajasDeLaHoja(readFileSync(f, "utf8"));
    if (n > 0) conteo[rel(f)] = n;
  }

  it("ninguna hoja suma cajas propias ni aparece una nueva", () => {
    expect(hojas(aqui).length).toBeGreaterThan(40);
    const regresiones = Object.entries(conteo)
      .filter(([f, n]) => n > (SNAPSHOT[f] ?? 0))
      .map(([f, n]) => `${f}: ${SNAPSHOT[f] ?? 0} → ${n}`);
    expect(regresiones, "Un bloque con marco es components/Panel.").toEqual([]);
  });

  it("el snapshot no guarda conteos que ya bajaron", () => {
    expect(Object.keys(SNAPSHOT).length).toBeGreaterThan(5);
    const viejos = Object.entries(SNAPSHOT)
      .filter(([f, n]) => (conteo[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${conteo[f] ?? 0}`);
    expect(viejos).toEqual([]);
  });

  it("el detector reconoce una caja", () => {
    expect(cajasDeLaHoja(".a { border: 1px solid red; border-radius: 4px; padding: 8px; }")).toBe(1);
    expect(cajasDeLaHoja(".a { border-radius: 4px; padding: 8px; }")).toBe(0);
  });
});
