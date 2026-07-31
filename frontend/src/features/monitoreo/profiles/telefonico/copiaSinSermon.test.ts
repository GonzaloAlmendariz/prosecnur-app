import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Copy que ocupa el sitio del dato.
//
// La superficie de Monitoreo se llenó de frases que son verdaderas, no cambian
// nunca y no dicen nada del estudio que se está mirando: «Los estados del
// barrido son consulta operativa; la efectiva la decide Kobo», «La llamada
// explica operación; Kobo valida avance», «Qué respuesta cuenta como efectiva»
// sobre un bloque titulado «Filtro de efectiva».
//
// Las tres formas que toma, y por qué las tres sobran:
//
//   1. Parafrasear el título. Se lee dos veces lo mismo con distintas palabras.
//   2. Escribir la afordancia. «Selecciona la pregunta de consentimiento» encima
//      de un selector rotulado «Pregunta».
//   3. Enunciar doctrina. Cierto en todos los estudios, y por eso mismo inútil
//      en este: el hueco donde estaba es donde va la cifra de ESTE corte.
//
// Este test vigila los literales concretos que se retiraron. No pretende
// detectar la categoría entera —para eso hace falta leer la pantalla—, sino que
// estos no vuelvan por copiar y pegar de un perfil al otro, que es como
// llegaron a estar en los dos.

const PERFILES = [
  ["telefonico", resolve(__dirname, "TelefonicoMonitoreoPage.tsx")],
  ["acreditacion", resolve(__dirname, "..", "acreditacion", "AcreditacionMonitoreoPage.tsx")],
] as const;

const RETIRADAS = [
  "Los estados del barrido son consulta operativa",
  "La llamada explica operación; Kobo valida avance",
  "Kobo cuenta avance; barrido explica operación",
  "A quién llamar y qué pasó en cada llamada",
  "Qué respuesta cuenta como efectiva",
  "La respuesta cuenta cuando",
  "De dónde salen los números del monitoreo",
  "El consentimiento decide cuáles cuentan en el avance",
];

/**
 * El código sin sus comentarios.
 *
 * Los comentarios que explican por qué se retiró una frase la citan textual, y
 * esa cita no es copy: nadie la lee en la pantalla. Sin este filtro el test se
 * ponía rojo por su propia documentación y el arreglo habría sido dejar de
 * explicar el porqué, que es justo lo que no queremos.
 */
function soloCodigo(fuente: string) {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("la copia no ocupa el sitio del dato", () => {
  it.each(PERFILES)("%s no reintroduce las frases retiradas", (_perfil, ruta) => {
    const fuente = soloCodigo(readFileSync(ruta, "utf8"));
    // Se comprueba una a una para que el fallo nombre la frase que volvió, y no
    // solo diga que alguna lo hizo.
    for (const frase of RETIRADAS) {
      expect(fuente, `volvió: «${frase}»`).not.toContain(frase);
    }
  });

  it("el catálogo de pestañas no traduce el título en el detalle", () => {
    const catalogo = readFileSync(resolve(__dirname, "pestanasDeFuentes.ts"), "utf8");
    expect(catalogo).not.toContain('detail: "A quién llamar y qué pasó"');
  });
});
