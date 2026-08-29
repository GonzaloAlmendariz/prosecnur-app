import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cssDelPerfilDeAulas } from "./fuenteDelPerfil";

/**
 * Ningún tamaño de letra del perfil baja del suelo que el propio perfil declara.
 *
 * `aulasMonitoreo.css` declara su escala en tres peldaños —`--aulas-txt: 12px`,
 * `--aulas-sec: 11px`, `--aulas-min: 10px` para «ejes, marcas y rotulos
 * micro»— y el 2026-08-29 había SEIS literales por debajo: un 9,5 px en el
 * badge «Estás aquí» y cinco 9 px en el registro y en la familia de
 * reemplazos, todos con vecinos que ya usaban el token.
 *
 * **La escala no se inventa: se lee del archivo.** El registro de pulido de
 * acreditación dejó el aviso de por qué importa —301 y 519 botones en radio 8
 * que parecían deuda y eran el control nativo de la app—, así que aquí se
 * compara contra lo declarado y nada más.
 */
const aqui = path.dirname(fileURLToPath(import.meta.url));
// Todas las hojas del perfil: la madre se está partiendo y un literal fuera de
// escala que se mude no puede dejar de vigilarse por cambiar de fichero.
const css = cssDelPerfilDeAulas();

describe("la escala de radios del perfil de aulas", () => {
  it("ningún radio literal cae entre dos peldaños de la escala", () => {
    // La escala vive en `tokens.css`: 10 · 14 · 16 · 20 · 999. Lo que se
    // prohíbe NO es cualquier literal —un 3 px en una barra de 5 px de alto es
    // correcto y el registro de acreditación avisa de 301 botones en radio 8
    // que eran el control nativo de la app— sino los que caen ENTRE peldaños,
    // que es donde se cuela una esquina a ojo. El 12 del popover de reemplazos
    // era eso: entre el 10 y el 14.
    const entrePeldanos = [...css.matchAll(/border-radius:\s*(\d+(?:\.\d+)?)px/g)]
      .map((m) => Number(m[1]))
      .filter((n) => (n > 10 && n < 14) || (n > 14 && n < 16) || (n > 16 && n < 20));
    expect(entrePeldanos, `radios entre peldaños: ${entrePeldanos.join(", ")}`).toEqual([]);
  });
});

describe("la escala tipográfica del perfil de aulas", () => {
  it("declara su suelo, y sigue siendo 10 px", () => {
    // Si alguien baja el token, este test lo hace explícito en vez de dejar que
    // el suelo se mueva en silencio y arrastre a todo el perfil.
    expect(css).toMatch(/--aulas-min:\s*10px/);
  });

  it("ningún literal baja de ese suelo", () => {
    // Se miran los literales en px; los relativos y los tokens quedan fuera
    // porque su tamaño depende del contexto y no se puede juzgar leyendo.
    const bajos = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)]
      .map((m) => Number(m[1]))
      .filter((n) => n < 10);
    expect(bajos, `literales bajo el suelo: ${bajos.join(", ")}`).toEqual([]);
  });
});
