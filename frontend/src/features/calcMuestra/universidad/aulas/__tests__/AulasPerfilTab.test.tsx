import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasPerfilTab } from "../AulasPerfilTab";

/**
 * Filas con la forma que trae el marco vigente: los nombres de columna son los
 * del `aula_frame` real (`faculty`, `eligible_n`, `size_group`,
 * `course_level_num`…), no una invención del test.
 */
function aula(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    classroom_id: "CH1",
    faculty: "CIENCIAS E INGENIERIA",
    eligible_n: 30,
    size_group: "G2",
    session_type: "TEORICO",
    course_level_num: 5,
    teacher_type: "CONTRATADO",
    modality: "PRESENCIAL",
    ...over,
  };
}

const marco = [
  aula(), aula({ size_group: "G1" }), aula({ size_group: "G3" }),
  aula({ faculty: "DERECHO", size_group: "G1" }),
];

describe("AulasPerfilTab", () => {
  it("dice dónde correr la selección cuando todavía no hay ninguna", () => {
    // C3: la superficie contiene su propio vacío y apunta a la acción, en vez
    // de dejar una pestaña en blanco.
    const html = renderToStaticMarkup(
      <AulasPerfilTab titulares={[]} marco={marco} referencia={null} />,
    );
    expect(html).toContain("Todavía no hay una selección que perfilar");
    expect(html).toContain("Cursos-horario titulares");
    expect(html).toContain('data-audit-ready="false"');
  });

  it("reparte las aulas por facultad y suma sus elegibles", () => {
    const titulares = [
      aula({ classroom_id: "A", eligible_n: 30 }),
      aula({ classroom_id: "B", eligible_n: 20, size_group: "G1" }),
      aula({ classroom_id: "C", faculty: "DERECHO", eligible_n: 50, size_group: "G3" }),
    ];
    const html = renderToStaticMarkup(
      <AulasPerfilTab titulares={titulares} marco={marco} referencia={null} />,
    );

    expect(html).toContain('data-audit-ready="true"');
    expect(html).toContain("3 cursos-horario titulares en 2 facultades");
    // 30 + 20 + 50 elegibles, 33 por aula en promedio.
    expect(html).toContain("100");
    expect(html).toContain("CIENCIAS E INGENIERIA");
    expect(html).toContain("DERECHO");
  });

  it("dibuja un criterio sólo cuando de verdad varía", () => {
    // Modalidad es PRESENCIAL en todas: un criterio que no varía no describe
    // nada y dibujar una barra al 100 % sólo gasta pantalla.
    const titulares = [
      aula({ classroom_id: "A", size_group: "G1" }),
      aula({ classroom_id: "B", size_group: "G2" }),
    ];
    const html = renderToStaticMarkup(
      <AulasPerfilTab titulares={titulares} marco={marco} referencia={null} />,
    );
    expect(html).toContain("Grupo de tamaño");
    expect(html).not.toContain("Modalidad");
  });

  it("trae el año pasado como lectura al pie, no como protagonista", () => {
    const titulares = [aula({ size_group: "G1" }), aula({ size_group: "G2" })];
    const referencia = {
      estudio: { id: "prev", label: "Estudio anterior", periodo: "2025-II", fuente: "control" },
      cadena: {
        asistencia: { tasa: 0.79 },
        efectividad: { tasa: 0.75 },
        rendimiento: { tasa: 0.53 },
      },
      cadenas_reemplazo: {
        cadenas_declaradas: 100,
        resueltas_con_reemplazo: 24,
      },
    } as unknown as Parameters<typeof AulasPerfilTab>[0]["referencia"];

    const html = renderToStaticMarkup(
      <AulasPerfilTab titulares={titulares} marco={marco} referencia={referencia} />,
    );
    expect(html).toContain("Lo que pasó el año pasado");
    expect(html).toContain("79%");
    expect(html).toContain("24%");
    // Y sigue siendo el bloque atenuado: el dato es la muestra de este año.
    expect(html).toContain("cmv2-perfil-bloque-tenue");
  });
});
