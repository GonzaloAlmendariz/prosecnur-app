import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasMetasAvance } from "./AulasMetasAvance";
import type { MonitoreoAulasProyeccionFila } from "../../../../api/monitoreo";

const fila = (extra: Partial<MonitoreoAulasProyeccionFila> = {}): MonitoreoAulasProyeccionFila => ({
  facultad: "DERECHO",
  meta: 363, meta_M: 126, meta_F: 237,
  obtenidas: 51, obtenidas_M: 17, obtenidas_F: 34,
  aulas_aplicadas: 3, aulas_agendadas: 9, elegibles_agendados: 320,
  tasa_usada: 0.568, tasa_es_del_diseno: true, tasa_diseno: 0.568, tasa_obtenida: 0.408,
  elegibles_aplicados: 125, desvio_de_la_del_diseno: -0.282,
  proyectadas: 181.9, proyectadas_M: 63, proyectadas_F: 118.9,
  total: 232.9, brecha: -130.1, llega: false,
  meta_elegida: "muestra", factor_meta: 1,
  supuesto_meta: "", supuesto_sexo: "…",
  ...extra,
});

describe("«Avance por facultad y sexo»", () => {
  it("las aulas van en la fila de la facultad, una sola vez", () => {
    const html = renderToStaticMarkup(
      <AulasMetasAvance filas={[fila()]} aulas={[{ facultad: "DERECHO", planificadas: 19, aplicadas: 3 }]} />,
    );
    // 19 aparece UNA vez: repetirlo en los dos carriles diría que hay aulas de
    // hombres y aulas de mujeres.
    expect(html.split(">19<").length - 1).toBe(1);
    expect(html).toContain(">3<");
  });

  it("una facultad sin dato de aulas escribe «—», no un cero que afirma", () => {
    const html = renderToStaticMarkup(<AulasMetasAvance filas={[fila()]} aulas={[]} />);
    expect(html).toContain("—");
    expect(html).not.toMatch(/es-num">0<\/td><td class="es-num">0</);
  });

  it("el porcentaje es el del sexo contra SU meta", () => {
    // Hombres 17 de 126 = 13,5 %.
    const html = renderToStaticMarkup(<AulasMetasAvance filas={[fila()]} aulas={[]} />);
    expect(html).toContain("13,5 %");
  });

  it("una meta en cero no divide: escribe «—»", () => {
    const html = renderToStaticMarkup(
      <AulasMetasAvance filas={[fila({ meta_M: 0, obtenidas_M: 0 })]} aulas={[]} />,
    );
    expect(html).toContain("—");
  });

  it("lo que falta se topa en cero: pasarse no es una falta negativa", () => {
    const html = renderToStaticMarkup(
      <AulasMetasAvance filas={[fila({ meta_M: 10, obtenidas_M: 40 })]} aulas={[]} />,
    );
    expect(html).not.toContain("-30");
  });

  it("la barra no se pasa del carril aunque la celda se pase de la meta", () => {
    const html = renderToStaticMarkup(
      <AulasMetasAvance filas={[fila({ meta_M: 10, obtenidas_M: 40 })]} aulas={[]} />,
    );
    expect(html).toContain("width:100%");
    expect(html).not.toMatch(/width:[2-9]\d\d/);
  });

  it("sin filas no pinta una tabla vacía", () => {
    expect(renderToStaticMarkup(<AulasMetasAvance filas={null} aulas={[]} />)).toBe("");
  });
});
