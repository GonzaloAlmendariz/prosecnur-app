import { describe, expect, it } from "vitest";

import { construirApiladoDeEstados, detalleDeSegmento, resumenDelDia } from "./apiladoDeEstados";
import type { AcreditacionPhoneDailyStatusSeries } from "../profiles/acreditacion/AcreditacionPhoneDailyTrend";

function punto(dia: string, value: number) {
  return {
    rawLabel: dia,
    label: dia,
    axisLabel: dia.slice(5),
    value,
    date: new Date(`${dia}T00:00:00`),
  };
}

function serie(label: string, puntos: Array<[string, number]>): AcreditacionPhoneDailyStatusSeries {
  const points = puntos.map(([dia, value]) => punto(dia, value));
  return { label, total: points.reduce((s, p) => s + p.value, 0), points };
}

describe("construirApiladoDeEstados", () => {
  it("hace una barra por día y agrupa los estados crudos en familias", () => {
    const apilado = construirApiladoDeEstados([
      serie("Completa", [["2026-06-01", 3], ["2026-06-02", 2]]),
      serie("No contesta", [["2026-06-01", 1]]),
    ]);
    expect(apilado.dias.map((d) => d.dia)).toEqual(["2026-06-01", "2026-06-02"]);
    expect(apilado.dias[0].total).toBe(4);
    expect(apilado.dias[1].total).toBe(2);
  });

  it("dos estados crudos de la misma familia se suman en un solo segmento", () => {
    const apilado = construirApiladoDeEstados([
      serie("No contesta", [["2026-06-01", 2]]),
      serie("Buzón de voz", [["2026-06-01", 3]]),
    ]);
    const [dia] = apilado.dias;
    const sinContacto = dia.segmentos.filter((s) => s.familia === "sin_contacto");
    expect(sinContacto).toHaveLength(1);
    expect(sinContacto[0].casos).toBe(5);
    // El hover conserva de qué estados crudos salió.
    expect(sinContacto[0].crudos).toEqual(["No contesta", "Buzón de voz"]);
  });

  it("NO acumula entre días: cada barra es lo registrado ese día", () => {
    // La matriz reparte cada caso una sola vez. Acumular contaría de más y
    // dibujaría una evolución que el corte no guarda.
    const apilado = construirApiladoDeEstados([
      serie("Completa", [["2026-06-01", 5], ["2026-06-02", 5]]),
    ]);
    expect(apilado.dias[1].total).toBe(5);
    expect(apilado.total).toBe(10);
  });

  it("los porcentajes de un día suman 100", () => {
    const apilado = construirApiladoDeEstados([
      serie("Completa", [["2026-06-01", 1]]),
      serie("Rechazo", [["2026-06-01", 3]]),
    ]);
    const suma = apilado.dias[0].segmentos.reduce((s, seg) => s + seg.porcentaje, 0);
    expect(Math.round(suma)).toBe(100);
  });

  it("descarta puntos sin fecha en vez de inventar un día", () => {
    const apilado = construirApiladoDeEstados([
      {
        label: "Completa",
        total: 9,
        points: [
          punto("2026-06-01", 4),
          { rawLabel: "Sin fecha", label: "Sin fecha", axisLabel: "Sin fecha", value: 5, date: null },
        ],
      },
    ]);
    expect(apilado.dias).toHaveLength(1);
    expect(apilado.total).toBe(4);
  });

  it("respeta el color y la familia que el usuario declaró", () => {
    const apilado = construirApiladoDeEstados(
      [serie("Contactado por WhatsApp", [["2026-06-01", 2]])],
      [{ familia: "efectivo", color: "#00c2a8", crudos: ["Contactado por WhatsApp"] }],
    );
    const [segmento] = apilado.dias[0].segmentos;
    expect(segmento.familia).toBe("efectivo");
    expect(segmento.color).toBe("#00c2a8");
  });

  it("la leyenda solo lista familias presentes, en orden canónico", () => {
    const apilado = construirApiladoDeEstados([
      serie("Rechazo", [["2026-06-01", 1]]),
      serie("Completa", [["2026-06-01", 1]]),
    ]);
    const familias = apilado.familias.map((f) => f.familia);
    expect(familias).toContain("efectivo");
    expect(familias).toContain("rechazo");
    expect(familias).not.toContain("numero_invalido");
    // "efectivo" va antes que "rechazo" en el orden canónico.
    expect(familias.indexOf("efectivo")).toBeLessThan(familias.indexOf("rechazo"));
  });

  it("ordena por fecha real, no por el texto de la etiqueta", () => {
    // Con etiquetas como "3 jun" / "10 jun" el orden alfabético pone el 10
    // antes que el 3, y el gráfico salía con los días barajados.
    const conEtiquetaCorta = (dia: string, etiqueta: string, value: number) => ({
      rawLabel: etiqueta,
      label: etiqueta,
      axisLabel: etiqueta,
      value,
      date: new Date(`${dia}T00:00:00`),
    });
    const apilado = construirApiladoDeEstados([
      {
        label: "Completa",
        total: 3,
        points: [
          conEtiquetaCorta("2026-06-10", "10 jun", 1),
          conEtiquetaCorta("2026-06-03", "3 jun", 1),
          conEtiquetaCorta("2026-06-15", "15 jun", 1),
        ],
      },
    ]);
    expect(apilado.dias.map((d) => d.etiquetaEje)).toEqual(["3 jun", "10 jun", "15 jun"]);
  });

  it("sin series no dibuja nada y no divide por cero", () => {
    const apilado = construirApiladoDeEstados([]);
    expect(apilado.dias).toEqual([]);
    expect(apilado.total).toBe(0);
    expect(apilado.maximo).toBe(1);
  });
});

