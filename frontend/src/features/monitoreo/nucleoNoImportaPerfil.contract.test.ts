// La dirección de los chunks de Monitoreo es siempre perfil → núcleo
// (vite.config.ts, `manualChunks`). Si un archivo del núcleo importa un valor
// de `profiles/<perfil>/`, ese archivo viaja en el chunk del perfil, el núcleo
// lo importa de vuelta y el bundle cierra un ciclo: el arranque muere con un
// TDZ que en dev no se ve. Pasó el 2026-10-28 con core/*Comunes (L33), que
// importaban telefonico/formato y avance/ritmoDiario. Un import de valor desde
// el núcleo hacia un perfil sólo vale si vite.config.ts lo asigna a
// monitoreo-core por nombre.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname);
const NUCLEO = ["core", "components", "salidas", "shell"];
const VITE_CONFIG = readFileSync(resolve(__dirname, "../../../vite.config.ts"), "utf8");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

/** Imports de valor (no `import type`) cuyo destino cae bajo `profiles/<perfil>/`. */
function importsDePerfil(ruta: string): string[] {
  const texto = readFileSync(ruta, "utf8");
  const destinos: string[] = [];
  for (const m of texto.matchAll(/^(?:import|export)\s+(type\s+)?[^;]*?from\s+"(\.[^"]+)";/gms)) {
    if (m[1]) continue;
    const destino = relative(RAIZ, resolve(dirname(ruta), m[2]));
    if (/^profiles\/[^/]+\//.test(destino)) destinos.push(destino);
  }
  return destinos;
}

describe("Monitoreo: el núcleo no arrastra un chunk de perfil", () => {
  it("todo import de valor del núcleo hacia un perfil está asignado a monitoreo-core en vite.config.ts", () => {
    const hojas = NUCLEO.flatMap((dir) => archivos(join(RAIZ, dir)));
    // Centinela: si el recorrido deja de encontrar archivos, el guard no guarda.
    expect(hojas.length).toBeGreaterThan(40);
    const sinAsignar = hojas.flatMap((ruta) =>
      importsDePerfil(ruta)
        .filter((destino) => !VITE_CONFIG.includes(`/src/features/monitoreo/${destino}.ts`))
        .map((destino) => `${relative(RAIZ, ruta)} → ${destino}`),
    );
    expect(sinAsignar).toEqual([]);
  });

  it("el guard ve los imports que motivaron la regla", () => {
    const comunes = importsDePerfil(join(RAIZ, "core/rotulosComunes.ts"));
    expect(comunes).toContain("profiles/telefonico/formato");
    expect(comunes).toContain("profiles/telefonico/avance/ritmoDiario");
  });
});
