import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P5 de la pasada de formato — el vacío y la carga de Material son los del kit.**
 *
 * Convivían tres recetas: `EstadoVacio` del kit, `.rec-contained-empty` (flex en
 * fila: partía «30 aulas» en una columna propia y heredaba letra de 17 px) y
 * `.rec-loading`, más una docena de «Leyendo…» sueltos en `<p>` y `<small>` con
 * una clase distinta cada uno. Gonzalo: «es un tema sistemático que debe
 * solucionarse». Ahora todo vacío va por `EstadoVacio` y toda carga por
 * `LoadingBlock` (`components/States.tsx`).
 *
 * Meta 0, no ratchet: las clases viejas ya no existen y una espera escrita a mano
 * («Leyendo la lista…» como texto de un párrafo) no vuelve. La espera de un
 * botón («Leyendo…» a secas) es su rótulo ocupado, no una carga de superficie.
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

const CLASES_VIEJAS = /\b(rec-contained-empty|rec-loading|rec-receipt-empty)\b/;
// Una espera con objeto («Leyendo la lista…», «Cargando el perfil…») escrita como
// texto. Dentro de `label=` es el rótulo de LoadingBlock y está bien.
const ESPERA_A_MANO = /(Leyendo|Cargando|Comparando) [^"'`<>{}]*…/;

describe("vacíos y cargas de Material", () => {
  it("ninguna hoja ni componente usa las clases propias de vacío o carga", () => {
    const fuentes = archivos(aqui, /\.(tsx|ts|css)$/);
    // Centinela: el barrido mira de verdad el feature (306 fuentes al 2 nov 2026).
    expect(fuentes.length).toBeGreaterThan(250);
    const hallazgos = fuentes.flatMap((f) =>
      lineasDeCodigo(readFileSync(f, "utf8"))
        .map((l, i) => (CLASES_VIEJAS.test(l) ? `${rel(f)}:${i + 1}` : null))
        .filter((x): x is string => x !== null),
    );
    expect(hallazgos).toEqual([]);
  });

  it("una espera de superficie va por LoadingBlock, no como texto suelto", () => {
    const componentes = archivos(aqui, /\.tsx$/);
    // Centinela: el barrido ve las cargas migradas (8 de sección y 12 de bloque al 2 nov 2026).
    const usos = componentes.reduce((n, f) => n + (readFileSync(f, "utf8").match(/<(LoadingBlock|CargaDeBloque)\b/g)?.length ?? 0), 0);
    expect(usos).toBeGreaterThan(15);
    const hallazgos = componentes.flatMap((f) =>
      lineasDeCodigo(readFileSync(f, "utf8"))
        .map((l, i) => (ESPERA_A_MANO.test(l) && !/\blabel=/.test(l) ? `${rel(f)}:${i + 1}: ${l.trim()}` : null))
        .filter((x): x is string => x !== null),
    );
    expect(hallazgos).toEqual([]);
  });

  // P5b: una carga dentro de una vista ya lista publica su propio «todavía no»
  // (data-audit-ready="false"), o la captura mide la pantalla a medio cargar.
  // Por eso la carga en línea pasa siempre por CargaDeBloque, que lleva la marca.
  it("toda carga de bloque lleva su marca de readiness (CargaDeBloque)", () => {
    const componentes = archivos(aqui, /\.tsx$/).filter((f) => !f.endsWith("CargaDeBloque.tsx"));
    expect(componentes.length).toBeGreaterThan(100);
    const hallazgos = componentes.flatMap((f) =>
      lineasDeCodigo(readFileSync(f, "utf8"))
        .map((l, i) => (/<LoadingBlock\b[^>]*variant="inline"/.test(l) ? `${rel(f)}:${i + 1}` : null))
        .filter((x): x is string => x !== null),
    );
    expect(hallazgos).toEqual([]);
    const propia = readFileSync(path.join(aqui, "CargaDeBloque.tsx"), "utf8");
    expect(propia).toContain('data-audit-ready="false"');
  });

  it("el detector reconoce lo que prohíbe (no es un guard que no guarda)", () => {
    expect(ESPERA_A_MANO.test("<p>Leyendo la lista…</p>")).toBe(true);
    expect(ESPERA_A_MANO.test('<small>Cargando el perfil…</small>')).toBe(true);
    expect(ESPERA_A_MANO.test('{ocupado ? "Leyendo…" : "Leer"}')).toBe(false);
    expect(CLASES_VIEJAS.test('<div className="rec-loading">')).toBe(true);
  });
});
