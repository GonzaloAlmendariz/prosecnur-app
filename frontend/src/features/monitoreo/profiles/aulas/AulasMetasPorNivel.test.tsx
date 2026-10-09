import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasProyeccionFila } from "../../../../api/monitoreo";
import { AulasMetasBarras } from "./AulasMetasBarras";
import { AulasMetasCinta } from "./AulasMetasCinta";
import { AulasMetasYAulas } from "./AulasMetasYAulas";
import { AulasMetasAvance } from "./AulasMetasAvance";
import { carrilesDeLaFila, cintaDeMetas } from "./metasDeLaPestana";

/**
 * Gonzalo, 2026-09-23, sobre CCSS: «no tengo forma de saber cuántas vamos y
 * cuántas faltan […] la única diferencia es que esas eran por facultad y por
 * sexo, aquí sólo serían por nivel». Las filas del eje llegan `sin_sexo`.
 */
const nivel = (valor: string, meta: number, obtenidas: number, proyectadas: number) => ({
  facultad: valor, faculty_key: valor, sin_sexo: true,
  meta, meta_M: null, meta_F: null, obtenidas, obtenidas_M: null, obtenidas_F: null,
  proyectadas, proyectadas_M: null, proyectadas_F: null,
  aulas_aplicadas: 8, aulas_agendadas: 13, elegibles_agendados: 40,
  total: obtenidas + proyectadas, brecha: obtenidas + proyectadas - meta,
  llega: obtenidas + proyectadas >= meta,
}) as unknown as MonitoreoAulasProyeccionFila;

const filas = [nivel("9", 62, 18, 20), nivel("6", 119, 52, 132)];
const eje = { clave: "nivel", columna: "level", etiqueta: "Nivel", etiqueta_plural: "Niveles",
              etiqueta_sin: "Sin nivel", atribucion: "persona", fuente_valor: "padron", motivo: "" };

describe("Metas por nivel: un carril por fila, sin sexo", () => {
  it("el helper da un solo carril «Total» con la meta y lo que cuenta", () => {
    const c = carrilesDeLaFila(filas[0]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ rotulo: "Total", tono: "total", meta: 62, obtenidas: 18, proyectadas: 20 });
  });

  it("la cinta dice la meta y lo que cuenta, sin celdas de sexo en cero", () => {
    const html = renderToStaticMarkup(<AulasMetasCinta cinta={cintaDeMetas(filas)} meta="muestra" />);
    expect(html).toContain("Cuentan para la muestra");
    expect(html).toContain("181");
    expect(html).not.toContain("Hombres");
  });

  it("las barras de escala común pintan una barra por nivel, rotulada «Nivel 9»", () => {
    const html = renderToStaticMarkup(<AulasMetasBarras filas={filas} eje={eje} />);
    expect((html.match(/aulas-metas-barra-logro/g) ?? []).length).toBe(2);
    expect(html).toContain("Nivel 9");
    expect(html).toContain("29%");
    expect(html).not.toContain(">Hombres<");
  });

  it("«Metas y aulas» y el avance pintan el carril Total con sus cifras", () => {
    const y = renderToStaticMarkup(<AulasMetasYAulas filas={filas} eje={eje} />);
    expect(y).toContain("Total");
    expect(y).toContain("Nivel 6");
    expect(y).not.toContain("Mujeres");
    const a = renderToStaticMarkup(<AulasMetasAvance filas={filas} aulas={[]} eje={eje} />);
    expect(a).toContain("Total");
    expect(a).toContain(">Nivel<");
  });
});
