import { describe, expect, it } from "vitest";
import { ubicarRotulo, zonaReservada } from "./capasNacional";

const lienzo = { w: 1000, h: 600 };
const base = { radio: 10, ancho: 80, alto: 30, lienzo };

describe("ubicarRotulo", () => {
  it("prefiere la derecha del círculo", () => {
    expect(ubicarRotulo({ ...base, centro: [300, 300], ocupado: [] })?.alinear).toBe("left");
  });
  it("si la derecha la ocupa otro rótulo, prueba la izquierda", () => {
    const l = ubicarRotulo({ ...base, centro: [300, 300], ocupado: [[315, 280, 420, 320]] });
    expect(l?.alinear).toBe("right");
    expect(l!.caja[2]).toBeLessThan(300);
  });
  it("con ambos lados ocupados sube encima del círculo", () => {
    const l = ubicarRotulo({ ...base, centro: [300, 300], ocupado: [[315, 290, 420, 320], [180, 290, 285, 320]] });
    expect(l?.alinear).toBe("center");
    expect(l!.caja[3]).toBeLessThan(290);
  });
  it("nunca cae sobre el zoom ni la atribución de la esquina inferior derecha", () => {
    const [x0, y0] = zonaReservada(lienzo.w, lienzo.h);
    const l = ubicarRotulo({ ...base, centro: [x0 - 60, y0 + 20], ocupado: [] });
    expect(l).not.toBeNull();
    expect(l!.caja[2] < x0 || l!.caja[3] < y0).toBe(true);
  });
  it("sin lugar libre devuelve null en vez de montarse", () => {
    expect(ubicarRotulo({ ...base, centro: [300, 300], ocupado: [[0, 0, 1000, 600]] })).toBeNull();
  });
});
