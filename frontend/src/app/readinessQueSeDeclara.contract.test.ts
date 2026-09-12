import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **Borrar la marca mientras se carga es indistinguible de no tenerla.**
 *
 * `estadoListo()` (lib/navegacion/runtime.ts) decide en este orden: si no
 * encuentra `[data-audit-ready]` responde `sin-marca-de-readiness`; si lo
 * encuentra en `"false"` responde `marca-en-false`. Los dos motivos significan
 * cosas opuestas para quien mide: el primero dice «esta vista no participa del
 * contrato» y corta; el segundo dice «hay contrato y aún no se cumple» y espera.
 *
 * React no renderiza un atributo cuyo valor es `undefined`. Así que
 * `data-audit-ready={cargando ? undefined : "x"}` publica el primer motivo
 * durante toda la carga, y el QA visual da por no medible una vista que sólo
 * estaba tardando. Territorial lo hacía, y por eso **ninguna** de sus 15 vistas
 * podía medirse — el perfil entero quedaba fuera del gate visual sin que nada
 * lo dijera.
 *
 * El contrato hermano `auditReadyRoutes` nombra páginas UNA A UNA, así que una
 * página que nadie añadió nunca se entera. Éste barre, que es lo que hacía
 * falta para cazarlo.
 */

const appDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(appDir, "..");

/** `data-audit-ready={...}` con `undefined` en alguna rama del ternario. */
const BORRA_LA_MARCA = /data-audit-ready=\{[^}]*\bundefined\b[^}]*\}/g;

/**
 * Los dos sitios donde borrar la marca SÍ es lo correcto, verificados uno a uno:
 * en ninguno la condición es un estado de carga. Delegar la marca es legítimo;
 * borrarla mientras se carga, no. Añadir algo aquí exige comprobar esa
 * diferencia, no silenciar un rojo.
 */
const DELEGAN_LA_MARCA: Record<string, string> = {
  "components/PageFrame.tsx":
    "contenedor genérico: sin `auditReady` la marca la publica el panel interior, " +
    "que es justo lo que exige el contrato de Analítica en auditReadyRoutes",
  "features/procesamiento/ProcessingSheetViewer.tsx":
    "`isRoster = !!repeat` no es carga: dice si esta hoja es un roster",
};

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

describe("la marca de readiness se declara, no se borra", () => {
  const fuentes = archivos(srcDir).map((f) => ({
    relativo: path.relative(srcDir, f),
    fuente: readFileSync(f, "utf8"),
  }));

  test("el barrido ve las marcas que existen: si deja de verlas, lo dice", () => {
    // Sin esto, un `[]` por un regex roto se leería como «no hay ninguna».
    const conMarca = fuentes.filter((f) => f.fuente.includes("data-audit-ready")).length;
    expect(conMarca).toBeGreaterThan(10);
  });

  test("ninguna vista borra su marca mientras carga", () => {
    const culpables = fuentes
      .filter(({ relativo }) => !(relativo in DELEGAN_LA_MARCA))
      .flatMap(({ relativo, fuente }) =>
        [...fuente.matchAll(BORRA_LA_MARCA)].map((m) => `${relativo}: ${m[0]}`))
      .sort();

    expect(
      culpables,
      "`undefined` borra el atributo, y una marca ausente le dice al puente que esta vista " +
        "no participa del contrato: el QA visual la da por no medible en vez de esperarla. " +
        'Usa "false" mientras carga, que es lo que significa «todavía no».',
    ).toEqual([]);
  });

  test("la lista de los que delegan no se infla con los que ya no borran nada", () => {
    const sobran = Object.keys(DELEGAN_LA_MARCA).filter((relativo) => {
      const f = fuentes.find((x) => x.relativo === relativo);
      return !f || !BORRA_LA_MARCA.test(f.fuente);
    });
    BORRA_LA_MARCA.lastIndex = 0;
    expect(sobran, "Ya no borran la marca: quítalos de DELEGAN_LA_MARCA.").toEqual([]);
  });

  test("el puente sigue distinguiendo los dos motivos", () => {
    // Si alguien unifica las dos ramas de estadoListo(), este guard deja de
    // proteger nada y hay que enterarse por aquí, no por una matriz visual muda.
    const runtime = readFileSync(path.join(srcDir, "lib/navegacion/runtime.ts"), "utf8");
    expect(runtime).toContain("sin-marca-de-readiness");
    expect(runtime).toContain("marca-en-false");
  });
});
