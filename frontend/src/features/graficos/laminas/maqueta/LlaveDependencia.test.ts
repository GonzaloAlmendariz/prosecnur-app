import { describe, expect, it } from "vitest";
import { dependenciaDe } from "../DependenciaLamina";
import { trazoLlave } from "./LlaveDependencia";

const izq = { x: 0.05, y: 0.2, w: 0.42, h: 0.6 };
const der = { x: 0.53, y: 0.2, w: 0.42, h: 0.6 };
const arriba = { x: 0.05, y: 0.18, w: 0.9, h: 0.25 };
const abajo = { x: 0.05, y: 0.55, w: 0.9, h: 0.3 };

describe("llave de la dependencia en la maqueta (F5)", () => {
  it("lado a lado, la llave va en la calle entre los dos y llega al dependiente", () => {
    const d = trazoLlave(izq, der);
    expect(d).toContain(`H ${der.x}`);
    const xs = [...d.matchAll(/H ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(izq.x + izq.w - 0.02);
  });

  it("uno sobre otro, la llave va bajo el de arriba", () => {
    const d = trazoLlave(arriba, abajo);
    const ys = [...d.matchAll(/V ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThan(arriba.y + arriba.h - 0.02);
    expect(Math.max(...ys)).toBeLessThanOrEqual(abajo.y + 0.02);
  });

  it("la dependencia guardada conserva quiénes son, recortado", () => {
    const slide = { tipo: "p_slide_2_graficos", payload: { meta: { dependencia: { de: "izquierda", habilita: ["Sí"], frase: " que trabajan " } } } };
    expect(dependenciaDe(slide as never)).toEqual({ de: "izquierda", a: "derecha", habilita: ["Sí"], frase: "que trabajan" });
    const suelta = { tipo: "p_slide_2_graficos_vertical", payload: { meta: { dependencia: { de: "superior", habilita: "Sí" } } } };
    expect(dependenciaDe(suelta as never)?.habilita).toEqual(["Sí"]);
    const sin = { tipo: "p_slide_2_graficos", payload: { meta: { dependencia: { de: "izquierda", habilita: ["Sí"], frase: "  " } } } };
    expect(dependenciaDe(sin as never)).toEqual({ de: "izquierda", a: "derecha", habilita: ["Sí"] });
  });
});

describe("quiénes forman la base por defecto", () => {
  it("une como la lámina: «o» con dos, comas con tres o más", async () => {
    const { quienesPorDefecto } = await import("../DependenciaLamina");
    expect(quienesPorDefecto(["Sí"])).toBe("que respondieron “Sí”");
    expect(quienesPorDefecto(["A", "B"])).toBe("que respondieron “A” o “B”");
    expect(quienesPorDefecto(["A", "B", "C"])).toBe("que respondieron “A”, “B”, “C”");
  });
});
