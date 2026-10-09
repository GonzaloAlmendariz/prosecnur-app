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

/**
 * **Un reparto que llegó y suma cero no es un reparto que no llegó.**
 *
 * Medido en pantalla el 2026-09-10 con Psicología en el selector: el panel decía
 * «El reparto por tramos no llegó con los datos y aquí sólo hay 6 de los 1 392»,
 * y el motor lo estaba publicando perfectamente — seis tramos en cero y cuatro
 * aulas esperando aplicación. Los dos casos caían por la misma rama, así que la
 * pantalla acusaba al payload de un problema que no tenía y escondía el hecho
 * real: en esa facultad todavía no se ha aplicado nada.
 */
describe("la cobertura de una facultad que aún no aplica nada", () => {
  const enCero = [
    { clave: "nulo", aulas: 0 }, { clave: "critico", aulas: 0 },
    { clave: "insuficiente", aulas: 0 }, { clave: "parcial", aulas: 0 },
    { clave: "satisfactorio", aulas: 0 }, { clave: "pleno", aulas: 0 },
  ];

  it("dice que no se ha aplicado nada, no que falte el reparto", () => {
    const html = renderToStaticMarkup(
      <AulasCoberturaChart
        filas={filas(6)} totalDelPlan={1392} resumen={enCero} sinAplicarMotor={4}
      />,
    );
    expect(html).toContain("Todavía no se ha aplicado ningún curso-horario");
    expect(html).toContain("4 esperan aplicación");
    // Y NO culpa al payload de algo que sí llegó.
    expect(html).not.toContain("no llegó con los datos");
    expect(html).not.toContain("1,392");
  });

  it("sin la cifra de las que esperan, la frase se cierra igual", () => {
    const html = renderToStaticMarkup(
      <AulasCoberturaChart filas={filas(6)} totalDelPlan={1392} resumen={enCero} />,
    );
    expect(html).toContain("no hay cobertura que repartir.");
    expect(html).not.toContain("esperan aplicación");
  });

  it("sin reparto y con el plan recortado sigue declarando el recorte", () => {
    const html = renderToStaticMarkup(
      <AulasCoberturaChart filas={filas(6)} totalDelPlan={1392} resumen={null} />,
    );
    expect(html).toContain("no es la del operativo");
  });
});
