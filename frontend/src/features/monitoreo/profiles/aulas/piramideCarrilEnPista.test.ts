import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fuente = fs.readFileSync(path.join(aqui, "AulasPiramideCuota.tsx"), "utf8");
const hoja = fs.readFileSync(path.join(aqui, "aulasMonitoreo.css"), "utf8");

/**
 * **El carril mide su porcentaje contra la pista, no contra el lado entero.**
 *
 * El carril lleva `width: ${carril}%` y el carril de la meta más alta vale 100.
 * Siendo hijo directo del lado —un flex que también contiene la cifra— ese
 * 100 % se resolvía contra el contenedor ENTERO, así que la fila de la meta
 * mayor se salía por debajo de su vecina: 11 px medidos a 1440x1000 sobre el
 * proyecto derivado con `api/scripts/derivar_monitoreo_aulas.R`, reportados por
 * `ui-quick-check` como `contenido-fuera-de-caja`.
 *
 * Esto no lo caza ningún test de datos: el cálculo del ancho era correcto. Se
 * fija la ESTRUCTURA porque es lo que estaba mal, y porque quitar la pista
 * «simplificando el markup» devuelve el desborde sin que nada se ponga rojo.
 */
describe("la pirámide de cuota mide contra su pista", () => {
  it("el carril va dentro de una pista, nunca suelto en el lado", () => {
    const pista = fuente.indexOf('className="aulas-piramide-pista"');
    const carril = fuente.indexOf('className="aulas-piramide-carril"');
    expect(pista, "falta la pista: el carril volvería a medir contra el lado entero").toBeGreaterThan(-1);
    expect(carril).toBeGreaterThan(pista);
  });

  it("la pista se queda con lo que sobra y puede encoger", () => {
    const regla = hoja.slice(hoja.indexOf(".aulas-piramide-pista {"));
    const cuerpo = regla.slice(0, regla.indexOf("}"));
    expect(cuerpo).toContain("flex: 1");
    // Sin `min-width: 0` un hijo flex no baja de su contenido y la pista
    // empujaría la fila en vez de ceder.
    expect(cuerpo).toContain("min-width: 0");
  });

  it("la cifra reserva el mismo ancho en todas las filas", () => {
    // Si no, la pista mide distinto por fila y el 100 % del carril deja de ser
    // comparable entre facultades, que es para lo que existe la pirámide.
    const regla = hoja.slice(hoja.indexOf(".aulas-piramide-cifra {"));
    expect(regla.slice(0, regla.indexOf("}"))).toMatch(/min-width:\s*[\d.]+rem/);
  });
});
