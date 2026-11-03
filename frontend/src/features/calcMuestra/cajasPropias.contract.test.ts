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
  "calcMuestra.css": 34,
  "didactica/didactica.css": 9,
  "didactica/didacticaAulas.css": 9,
  "didactica/didacticaSalidas.css": 1,
  "general/general.css": 8,
  "general/mesa.css": 5,
  "motor/motor.css": 2,
  "motor/pestanas/cobertura.css": 1,
  "universidad/aulas/aporteTitulares.css": 1,
  "universidad/aulas/aulas.css": 17,
  "universidad/aulas/certificacionFacultad.css": 3,
  "universidad/aulas/classroomMethodStories.css": 2,
  "universidad/aulas/classroomSelectionMap.css": 3,
  "universidad/aulas/coberturaObjetivo.css": 1,
  "universidad/aulas/descuentoSecuencialNarrativa.css": 1,
  "universidad/aulas/docenteUnico.css": 1,
  "universidad/aulas/efectividadExplicada.css": 3,
  "universidad/aulas/perfilMuestra.css": 1,
  "universidad/aulas/relato/relato.css": 8,
  "universidad/aulas/seleccionPorFacultad.css": 3,
  "universidad/aulas/sustentoDimensionamiento.css": 1,
  "universidad/aulas/variablesBalance.css": 1,
  "universidad/calculo/cadenaFormula.css": 1,
  "universidad/calculo/calculo.css": 15,
  "universidad/calculo/calculoComparacionEscenarios.css": 4,
  "universidad/calculo/calculoDistribucion.css": 6,
  "universidad/calculo/certezaCobertura.css": 2,
  "universidad/calculo/muestraOperativa.css": 3,
  "universidad/calculo/referenciaAsistenciaTau.css": 2,
  "universidad/calculo/tasaFacultad.css": 6,
  "universidad/calculo/titularesEditor.css": 3,
  "universidad/criterios/confirmadorCriterio.css": 1,
  "universidad/criterios/controlUmbral.css": 2,
  "universidad/criterios/criterios.css": 28,
  "universidad/criterios/mordidasEstudiante.css": 1,
  "universidad/definicion/definicion.css": 25,
  "universidad/definicion/exploradorBases.css": 10,
  "universidad/definicion/historicoEstudio.css": 8,
  "universidad/definicion/rankingDesempeno.css": 1,
  "universidad/definicion/referenciaAsistencia.css": 6,
  "universidad/marco/alumnosPorCh.css": 2,
  "universidad/marco/criterioFacultadRadiografia.css": 3,
  "universidad/marco/criteriosI18b.css": 8,
  "universidad/marco/criteriosRadiografia.css": 7,
  "universidad/marco/criteriosRadiografiaRecovery.css": 2,
  "universidad/marco/excluirEnBloque.css": 2,
  "universidad/marco/marco.css": 22,
  "universidad/marco/matrizCascadaCriterios.css": 1,
  "universidad/marco/panoramaCursosHorario.css": 1,
  "universidad/marco/tipoSesionRadiografia.css": 3,
  "universidad/salidas/embudoComparado.css": 1,
  "universidad/salidas/salidas.css": 10,
  "universidad/shared/aviso.css": 2,
  "universidad/shared/graficos/graficos.css": 1,
  "universidad/ui/ui.css": 7,
  "universidad/universidad-base.css": 12,
  "vistaPreviaTipo.css": 3,
};

/**
 * `.cmv2-panel` arma su caja repartida en varias reglas (borde en una, radio en otra), así que el detector de arriba
 * no la ve: los 23 bloques de la tanda anterior pasaron al kit sin que el conteo bajara. Este segundo ratchet cuenta
 * los usos de la clase en los componentes. Foto del 3 nov 2026; sólo baja, y cae a cero cuando el último pase a `Panel`.
 */
const SNAPSHOT_CMV2_PANEL: Record<string, number> = {
  "AterrizajeDelPlanner.tsx": 6,
  "general/MesaAcreditacion.tsx": 1,
  "general/MetodoGeneral.tsx": 1,
  "general/SeleccionActores.tsx": 1,
  "general/SeleccionGeneral.tsx": 1,
  "universidad/calculo/CalculoCursosHorarioFacultadTab.tsx": 1,
  "universidad/definicion/DefBasesTab.tsx": 1,
  "universidad/definicion/DefEstudioTab.tsx": 3,
  "universidad/definicion/DefVariablesTab.tsx": 1,
  "universidad/marco/AlumnosPorChMarcoTab.tsx": 2,
  "universidad/marco/CursosHorarioSexo.tsx": 1,
  "universidad/marco/InventarioUnicosPanel.tsx": 1,
  "universidad/marco/MarcoAulasTab.tsx": 1,
  "universidad/marco/MarcoConsistenciaTab.tsx": 1,
  "universidad/marco/MarcoPoblacionTab.tsx": 1,
  "universidad/marco/MatrizEmbudoCriterios.tsx": 2,
  "universidad/marco/ParticularidadesPanel.tsx": 1,
  "universidad/salidas/SustentoCoberturaCard.tsx": 1,
};

function componentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return componentes(completo);
    return e.name.endsWith(".tsx") && !e.name.includes(".test.") ? [completo] : [];
  });
}

export function usosDeCmv2Panel(tsx: string): number {
  return (tsx.match(/\bcmv2-panel(?![-\w])/g) ?? []).length;
}

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

  it("ningún componente suma usos de .cmv2-panel ni aparece uno nuevo; el snapshot no guarda los que bajaron", () => {
    const usos: Record<string, number> = {};
    for (const f of componentes(aqui)) {
      const n = usosDeCmv2Panel(readFileSync(f, "utf8"));
      if (n > 0) usos[rel(f)] = n;
    }
    const suben = Object.entries(usos).filter(([f, n]) => n > (SNAPSHOT_CMV2_PANEL[f] ?? 0)).map(([f, n]) => `${f}: ${SNAPSHOT_CMV2_PANEL[f] ?? 0} → ${n}`);
    expect(suben, "Un bloque con marco es components/Panel, no .cmv2-panel.").toEqual([]);
    const bajaron = Object.entries(SNAPSHOT_CMV2_PANEL).filter(([f, n]) => (usos[f] ?? 0) < n).map(([f, n]) => `${f}: ${n} → ${usos[f] ?? 0}`);
    expect(bajaron).toEqual([]);
  });

  it("el detector de .cmv2-panel no cuenta sus hijas (-head, -head-actions)", () => {
    expect(usosDeCmv2Panel('<section className="cmv2-panel cmv2-x"><div className="cmv2-panel-head" /></section>')).toBe(1);
  });

  it("el detector reconoce una caja", () => {
    expect(cajasDeLaHoja(".a { border: 1px solid red; border-radius: 4px; padding: 8px; }")).toBe(1);
    expect(cajasDeLaHoja(".a { border-radius: 4px; padding: 8px; }")).toBe(0);
  });
});
