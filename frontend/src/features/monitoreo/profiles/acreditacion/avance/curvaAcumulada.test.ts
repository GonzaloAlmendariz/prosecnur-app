import { describe, expect, it } from "vitest";
import { DIAS_MAXIMOS_DE_PROYECCION, DIAS_MINIMOS_DE_LA_CURVA, sumarDias, tramoProyectado } from "./graficosDeAvance";

describe("Avance › Resumen, curva acumulada", () => {
  it("proyecta al ritmo de la última semana hasta la meta y abre la ventana a dos semanas como mínimo", () => {
    const tramo = tramoProyectado(629, 8507, 314.5, 2);
    expect(tramo).toMatchObject({ dias: 26, visibles: 26, alcanzaLaMeta: true, valor: 8507, span: 28 });
    expect(tramoProyectado(100, 200, 50, 1)?.span).toBe(DIAS_MINIMOS_DE_LA_CURVA);
  });

  it("si la meta queda más lejos que la ventana, la línea se corta en el borde sin decir una fecha", () => {
    const tramo = tramoProyectado(10, 10_000, 5, 3);
    expect(tramo?.alcanzaLaMeta).toBe(false);
    expect(tramo?.visibles).toBe(DIAS_MAXIMOS_DE_PROYECCION);
    expect(tramo?.valor).toBe(10 + 5 * DIAS_MAXIMOS_DE_PROYECCION);
  });

  it("sin ritmo o con la meta cumplida no hay proyección", () => {
    expect(tramoProyectado(629, 8507, 0, 2)).toBeNull();
    expect(tramoProyectado(9000, 8507, 300, 20)).toBeNull();
  });

  it("suma días de calendario cruzando el mes", () => {
    expect(sumarDias("2026-10-30", 26)).toBe("2026-11-25");
  });
});
