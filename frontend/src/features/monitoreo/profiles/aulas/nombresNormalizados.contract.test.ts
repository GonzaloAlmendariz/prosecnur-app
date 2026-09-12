// **Ningún nombre de aplicador se pinta crudo.**
//
// Dictado 2026-09-04: «el nombre normalizado: apellido, coma, nombre y nombre.
// Y SIEMPRE tiene que ser así, y en mayúsculas donde sea y en minúsculas donde
// debe corresponder». El libro de disponibilidad llega tecleado a mano y trae
// `Castillo SOLORSANO , LEIDY VIVIANA`, `PANTA GUTIERREZ, PERCY AARÓN` y
// `Uribe Olaechea , Jesús Ramiro`.
//
// El detector existe porque el MISMO descuido apareció TRES veces: se normalizó
// la tabla de Asignación, y después seguían crudos el selector y los rótulos de
// Disponibilidad; y después la ficha del aula, las observaciones de campo y el
// ranking de «Quién consigue más». Un arreglo que hay que acordarse de repetir
// en cada superficie nueva no es un arreglo, es una deuda con intereses.
//
// Mira el FUENTE porque la regla es del fuente: un nombre crudo y uno
// normalizado se ven igual en un render de prueba con «Ana Prueba», y el
// defecto sólo aparece con los nombres reales del operativo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/**
 * Una interpolación de JSX que PINTA algo terminado en `aplicador` /
 * `aplicadores`.
 *
 * Se exige que el nombre pase por `nombreDeAplicador(`. No entran:
 *
 * - los ATRIBUTOS (`key={…}`, `value={…}`, `className={…}`): ahí el nombre es
 *   la IDENTIDAD con la que el motor arma `fijadas`, y normalizarla rompería la
 *   fijación en el primer acento. El detector los excluye pidiendo que la llave
 *   no venga precedida de `=`;
 * - las comparaciones y los setters (`=== x.aplicador`, `setEnFoco(x.aplicador)`),
 *   por lo mismo;
 * - los CONTEOS (`fmt(oferta.aplicadores)`): «31 aplicadores declararon
 *   disponibilidad» es una cifra, no un nombre. Por eso el plural sólo cuenta
 *   cuando se recorre (`.join(`, `.map(`), que es cuando se pintan las personas.
 */
const PINTA_APLICADOR =
  /(^|[^=\w])\{[^{}]*(?:\.aplicador\b|\.aplicadores\s*\.\s*(?:join|map)\s*\()[^{}]*\}/;

/** La línea ya lo normaliza, o la de al lado lo hace (interpolación partida). */
const NORMALIZA = /nombreDeAplicador/;

const fuentes = fs
  .readdirSync(aqui)
  .filter((f) => f.endsWith(".tsx") && !f.includes(".test."));

describe("los nombres de aplicador se pintan normalizados", () => {
  // **Centinela de no-mudez.** `it.each(fuentes)` con la lista vacía no corre ni
  // un caso y la suite pasa en verde: el guard se apagaría sin un solo rojo si
  // el filtro dejara de casar —un renombre, una carpeta que se mueve—.
  it("el barrido encuentra las vistas del perfil, o no está guardando nada", () => {
    expect(fuentes.length).toBeGreaterThan(40);
  });

  it.each(fuentes)("%s", (archivo) => {
    const lineas = fs
      .readFileSync(path.join(aqui, archivo), "utf8")
      // Los comentarios citan nombres crudos a propósito —son la evidencia del
      // defecto— y ahí es exactamente donde deben ir crudos.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"));

    const crudas = lineas.filter((linea, i) => {
      // Un cuerpo de flecha con llaves —`onMouseEnter={() => { … }}`— trae un
      // `{` que no abre texto de JSX sino un bloque; ahí el nombre es la
      // identidad que se le pasa a un setter, no algo que se pinte.
      if (/=>/.test(linea) || /\bon[A-Z]\w*=\{/.test(linea)) return false;
      if (!PINTA_APLICADOR.test(linea)) return false;
      // La interpolación puede abrirse una línea antes o cerrarse una después.
      const vecindario = [lineas[i - 1] ?? "", linea, lineas[i + 1] ?? ""].join(" ");
      return !NORMALIZA.test(vecindario);
    });

    expect(crudas, crudas.join("\n")).toEqual([]);
  });

  it("el detector reconoce un nombre crudo cuando lo hay", () => {
    // Sin este control, un regex roto daría verde en todos los archivos y el
    // guard sería decorativo. Es el mismo cinturón que lleva
    // `cifrasConFormato.test.ts`.
    expect(PINTA_APLICADOR.test("          <span>{ficha.parte.aplicador}</span>")).toBe(true);
    expect(PINTA_APLICADOR.test("  <> · {o.aplicadores.join(\", \")}</>")).toBe(true);
  });

  it("y NO confunde la identidad con lo que se pinta", () => {
    // El `value` de un select y la `key` de una lista llevan el nombre CRUDO a
    // propósito: son la clave con la que el motor reconoce a la persona.
    expect(PINTA_APLICADOR.test('        <option key={e.aplicador} value={e.aplicador}>')).toBe(false);
    expect(PINTA_APLICADOR.test('  onMouseEnter={() => setEnFoco(e.aplicador)}')).toBe(false);
  });
});