describe("detalleDeSegmento", () => {
  it("no repite el nombre cuando el estado crudo coincide con su familia", () => {
    // Decía "Rechazo: 1 de 1 (Rechazo)".
    const apilado = construirApiladoDeEstados([serie("Rechazo", [["2026-06-01", 1]])]);
    const dia = apilado.dias[0];
    expect(detalleDeSegmento(dia, dia.segmentos[0])).not.toContain("(");
  });

  it("dice el día, la familia, cuántos de cuántos y de qué estados salió", () => {
    const apilado = construirApiladoDeEstados([
      serie("No contesta", [["2026-06-01", 2]]),
      serie("Completa", [["2026-06-01", 2]]),
    ]);
    const dia = apilado.dias[0];
    const segmento = dia.segmentos.find((s) => s.familia === "sin_contacto")!;
    const texto = detalleDeSegmento(dia, segmento);
    expect(texto).toContain("2 de 4");
    expect(texto).toContain("No contesta");
  });
});

// El hover se lee en la cabecera, no en un tooltip flotante: el `title` nativo
// tarda cerca de un segundo, no sigue al puntero y las franjas más finas miden
// 4 px, así que apuntarlas con el ratón no era practicable.
describe("resumenDelDia", () => {
  it("dice la fecha, el total y el reparto por estado", () => {
    const apilado = construirApiladoDeEstados([
      serie("Completa", [["2026-06-05", 35]]),
      serie("No contesta", [["2026-06-05", 4]]),
    ]);
    const texto = resumenDelDia(apilado.dias[0]);
    expect(texto).toContain("39 casos");
    expect(texto).toContain("Efectivo 35");
    expect(texto).toContain("Sin contacto 4");
  });

  it("un día de un solo estado no arrastra separadores sueltos", () => {
    const apilado = construirApiladoDeEstados([serie("Rechazo", [["2026-06-01", 1]])]);
    const texto = resumenDelDia(apilado.dias[0]);
    expect(texto).not.toMatch(/·\s*$/);
  });

  it("un solo caso se dice en singular", () => {
    // Decía «1 casos», y el test anterior lo dejaba pasar porque `toContain`
    // con "1 caso" también acierta dentro de "1 casos".
    const apilado = construirApiladoDeEstados([serie("Rechazo", [["2026-06-01", 1]])]);
    expect(resumenDelDia(apilado.dias[0])).toContain("1 caso ·");
    expect(resumenDelDia(apilado.dias[0])).not.toContain("1 casos");
  });
});
