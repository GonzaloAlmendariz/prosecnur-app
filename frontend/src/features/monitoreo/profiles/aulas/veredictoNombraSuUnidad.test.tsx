import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AulasControlDelLibro } from "./AulasControlDelLibro";

/**
 * La hoja de control está en formato LARGO: una fila por curso-horario y sexo.
 *
 * Medido sobre el estudio real: **304 filas y 152 cursos-horario**, cada uno con
 * exactamente su «F» y su «M», y el resumen del motor devuelve
 * `indeterminadas: 304`. El veredicto cuenta esas filas —no aulas—, así que
 * llamarlas «aulas» prometía un número que es el doble de las que existen.
 *
 * Es la misma familia que «de 30 celdas sexo × facultad», ya reparado en este
 * mismo perfil: la unidad de la cuota de sexo es el grupo, y el rótulo la nombra.
 */
const resumen = (veredicto: Record<string, number>) => ({
  aulas: 304, grupos: [], veredicto,
}) as never;

const pintar = (veredicto: Record<string, number>) =>
  renderToStaticMarkup(
    <AulasControlDelLibro filas={[]} resumen={resumen(veredicto)} criterio={null as never} />,
  );

describe("el veredicto del control nombra lo que cuenta", () => {
  it("con todo evaluado no dice «aulas»: son grupos de curso-horario y sexo", () => {
    const html = pintar({ efectivas: 200, indeterminadas: 0 });
    expect(html).toContain("grupos de curso-horario y sexo");
    expect(html).not.toMatch(/de \d+ aulas efectivas/);
  });

  it("con parte sin evaluar, el denominador sigue siendo grupos", () => {
    const html = pintar({ efectivas: 100, indeterminadas: 104 });
    expect(html).toContain("grupos evaluados");
    // 304 − 104: el denominador sale de restar, y se comprueba la cifra para que
    // el test no pase por el mero hecho de encontrar la palabra.
    expect(html).toContain("200");
  });
});
