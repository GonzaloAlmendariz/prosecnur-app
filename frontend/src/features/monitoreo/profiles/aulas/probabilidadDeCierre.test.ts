import { describe, expect, it } from "vitest";
import { avanceProyectado } from "./avanceProyectado";

const celda = (p: Record<string, unknown> = {}) =>
  ({ faculty: "DERECHO", sex: "F", cuota: 10, logrado: 0, aporte_pendiente: 12,
     proyeccion: 12, brecha: 0, estado: "ajustada", etiqueta: "Va a llegar", ...p });

describe("la probabilidad de cierre llega a la fila", () => {
  it("pasa la del motor tal cual, sin recalcular", () => {
    const [f] = avanceProyectado([celda({ prob_cierre: 0.83 })]);
    expect(f.probabilidad).toBe(0.83);
  });

  it("UN CERO MEDIDO Y UN NO MEDIDO NO SON LO MISMO", () => {
    // El punto entero del campo. `num()` habría devuelto 0 para ambos, y 0
    // significa «no va a cerrar», que es una afirmación fuerte.
    expect(avanceProyectado([celda({ prob_cierre: 0 })])[0].probabilidad).toBe(0);
    expect(avanceProyectado([celda({ prob_cierre: null })])[0].probabilidad).toBeNull();
    expect(avanceProyectado([celda()])[0].probabilidad).toBeNull();
  });

  it("descarta lo que no es una probabilidad en vez de recortarlo", () => {
    // Recortar un 1,4 a 1 publicaría «100 % de cerrar» sobre un dato roto.
    for (const v of [1.4, -0.2, "mucho", NaN, Infinity]) {
      expect(avanceProyectado([celda({ prob_cierre: v })])[0].probabilidad).toBeNull();
    }
  });

  it("los extremos válidos sí pasan", () => {
    expect(avanceProyectado([celda({ prob_cierre: 1 })])[0].probabilidad).toBe(1);
    expect(avanceProyectado([celda({ prob_cierre: "0.5" })])[0].probabilidad).toBe(0.5);
  });

  it("no toca el veredicto: conviven", () => {
    const [f] = avanceProyectado([celda({ prob_cierre: 0.51, estado: "ajustada" })]);
    expect(f.estado).toBe("ajustada");
    expect(f.etiqueta).toBe("Va a llegar");
    expect(f.probabilidad).toBe(0.51);
  });
});
