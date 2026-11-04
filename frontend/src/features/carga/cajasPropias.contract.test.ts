import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cajasDeLaHoja } from "../../test/cajasPropias";

/**
 * **P2 de la pasada de formato de Carga — un bloque con marco es un `Panel`** (4 nov 2026).
 *
 * Cuenta, por hoja, las reglas que dibujan una caja (borde sólido, radio y padding en la misma regla)
 * y sólo deja que bajen. Las secciones con cabecera de Armonización, Mapa de bases, Variables de la base y
 * Segmentos son Panel (8 de 13). Su regla `.pulso-armon-seccion` la siguen usando las cinco que no abren con
 * cabecera, así que el conteo no baja todavía. Las 211 son en su mayoría pasos del asistente de SurveyMonkey, tarjetas
 * de base y filas de matriz (`docs/qa/formato-carga-2026-11-04.md`, «P2»).
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


/** Foto del 4 nov 2026. Sólo baja. */
const SNAPSHOT: Record<string, number> = {
  "ArmonizacionEscalaCompartida.css": 3,
  "ArmonizacionFilaEditor.css": 5,
  "BaseSavPanel.css": 3,
  "EquivalenciasEsqueleto.css": 1,
  "EquivalenciasPanel.css": 14,
  "ImportarBloquesDialog.css": 3,
  "IndicadorCompuestoEditor.css": 5,
  "MapaBasesPanel.css": 3,
  "OrigenExternoPanel.css": 8,
  "PreguntaCombobox.css": 1,
  "carga-hidratacion.css": 5,
  "carga-sources.css": 11,
  "carga-v2.css": 142,
  "fuentes/armonizacionBase.css": 1,
  "fuentes/basesDelEstudio.css": 10,
  "fuentes/compararFuentes.css": 9,
  "fuentes/formularioPublicado.css": 8,
  "fuentesEmparejamiento.css": 10,
  "plataforma/importador-plataforma.css": 3,
  "recorridoSerie/RecorridoSerie.css": 3,
  "segmentos/segmentos.css": 3,
  "variablesBase/variablesBase.css": 7,
};

describe("cajas propias de Carga (P2)", () => {
  const conteo: Record<string, number> = {};
  for (const f of hojas(aqui)) {
    const n = cajasDeLaHoja(readFileSync(f, "utf8"));
    if (n > 0) conteo[rel(f)] = n;
  }

  it("ninguna hoja suma cajas propias ni aparece una nueva", () => {
    expect(hojas(aqui).length).toBeGreaterThan(20);
    const regresiones = Object.entries(conteo)
      .filter(([f, n]) => n > (SNAPSHOT[f] ?? 0))
      .map(([f, n]) => `${f}: ${SNAPSHOT[f] ?? 0} → ${n}`);
    expect(regresiones, "Un bloque con marco es components/Panel.").toEqual([]);
  });

  it("el snapshot no guarda conteos que ya bajaron", () => {
    const viejos = Object.entries(SNAPSHOT)
      .filter(([f, n]) => (conteo[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${conteo[f] ?? 0}`);
    expect(viejos).toEqual([]);
  });

  it("el detector reconoce una caja", () => {
    expect(cajasDeLaHoja(".a { border: 1px solid red; border-radius: 4px; padding: 8px; }")).toBe(1);
    expect(cajasDeLaHoja(".a { border-radius: 4px; padding: 8px; }")).toBe(0);
    // Una caja repartida en dos reglas también es caja (el punto ciego que dejó pasar `.cmv2-panel` y `SettingBlock`).
    expect(cajasDeLaHoja(".a { border: 1px solid red; border-radius: 4px; }\n.b { color: red; }\n.a { padding: 8px; }")).toBe(1);
    expect(cajasDeLaHoja("@media (max-width: 800px) { .a { padding: 8px; } }\n.a { border: 1px solid red; border-radius: 4px; }")).toBe(1);
  });
});
