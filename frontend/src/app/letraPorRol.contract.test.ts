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
 * Foto del 2026-11-01: 105 hojas, 1949 declaraciones. El mismo día pasan
 * Analítica (196 → 0), Procesamiento (36 → 0), Carga (614 → 0) y Formularios
 * (893 → 47: quedan las hojas que dibujan el medio —el papel del Impreso, el
 * simulador y la vista previa de campos— y cuatro excepciones declaradas).
 * Dashboard (208) queda fuera de forma definitiva (decisión de Gonzalo,
 * 2026-11-01): su tema es el del tablero publicado que ve el cliente.
 * Material de campo (recopiladores) entra el 2026-11-02 con meta 0: 440 → 0 en
 * 50 hojas, por la misma regla (P1 de la pasada de formato de Material).
 * Cálculo de muestra entra el mismo día con meta 0: 1165 → 0 en 77 hojas (P1 de
 * `docs/qa/formato-calculo-graficos-2026-11-02.md`). Gráficos entra igual: 1094 → 9
 * en 51 hojas. Las nueve que quedan dibujan el medio, no la interfaz: los planos
 * de gráfico de la biblioteca (`blueprint`: la cifra, la nube de palabras y los
 * cuadrantes a escala de lámina), la muestra de leyenda del Estilo y dos
 * métricas de 6 px dentro de los marcos miniatura del editor de composición.
 * Monitoreo entra también ese día: 3930 → 69 en 20 hojas, misma regla (P1 de
 * `docs/qa/formato-monitoreo-2026-11-02.md`). Quedan declaradas: los rótulos de
 * un SVG con `viewBox` escalado (3–8 «px» que son unidades de usuario), las
 * cifras héroe de 24–44 px que el rol `kpi` (21) achicaría, y
 * `public/monitoreoPublic.css` entero, que es el informe que ve el cliente
 * (mismo criterio que Dashboard).
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULOS = ["features/home", "features/dashboard", "features/xlsformEditor", "features/analitica", "features/carga", "features/procesamiento", "features/recopiladores", "features/calcMuestra", "features/graficos", "features/monitoreo"];
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
  "features/dashboard/theme/tokens.css": 77,
  "features/graficos/estilo/estilo.css": 2,
  "features/graficos/graficadorPicker.css": 5,
  "features/graficos/v2/styles/editor-v2.css": 2,
  "features/home/home-v2.css": 2,
  "features/xlsformEditor/impreso/impreso.css": 16,
  "features/xlsformEditor/kit/riel.css": 1,
  "features/xlsformEditor/pestanas/armador/armador.css": 2,
  "features/xlsformEditor/styles/xf-home/01-xf-home-css-hub-biblioteca-d.css": 1,
  "features/xlsformEditor/styles/xf-preview-inputs.css": 9,
  "features/xlsformEditor/styles/xf-simulator.css": 17,
  "features/monitoreo/monitoreo.css": 3,
  "features/monitoreo/profiles/acreditacion/AvanceCorreo.css": 3,
  "features/monitoreo/profiles/acreditacion/avance/avance.css": 3,
  "features/monitoreo/profiles/acreditacion/control/casos/personas.css": 1,
  "features/monitoreo/profiles/acreditacion/control/contacto/contacto.css": 1,
  "features/monitoreo/profiles/aulas/aulasCargaDeCampo.css": 1,
  "features/monitoreo/profiles/aulas/aulasCroquisDeCampus.css": 3,
  "features/monitoreo/profiles/aulas/aulasRepresentatividad.css": 1,
  "features/monitoreo/profiles/aulas/avance/resumenAulas.css": 1,
  "features/monitoreo/profiles/telefonico/avance/cuotasFaltante.css": 2,
  "features/monitoreo/profiles/telefonico/avance/ritmoTelefonico.css": 1,
  "features/monitoreo/profiles/telefonico/control/controlTelefonico.css": 3,
  "features/monitoreo/profiles/telefonico/control/noBarridos.css": 1,
  "features/monitoreo/profiles/telefonico/insumos/insumosTelefonico.css": 1,
  "features/monitoreo/profiles/telefonico/modelo/modeloTelefonico.css": 1,
  "features/monitoreo/profiles/telefonico/telefonicoProfile.css": 1,
  "features/monitoreo/profiles/territorial/avance/resumen.css": 1,
  "features/monitoreo/profiles/territorial/control/anulaciones.css": 1,
  "features/monitoreo/profiles/territorial/territorialProfile.css": 2,
  "features/monitoreo/public/monitoreoPublic.css": 38,
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
