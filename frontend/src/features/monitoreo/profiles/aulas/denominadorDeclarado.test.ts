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
