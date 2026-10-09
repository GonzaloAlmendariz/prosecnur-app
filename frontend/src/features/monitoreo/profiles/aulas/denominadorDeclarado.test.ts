import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Los porcentajes del perfil dicen sobre qué se calculan.
 *
 * C4 del GOAL, y es la otra mitad del defecto más repetido del repo: no el
 * numerador equivocado —eso lo cerró el frente F— sino **el denominador
 * ausente**.
 *
 * El caso medido el 2026-08-29: el perfil de respuestas abiertas escribe «N
 * contestaron esta pregunta y M dijeron algo distinto» y justo debajo tres
 * porcentajes desnudos —«rellenó sin decir nada», «repite otra respuesta»,
 * «una sola palabra»—. **Con dos denominadores en pantalla y ninguno
 * declarado**, quien lee no puede saber cuál. En el motor los cuatro salen de
 * `tasa(x) = 100 * sum(x) / n` con `n = contestadas`
 * (`monitoreo_texto_abierto.R`), o sea el primero.
 */
const aqui = path.dirname(fileURLToPath(import.meta.url));
const fuente = fs.readFileSync(path.join(aqui, "AulasTextoAbierto.tsx"), "utf8");
const cuerpo = fuente.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("los porcentajes de respuestas abiertas declaran su base", () => {
  it("el perfil dice sobre qué se calculan sus tres porcentajes", () => {
    expect(cuerpo).toContain("De las que contestaron");
  });

  it("y sigue enseñando las dos cifras que dan contexto", () => {
    // La declaración no sustituye a los conteos: son los que dejan ver que
    // «contestaron» y «dijeron algo distinto» son dos cosas.
    expect(cuerpo).toContain("contestaron esta pregunta");
    expect(cuerpo).toContain("dijeron algo distinto");
  });
});

describe("los dos paneles de calidad dicen de dónde sale cada uno", () => {
  // C5. La sección de Validación apila DOS controles de calidad y el comentario
  // que los separa ya avisaba del riesgo —«separarlos evita que una fila
  // parezca respaldar a la otra»— pero eso vivía en el código. Arriba es lo que
  // la app deriva; abajo, lo que el equipo calcula en su Excel. Son dos medidas
  // distintas del mismo operativo, y quien las lee tiene que poder saberlo sin
  // abrir el repositorio.
  const calidad = fs.readFileSync(path.join(aqui, "AulasSeccionCalidad.tsx"), "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("el panel del motor dice que lo deriva la app", () => {
    expect(calidad).toContain("lo que deriva la app");
  });

  it("y el del libro, que lo calcula el equipo", () => {
    expect(calidad).toContain("lo que calcula el equipo");
  });
});

describe("los gráficos vecinos de Resumen no se confunden entre sí", () => {
  // G1. «Status de aplicación» y «Cursos-horario por cobertura» conviven en la
  // misma pestaña, reparten los MISMOS N cursos-horario en barras y llevaban el
  // MISMO subtítulo: el conteo, idéntico en los dos. La razón de que sean dos
  // vive en la cabecera de `AulasEstadoChart` —«separa sin agendar de agendada
  // y aún sin empezar, que la cobertura mete en el mismo saco»— y no llegaba a
  // la pantalla.
  const resumen = fs.readFileSync(path.join(aqui, "AulasPestanaResumen.tsx"), "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  // El artículo va en MASCULINO desde que la unidad dejó de ser el «aula» y
  // pasó a ser el «curso-horario» (ADR 0060, y el trinquete
  // `vocabularioDeLaUnidad`). El contrato decía «cada una» y se quedó con la
  // concordancia vieja; la pantalla dice «cada uno» desde entonces. Lo que este
  // guard protege —que los dos subtítulos digan QUÉ mira cada gráfico— no
  // cambia.
  it("el de status dice que mira el punto del circuito", () => {
    expect(resumen).toContain("en qué punto del circuito está cada uno");
  });

  it("y el de cobertura, cuánto lleva recogido y sobre qué universo", () => {
    // Desde el 2026-09-10 dice además que reparte los YA APLICADOS: sin eso, la
    // fila «Sin respuestas» se leía como cursos-horario pendientes cuando es la
    // categoría más grave del reparto —se fue y no llegó nada—. Él: «no
    // entiendo por qué la categoría sin respuestas sigue».
    // Sin fijar la sangría del JSX: el subtítulo va partido en dos líneas de
    // fuente y un reformateo tumbaría el guard sin que nada hubiera cambiado.
    expect(resumen.replace(/\s+/g, " ")).toContain("recogido cada uno de su propia meta");
    expect(resumen).toContain("ya aplicados");
  });

  it("y sus subtítulos ya no son idénticos", () => {
    // El guard que importa: si alguien vuelve a dejarlos iguales, esto salta.
    const subtitulos = [...resumen.matchAll(/<span>\{contadorDeAulas\(aulaRows\.length\)\}([^<]*)<\/span>/g)]
      .map((m) => m[1].trim());
    expect(new Set(subtitulos).size).toBe(subtitulos.length);
  });
});
