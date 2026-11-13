import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P5 de la pasada de formato de Monitoreo: el vacío y la carga son los del kit.**
 *
 * La medición del 2 nov 2026 encontró unas 70 recetas propias de vacío o carga
 * (`mon-sm-empty` 25 veces, `mon-profile-empty` en dos copias de `EmptyPanel`,
 * `mon-territorial-audit-empty`, `mon-correo-vacio`, `aulas-tav-vacio`…), cada
 * una con su letra, su borde y su alto, frente a 22 usos de `EstadoVacio`.
 * Es la misma causa que en Material (`recopiladores/vaciosYCargasDelKit`): el
 * vacío va por `EstadoVacio` y la carga por `LoadingBlock` (o `CargaDeBloque`
 * cuando es un bloque dentro de una vista ya lista).
 *
 * Qué se cuenta: un nombre de clase cuyo segmento es `-empty`, `-vacio`,
 * `-loading` o `-cargando` con UN guion. El modificador BEM (`mon-mod--vacio`)
 * y los de estado (`is-empty`, `data-vacia`) dicen que un bloque está vacío, no
 * pintan el vacío: no cuentan.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function archivos(dir: string, ext: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo, ext);
    return ext.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");

/** Líneas de código, sin los comentarios de línea ni de bloque. */
function lineasDeCodigo(fuente: string): string[] {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, ""));
}

const RECETA = /\b(?:mon|acr|aulas|ter|tel)(?:-[a-z0-9]+)*-(?:empty|vacio|loading|cargando)(?:(?:-|__)[a-z0-9]+)*\b/g;

/**
 * Las que se quedan, con su motivo:
 * (La pantalla de preparación del perfil, `mon-territorial-loading` y
 * `mon-acr-loading-card`, estuvo declarada hasta el 2026-11-12: sus "pasos"
 * eran texto fijo y hoy la carga de una sección es `LoadingBlock` del kit.)
 * - las fichas de capa sobre el mapa (`mon-territorial-route-map-loading`)
 *   dicen qué capa falta mientras el mapa ya se ve: son el rótulo ocupado de
 *   una capa, como el de un botón.
 */
const DECLARADAS = /^(?:mon-territorial-route-map-loading)(?=$|[-_])/;

// Una espera con objeto («Leyendo la lista…») escrita como texto. Dentro de
// `label=` es el rótulo de LoadingBlock y está bien; tras `? "` es el rótulo
// ocupado de un botón, y tras `? <span>` la línea de estado de una capa en la
// leyenda de un mapa que ya se ve (la cartografía de Recorrido); con `vacio="cargando"` la pinta `VacioDeBloque` de
// acreditación, que ya va por `EstadoVacio`.
const ESPERA_A_MANO = /(Leyendo|Cargando|Comparando|Calculando|Preparando) [^"'`<>{}]*…/;
const ESPERA_PERMITIDA = /\blabel=|\?\s*(?:"|<span>)(Leyendo|Cargando|Comparando|Calculando|Preparando) [^"<]*…|vacio="cargando"/;

function recetasPropias(): string[] {
  return archivos(aqui, /\.(tsx|ts|css)$/).flatMap((f) =>
    lineasDeCodigo(readFileSync(f, "utf8")).flatMap((l, i) =>
      [...l.matchAll(RECETA)].map((m) => m[0]).filter((c) => !DECLARADAS.test(c)).map((c) => `${rel(f)}:${i + 1} ${c}`),
    ),
  );
}

describe("vacíos y cargas de Monitoreo", () => {
  it("el barrido ve el feature (centinela)", () => {
    expect(archivos(aqui, /\.(tsx|ts|css)$/).length).toBeGreaterThan(700);
  });

  it("ninguna hoja ni componente pinta su propio vacío o carga", () => {
    expect(recetasPropias()).toEqual([]);
  });

  it("una espera de superficie va por LoadingBlock, no como texto suelto", () => {
    const hallazgos = archivos(aqui, /\.tsx$/).flatMap((f) =>
      lineasDeCodigo(readFileSync(f, "utf8"))
        .map((l, i) => (ESPERA_A_MANO.test(l) && !ESPERA_PERMITIDA.test(l) ? `${rel(f)}:${i + 1}: ${l.trim()}` : null))
        .filter((x): x is string => x !== null),
    );
    expect(hallazgos).toEqual([]);
  });

  it("el detector reconoce lo que prohíbe (no es un guard que no guarda)", () => {
    const casa = (s: string) => [...s.matchAll(RECETA)].map((m) => m[0]);
    expect(casa('<div className="mon-sm-empty">')).toEqual(["mon-sm-empty"]);
    expect(casa('<p className="aulas-tav-vacio">')).toEqual(["aulas-tav-vacio"]);
    expect(casa('<div className="mon-territorial-loading-steps">')).toEqual(["mon-territorial-loading-steps"]);
    expect(casa('<div className="mon-mod mon-mod--vacio is-empty">')).toEqual([]);
    expect(DECLARADAS.test("mon-territorial-loading-steps")).toBe(false);
    expect(DECLARADAS.test("mon-territorial-route-map-loading")).toBe(true);
    expect(casa('<div className="mon-acr-loading-card__copy">').filter((c) => !DECLARADAS.test(c))).toEqual(["mon-acr-loading-card__copy"]);
    expect(ESPERA_PERMITIDA.test('{pdf ? "Preparando el reporte…" : copy.button}')).toBe(true);
    expect(ESPERA_A_MANO.test("<p>Leyendo el estado de Mailchimp…</p>")).toBe(true);
    expect(ESPERA_A_MANO.test('{ocupado ? "Leyendo…" : "Leer"}')).toBe(false);
  });
});
