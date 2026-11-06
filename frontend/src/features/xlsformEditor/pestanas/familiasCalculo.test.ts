// Mata: una familia que mezcla atributos distintos, una que se arma con dos miembros, un cálculo suelto que se pierde
// y un orden que cambia.
import { describe, expect, it } from "vitest";
import { agruparEnFamilias, claveFamilia, tituloFamilia } from "./familiasCalculo";
import { pistaDistinta, valorLegible } from "./PestanaCalculos";

describe("familias de cálculos", () => {
  it("la tarea y el perfil se vuelven t#P y los números #", () => {
    expect(claveFamilia("t12B_curso_txt")).toBe("t#P_curso_txt");
    expect(claveFamilia("cj_t1A_edad_r")).toBe("cj_t#P_edad_r");
    expect(claveFamilia("fila3_rot")).toBe("fila#_rot");
    expect(claveFamilia("total")).toBe("total");
  });

  it("agrupa desde cuatro miembros, en el lugar del primero, y deja los sueltos", () => {
    const nombres = ["inicio", "t1A_x", "t1B_x", "t2A_x", "t2B_x", "t1A_y", "t1B_y", "fin"];
    const g = agruparEnFamilias(nombres, (n) => n);
    expect(g.map((x) => (x.tipo === "familia" ? `${x.clave}×${x.items.length}` : x.item))).toEqual(["inicio", "t#P_x×4", "t1A_y", "t1B_y", "fin"]);
  });
});

describe("valor de ejemplo legible", () => {
  it("redondea un número al azar y deja lo demás", () => {
    expect(valorLegible("0.231999499")).toBe("0.232");
    expect(valorLegible("42")).toBe("42");
    expect(valorLegible("Realizado en el Perú")).toBe("Realizado en el Perú");
  });
});

describe("código y etiqueta en los tokens", () => {
  it("no repite el código como etiqueta", () => {
    expect(pistaDistinta("t1A_r_curso", "t1A_r_curso")).toBeUndefined();
    expect(pistaDistinta("", "edad")).toBeUndefined();
    expect(pistaDistinta("Edad del encuestado", "edad")).toBe("Edad del encuestado");
  });
});

describe("título de una familia", () => {
  it("sin el patrón t#P ni los #", () => {
    expect(tituloFamilia("cj_t#P_edad_r")).toBe("edad_r, en cada tarea y perfil");
    expect(tituloFamilia("p#_monto")).toBe("p…_monto");
  });
});
