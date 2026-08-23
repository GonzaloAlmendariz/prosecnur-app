// **Ninguna cifra del perfil se escribe cruda.**
//
// Medido en Avance el 2026-08-23, con el sorteo del 22: la misma pantalla decía
// «de 2,616 cursos-horario» y, cuatro renglones más abajo, «de 2109
// cursos-horario en juego». Dos formatos para el mismo tipo de número, en la
// misma vista, y el segundo cuesta leerlo: hay que contar los dígitos para
// saber si son dos mil o veintiún mil.
//
// No era un descuido de un archivo: siete de este perfil interpolaban números
// directamente en la frase mientras `fmt()` —con `Intl.NumberFormat("es-PE")`—
// vivía a dos carpetas de distancia y lo usaban los KPI de al lado.
//
// El test mira el fuente porque la regla ES del fuente: una cifra formateada y
// otra sin formatear se ven idénticas en un render de tres dígitos, y el
// defecto sólo aparece a partir de mil — con datos de un estudio real, cuando
// ya está en pantalla.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** Sustantivos que sólo acompañan a una cuenta, nunca a un identificador. */
const UNIDADES = "cursos-horario|aulas|respuestas|reservas|filas|celdas|titulares|facultades";

/**
 * `${algo} aulas` — una cifra metida en la frase sin pasar por el formateador.
 *
 * Se exige `fmt(` o `toLocaleString` dentro de la interpolación. Una operación
 * —`${total - enJuego}`— también cuenta como cruda: el resultado es igual de
 * grande que sus operandos.
 */
// Se excluyen las interpolaciones que llevan comillas dentro: `${n === 1 ?
// "reserva" : "reservas"}` produce TEXTO, no una cifra, y formatearlo no
// significaría nada.
const SIN_FORMATO = String.raw`\$\{(?!fmt\(|[^}]*toLocaleString)[^}"']*\}`;

/**
 * Las formas en que una cifra llega a la frase, medidas en el perfil:
 *
 *   `${n} aulas`                      — pegada a su unidad
 *   `${n} de ${total} aulas`          — como numerador; el primero no toca la
 *                                       unidad y se escapaba del detector
 *   `${n} son reservas del banco`     — con un verbo de por medio
 *
 * No pretende ser exhaustivo: cubre lo que se ha visto y crece cuando aparezca
 * otra forma. Un detector que intente adivinar toda frase posible acaba
 * marcando texto que no es cifra, y entonces se ignora.
 */
const CIFRA_CRUDA = new RegExp(
  // `(?![-\w])` y no `\b`: sin él, `${className} aulas-foco-boton` —una clase
  // CSS— se lee como «una cifra seguida de la palabra aulas», porque el guión
  // cierra la palabra igual que un espacio.
  `${SIN_FORMATO}\\s*(?:(?:${UNIDADES})(?![-\\w])|(?:de|son|sobre|entre)\\s)`,
  "g",
);

const fuentes = fs
  .readdirSync(aqui)
  .filter((f) => (f.endsWith(".tsx") || f.endsWith(".ts")) && !f.includes(".test."));

describe("las cifras del perfil de aulas van formateadas", () => {
  it.each(fuentes)("%s", (archivo) => {
    const fuente = fs
      .readFileSync(path.join(aqui, archivo), "utf8")
      // Los comentarios citan cifras a propósito —«decía 2109»— y ahí es
      // exactamente donde deben ir crudas: son la evidencia del defecto.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const crudas = [...fuente.matchAll(CIFRA_CRUDA)].map((m) => m[0]);
    expect(crudas, crudas.join("\n")).toEqual([]);
  });

  it("el detector reconoce una cifra cruda cuando la hay", () => {
    // Sin este control, un regex roto daría verde en los treinta y pico
    // archivos sin haber mirado ninguno.
    const cruda = "`${enJuego} cursos-horario en juego`";
    expect([...cruda.matchAll(CIFRA_CRUDA)]).toHaveLength(1);
  });

  it("y acepta la que sí pasó por el formateador", () => {
    expect([..."`${fmt(enJuego)} cursos-horario`".matchAll(CIFRA_CRUDA)]).toHaveLength(0);
    expect([..."`${n.toLocaleString(\"es-PE\")} aulas`".matchAll(CIFRA_CRUDA)]).toHaveLength(0);
  });

  it("no confunde una clase CSS con una cifra", () => {
    expect([...'`${className} aulas-foco-boton`'.matchAll(CIFRA_CRUDA)]).toHaveLength(0);
  });

  it("caza el numerador de «N de M aulas», que no toca la unidad", () => {
    // Medido en pantalla: «2109 de 2,109 cursos-horario» — el segundo pasó por
    // el formateador y el primero no, en la MISMA frase.
    const linea = "`${sinSalirACampo} de ${fmt(enJuego)} cursos-horario`";
    expect([...linea.matchAll(CIFRA_CRUDA)]).toHaveLength(1);
  });

  it("caza la cifra con un verbo de por medio", () => {
    // «1916 son reservas del banco».
    expect([..."`${banco} son reservas del banco`".matchAll(CIFRA_CRUDA)]).toHaveLength(1);
  });

  it("no marca una interpolación que produce texto", () => {
    // `${n === 1 ? "reserva" : "reservas"}` es la palabra, no el número: va
    // seguida de «de» y aun así no es una cifra que formatear.
    const plural = '`${n === 1 ? "reserva" : "reservas"} de banco`';
    expect([...plural.matchAll(CIFRA_CRUDA)]).toHaveLength(0);
    // Y la cifra de al lado sí se caza cuando toca su unidad.
    expect([..."`${n} reservas`".matchAll(CIFRA_CRUDA)]).toHaveLength(1);
  });

  it("una operación dentro de la interpolación también es cruda", () => {
    // `${total - enJuego} reservas` da un número tan grande como sus operandos.
    expect([..."`${total - enJuego} reservas`".matchAll(CIFRA_CRUDA)]).toHaveLength(1);
  });
});
