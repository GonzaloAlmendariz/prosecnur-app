import { describe, expect, it } from "vitest";

import { contradiccionDeEstado, estadoDeMuestraLegible } from "./estadoDeMuestraLegible";

describe("una fila no puede decir «Aplicada» y «Sin contactar» a la vez", () => {
  it("marca la contradicción cuando el eje operativo dice que ya se aplicó", () => {
    // El caso medido: sobre la selección real de HSVG2026 con una semana de
    // campo, 78 de 174 filas salían así.
    expect(contradiccionDeEstado("sin_contactar", "aplicada")).toBe("ya se aplicó");
    expect(estadoDeMuestraLegible("sin_contactar", "aplicada")).toBe("sin_contactar ⚠ pero ya se aplicó");
  });

  it("cubre las seis palabras que el normalizador se traga", () => {
    // `monitoreo_aulas_estados_no_reconocidos.R` las mide una a una.
    for (const [op, dice] of [["cerrada", "ya se cerró"], ["parcial", "se aplicó a medias"],
                              ["en_campo", "está en campo"], ["agendada", "tiene cita"],
                              ["contactada", "ya se contactó"]] as const) {
      expect(contradiccionDeEstado("sin_contactar", op)).toBe(dice);
    }
  });

  it("un aula de verdad sin contactar NO se marca", () => {
    // Es el caso mayoritario y legítimo: 1 810 de 2 040 celdas del estudio de
    // 2025 vienen en blanco o con «-». Marcarlas sería ruido puro.
    expect(contradiccionDeEstado("sin_contactar", "planificada")).toBeNull();
    expect(contradiccionDeEstado("sin_contactar", "")).toBeNull();
    expect(estadoDeMuestraLegible("sin_contactar", "planificada")).toBe("sin_contactar");
  });

  it("un estado reconocido se enseña tal cual, sin tocarlo", () => {
    // No reescribe datos buenos: «agendada» es un valor que la lista SÍ
    // reconoce, así que llega intacto y no hay nada que señalar.
    expect(contradiccionDeEstado("agendada", "aplicada")).toBeNull();
    expect(estadoDeMuestraLegible("agendada", "aplicada")).toBe("agendada");
    expect(estadoDeMuestraLegible("reemplazada", "cerrada")).toBe("reemplazada");
  });

  it("tolera espacios y mayúsculas, que es como llegan de la hoja", () => {
    expect(contradiccionDeEstado("Sin Contactar", "EN CAMPO")).toBe("está en campo");
  });
});
