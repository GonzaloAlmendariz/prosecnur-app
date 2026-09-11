import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasPeorRendimiento } from "./AulasPeorRendimiento";
import type { MonitoreoAulasEfectividadSeguimiento, MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const bloque = {
  total: {},
  facultades: [
    { facultad: "ARTES ESCÉNICAS", faculty_key: "artes", aulas_aplicadas: 4, tau_previsto: 0.74, tau_observado: 0.37 },
    { facultad: "DERECHO", faculty_key: "derecho", aulas_aplicadas: 6, tau_previsto: 0.60, tau_observado: 0.42 },
    { facultad: "CIENCIAS SOCIALES", faculty_key: "sociales", aulas_aplicadas: 20, tau_previsto: 0.55, tau_observado: 0.528 },
    { facultad: "GESTIÓN Y ALTA DIRECCIÓN", faculty_key: "gestion", aulas_aplicadas: 5, tau_previsto: 0.50, tau_observado: 0.49 },
    { facultad: "LETRAS Y CIENCIAS HUMANAS", faculty_key: "letras", aulas_aplicadas: 7, tau_previsto: 0.60, tau_observado: 0.594 },
    { facultad: "ARQUITECTURA Y URBANISMO", faculty_key: "arq", aulas_aplicadas: 8, tau_previsto: 0.55, tau_observado: 0.549 },
    { facultad: "EDUCACIÓN", faculty_key: "educacion", aulas_aplicadas: 2, tau_previsto: 0.62, tau_observado: 0.10 },
  ],
} as unknown as MonitoreoAulasEfectividadSeguimiento;

const plan = [
  { faculty: "ARTES ESCÉNICAS", sample_role: "reemplazo", respuestas_validas: 12, operational_status: "programada" },
] as unknown as MonitoreoAulasPlanRow[];

describe("«Facultades que más se alejan de su previsión»", () => {
  it("cada cifra declara su base: el denominador del ranking y las apartadas", () => {
    const html = renderToStaticMarkup(<AulasPeorRendimiento bloque={bloque} porSexo={[]} plan={plan} />);
    // Seis comparables de siete: sin decirlo, el «top 5» parecería mirar a todas.
    expect(html).toContain("<strong>6</strong> de <strong>6</strong> facultades con campo suficiente");
    expect(html).toContain("rinden por debajo de lo que su diseño preveía");
    // Y el tope recorta: se dice que la lista no las trae todas.
    expect(html).toContain("aquí van las 5 que más se alejan");
    expect(html).toContain("Otra facultad queda fuera");
    expect(html).toContain("por tener menos de 3 cursos-horario aplicados");
  });

  it("nombra los apoyos que ya rindieron, que es lo que sube la tasa sin cambiar nada", () => {
    const html = renderToStaticMarkup(<AulasPeorRendimiento bloque={bloque} porSexo={[]} plan={plan} />);
    expect(html).toContain("1 apoyo aplicado");
    // Y no lo dice donde no lo hay: un «0 apoyos» llenaría la lista de ceros.
    expect(html).not.toContain("0 apoyos");
  });

  it("las tres cifras de cada fila son observada, prevista y su razón", () => {
    const html = renderToStaticMarkup(<AulasPeorRendimiento bloque={bloque} porSexo={[]} plan={plan} />);
    expect(html).toContain("37.0 %");
    expect(html).toContain("de 74.0 %");
    expect(html).toContain("50.0 %");
  });

  it("con el filtro puesto sigue comparando, y sitúa a la facultad en su puesto real", () => {
    // Arquitectura rinde casi lo previsto: no está entre las cinco peores, y sin
    // añadirla la tarjeta no contestaría nada con ese filtro puesto.
    const html = renderToStaticMarkup(
      <AulasPeorRendimiento bloque={bloque} porSexo={[]} plan={plan} facultadEnFoco="ARQUITECTURA Y URBANISMO" />,
    );
    expect(html).toContain("Arquitectura");
    expect(html).toContain("es-foco");
    expect(html).toContain("6.ª de 6");
    // El ranking NO se recorta al filtro: las otras siguen ahí para comparar.
    expect(html).toContain("Derecho");
  });

  it("sin campo suficiente publica su vacío en vez de un ranking de ruido", () => {
    const pocas = {
      total: {},
      facultades: [{ facultad: "EDUCACIÓN", faculty_key: "educacion", aulas_aplicadas: 2, tau_previsto: 0.62, tau_observado: 0.10 }],
    } as unknown as MonitoreoAulasEfectividadSeguimiento;
    const html = renderToStaticMarkup(<AulasPeorRendimiento bloque={pocas} porSexo={[]} plan={[]} />);
    expect(html).toContain("Ninguna facultad llega todavía a 3");
    expect(html).toContain("Hay 1 con campo empezado");
  });
});
