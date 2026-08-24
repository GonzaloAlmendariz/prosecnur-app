// **Toda lista de unidades del operativo se pinta en orden de cadena.**
//
// El titular y detrás sus reservas por turno. No es una preferencia: es cómo se
// busca un aula. «R 1.2» está donde está su titular, no en el lugar donde el
// motor la devolvió.
//
// Ha hecho falta arreglarlo TRES veces en listas distintas, siempre igual —el
// componente pinta el array como llega— y siempre encontrado mirando la
// pantalla, no el código:
//
//   Plan de Recopiladores        · el orden llegaba del payload
//   Consultas > Reemplazos       · 146 saltos hacia atrás en 400 filas
//   Validación > Registro campo  · 310 saltos hacia atrás en 700 elementos
//
// La regla vive en `lib/cadenaOperativa`. Este test no la comprueba —para eso
// están sus propias pruebas— sino que las listas del perfil la USEN: el defecto
// nunca estuvo en la regla, sino en no llamarla.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/**
 * Las listas del perfil que pintan unidades del operativo, con la variable que
 * cada una recorre.
 *
 * Es una lista explícita y no un barrido: un componente puede recorrer filas
 * que NO son unidades —controles, facultades, días— y exigirle orden de cadena
 * sería exigirle algo que no tiene. Cuando aparezca una lista nueva de
 * unidades, se añade aquí; es más barato que discutir con un detector.
 */
const LISTAS = [
  { archivo: "RegistroDeCampo.tsx", que: "el buscador con el que se registra un parte" },
  { archivo: "AulasMonitoreoPage.tsx", que: "la agenda y la cadena de reemplazos" },
];

describe("las listas de unidades usan la regla de orden de cadena", () => {
  it.each(LISTAS)("$archivo — $que", ({ archivo }) => {
    const fuente = fs.readFileSync(path.join(aqui, archivo), "utf8");
    expect(fuente).toContain("ordenarPorCadenaOperativa");
  });

  it("y nadie redefine el formateador de cifras dentro del perfil", () => {
    // Medido el 2026-08-23: **treinta archivos** llevaban la MISMA línea
    // —`const fmt = (n) => n.toLocaleString("es-PE")`— mientras el compartido
    // vivía en `kpisDeAulas.ts`. Y tres más definían un `fmt` que hacía otra
    // cosa: uno con un decimal, otro devolviendo «—» para el dato ausente.
    //
    // Lo caro no era la duplicación, era el NOMBRE: `fmt(x)` significaba tres
    // cosas distintas según el archivo, y había que abrirlo para saber cuál.
    const propios = fs
      .readdirSync(aqui)
      .filter((f) => (f.endsWith(".tsx") || f.endsWith(".ts")) && !f.includes(".test."))
      .filter((f) => f !== "kpisDeAulas.ts")
      .filter((f) => /^(?:const|function)\s+fmt\b/m.test(fs.readFileSync(path.join(aqui, f), "utf8")));
    expect(propios, `redefinen «fmt»: ${propios.join(", ")}`).toEqual([]);
  });

  it("y la regla sigue viviendo en un solo sitio", () => {
    // Si alguien copiara el comparador dentro del perfil, las listas
    // empezarían a discrepar en silencio: dos ordenaciones parecidas son peor
    // que una mal, porque nadie sabe cuál manda.
    const propias = fs
      .readdirSync(aqui)
      .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
      .filter((f) => !f.includes(".test."))
      .filter((f) => /function\s+ordenarPorCadena|const\s+ordenarPorCadena/
        .test(fs.readFileSync(path.join(aqui, f), "utf8")));
    expect(propias, `redefinen el orden: ${propias.join(", ")}`).toEqual([]);
  });
});

/**
 * **Dos cuentas del mismo objetivo, cada una diciendo de dónde sale.**
 *
 * Medido en pantalla el 2026-08-23 sobre el estudio de 193: la tarjeta «Cuota
 * por recoger» decía **3.491** y tres centímetros más abajo la barra
 * «Cumplimiento en respuestas» decía **0 de 3.492**. Son dos cuentas distintas
 * del mismo objetivo —una suma objetivos de 30 celdas sexo × facultad, la otra
 * metas por curso-horario— y el total real es 3.491,4: a 0,4 de distancia, el
 * redondeo las separa en uno.
 *
 * No es un error de cálculo y por eso mismo es peligroso: quien lee encuentra
 * la diferencia, no puede explicarla y desconfía de las dos cifras. La tarjeta
 * de cuota ya resolvía lo suyo explicando que lo que falta se suma celda a
 * celda; a la barra le faltaba nombrar su unidad.
 */
describe("las dos cifras del objetivo declaran su procedencia", () => {
  const fuente = (archivo: string) =>
    fs.readFileSync(path.join(aqui, archivo), "utf8");

  it("la barra de cumplimiento dice que suma metas por curso-horario", () => {
    expect(fuente("AulasMonitoreoPage.tsx")).toContain("suma de metas por curso-horario");
  });

  it("y la tarjeta de cuota dice que sus celdas son sexo × facultad", () => {
    expect(fuente("kpisDeAulas.ts")).toContain("celdas sexo × facultad");
  });
});
