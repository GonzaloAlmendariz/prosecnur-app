import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
const css = fs.readFileSync(path.join(aqui, "aulasMonitoreo.css"), "utf8");

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
