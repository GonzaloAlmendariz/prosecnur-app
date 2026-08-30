import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AulasAvanceProyectado } from "./AulasAvanceProyectado";

/**
 * Una celda sin `prob_cierre` puede serlo por dos motivos opuestos, y la pantalla
 * los daba por el mismo: «sin medir · Alguno de los cursos-horario que faltan no
 * declara su tasa de efectividad».
 *
 * Medido el 2026-08-30: **12 de las 30 celdas** no traen probabilidad, y las 12
 * tienen `aporte_pendiente` 0 con el logrado POR ENCIMA de su cuota. No falta
 * ningún dato: ya llegaron. El aviso daba una causa falsa y hacía leer como un
 * hueco el mejor resultado posible.
 */
const celda = (extra: Record<string, unknown>) => ({
  faculty: "EDUCACION", sex: "F", cuota: 10, logrado: 21, previsto: 20,
  proyeccion: 21, brecha: 0, estado: "asegurada", etiqueta: "Va a llegar, con margen",
  previsto_origen: "composicion_del_aula", dispersion: 2.78, dispersion_n: 152,
  ...extra,
}) as never;

describe("la proyección distingue «ya llegó» de «no se pudo medir»", () => {
  it("sin aporte pendiente dice que ya llegó, no que falte un dato", () => {
    const html = renderToStaticMarkup(<AulasAvanceProyectado celdas={[celda({ aporte_pendiente: 0 })]} />);
    expect(html).toContain("ya llegó");
    expect(html).toContain("no hay nada que proyectar");
    expect(html).not.toContain("no declara su tasa de efectividad");
  });

  it("con aporte pendiente y sin probabilidad sí acusa al dato que falta", () => {
    const html = renderToStaticMarkup(
      <AulasAvanceProyectado celdas={[celda({ aporte_pendiente: 12, prob_cierre: null })]} />,
    );
    expect(html).toContain("sin medir");
    expect(html).toContain("no declara su tasa de efectividad");
  });

  it("con poco campo la causa sigue siendo la dispersión, no el cierre", () => {
    const html = renderToStaticMarkup(
      <AulasAvanceProyectado celdas={[celda({ aporte_pendiente: 12, prob_cierre: null, dispersion_n: 4 })]} />,
    );
    expect(html).toContain("bastante campo para medir");
  });
});
