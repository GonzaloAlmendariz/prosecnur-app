import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasCoberturaChart } from "./AulasCoberturaChart";
import { AulasEstadoChart } from "./AulasEstadoChart";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * **Un respaldo que dibuja sobre un recorte miente con aire de cierto.**
 *
 * `course_status` viaja recortado —medido el 2026-09-09: 500 filas de 1 392— y
 * el recorte NO es una muestra al azar, va ordenado por tramo del circuito. El
 * gráfico prefiere el bloque del motor, que cuenta el plan entero; pero si ese
 * bloque falta, repartir las 500 que llegaron dibuja una forma falsa que nadie
 * puede distinguir de la buena.
 */
const fila = (i: number): MonitoreoAulasPlanRow => ({
  operational_code: `CH ${i}`,
  respuestas_validas: 10,
  expected_valid: 10,
} as unknown as MonitoreoAulasPlanRow);

const filas = (n: number) => Array.from({ length: n }, (_, i) => fila(i + 1));

describe("el respaldo de «Cursos-horario por cobertura»", () => {
  it("con el plan recortado y sin bloque del motor, DECLARA en vez de dibujar", () => {
    const html = renderToStaticMarkup(
      <AulasCoberturaChart filas={filas(500)} resumen={null} totalDelPlan={1392} />,
    );
    expect(html).toContain("500");
    expect(html).toContain("1,392");
    expect(html).toContain("no es la del operativo");
  });

  it("con el bloque del motor, el recorte da igual: manda el motor", () => {
    const html = renderToStaticMarkup(
      <AulasCoberturaChart
        filas={filas(500)} totalDelPlan={1392}
        resumen={[{ clave: "pleno", aulas: 34 }, { clave: "nulo", aulas: 125 }]}
      />,
    );
    expect(html).not.toContain("no es la del operativo");
    expect(html).toContain("34");
  });

  it("sin recorte, el respaldo calcula como siempre", () => {
    const html = renderToStaticMarkup(
      <AulasCoberturaChart filas={filas(12)} resumen={null} totalDelPlan={12} />,
    );
    expect(html).not.toContain("no es la del operativo");
  });

  it("un payload sin `totalDelPlan` se comporta como antes: no se asume recorte", () => {
    const html = renderToStaticMarkup(<AulasCoberturaChart filas={filas(12)} resumen={null} />);
    expect(html).not.toContain("no es la del operativo");
  });
});

/**
 * El gemelo: «Estado de aplicación» tenía el mismo respaldo sin declarar.
 * Cerrarlo en uno y dejarlo abierto en el otro sería exactamente la asimetría
 * que hoy dejó al panel de los aplicadores fallando mientras el del libro se
 * salvaba por suerte.
 */
describe("el respaldo de «Estado de aplicación»", () => {
  it("con el plan recortado y sin bloque del motor, DECLARA en vez de dibujar", () => {
    const html = renderToStaticMarkup(
      <AulasEstadoChart filas={filas(500)} resumen={null} totalDelPlan={1392} />,
    );
    expect(html).toContain("500");
    expect(html).toContain("1,392");
    expect(html).toContain("más avanzado del que hay");
  });

  it("con el bloque del motor manda el motor, recortado o no", () => {
    const html = renderToStaticMarkup(
      <AulasEstadoChart
        filas={filas(500)} totalDelPlan={1392}
        resumen={[{ clave: "pendiente", aulas: 83 }, { clave: "lista", aulas: 91 }]}
      />,
    );
    expect(html).not.toContain("más avanzado del que hay");
  });

  it("sin recorte reparte como siempre, y sin el dato no se asume recorte", () => {
    expect(renderToStaticMarkup(
      <AulasEstadoChart filas={filas(12)} resumen={null} totalDelPlan={12} />,
    )).not.toContain("más avanzado del que hay");
    expect(renderToStaticMarkup(
      <AulasEstadoChart filas={filas(12)} resumen={null} />,
    )).not.toContain("más avanzado del que hay");
  });
});
