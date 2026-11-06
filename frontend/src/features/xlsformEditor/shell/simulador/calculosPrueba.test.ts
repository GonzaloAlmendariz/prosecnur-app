// Mata: un sorteo que cambia en cada render, que no cambia al reiniciar, un nivel que no respeta su peso, un atributo
// condicional que aparece sin su condición y un cálculo que cita a otro de más abajo y queda vacío.
import { describe, expect, it } from "vitest";
import type { BuilderNode } from "../../types";
import { azarSembrado, calcularValores } from "./calculosPrueba";

let fila = 0;
const calc = (name: string, calculation: string) =>
  ({ name, kind: "calculate", rowIndex: ++fila, calculation, label: "", relevant: "", typeInfo: { raw: "calculate", base: "calculate", listName: "" } }) as unknown as BuilderNode;

// Conjoint sintético: un perfil con «color» (3 niveles por int(r * 3)), «tamaño» ponderado 20/80 y «borde» que sólo
// existe cuando el color no es «ninguno».
const perfil = [
  calc("r_color", "once(random())"),
  calc("r_tam", "once(random())"),
  calc("r_borde", "once(random())"),
  calc("color", "if(int(${r_color} * 3) = 0, 'ninguno', if(int(${r_color} * 3) = 1, 'rojo', 'azul'))"),
  calc("tam", "if(${r_tam} < 0.2, 'chico', 'grande')"),
  calc("borde", "if(${color} = 'ninguno', 'NA', if(int(${r_borde} * 2) = 0, 'fino', 'grueso'))"),
  calc("color_txt", "if(${color} = 'rojo', 'Rojo', if(${color} = 'azul', 'Azul', 'Sin color'))"),
];

describe("cálculos en Probar", () => {
  it("una misma semilla da el mismo sorteo; otra semilla, otro", () => {
    const a = calcularValores(perfil, {}, 7);
    expect(calcularValores(perfil, {}, 7)).toEqual(a);
    const distintos = [1, 2, 3, 4, 5, 6, 8, 9].some((s) => calcularValores(perfil, {}, s).r_color !== a.r_color);
    expect(distintos).toBe(true);
  });

  it("los niveles salen de int(r * k) y la condición se respeta", () => {
    for (let s = 0; s < 200; s += 1) {
      const v = calcularValores(perfil, {}, s);
      expect(["ninguno", "rojo", "azul"]).toContain(v.color);
      expect(v.borde === "NA").toBe(v.color === "ninguno");
      expect(v.color_txt).toBe({ ninguno: "Sin color", rojo: "Rojo", azul: "Azul" }[v.color!]);
    }
  });

  it("el peso 20/80 se cumple en una muestra grande de pruebas", () => {
    let chicos = 0;
    for (let s = 0; s < 4000; s += 1) if (calcularValores(perfil, {}, s).tam === "chico") chicos += 1;
    expect(chicos / 4000).toBeGreaterThan(0.17);
    expect(chicos / 4000).toBeLessThan(0.23);
  });

  it("un cálculo que cita a otro de más abajo se resuelve igual", () => {
    const desordenado = [calc("txt", "if(${base} = 'x', 'Equis', 'Otro')"), calc("base", "'x'")];
    expect(calcularValores(desordenado, {}, 1).txt).toBe("Equis");
  });

  it("usa las respuestas dadas y deja fuera lo que no evalúa", () => {
    const nodos = [calc("doble", "${edad} * 2"), calc("raro", "pulldata('a', 'b', 'c', 'd')")];
    const v = calcularValores(nodos, { edad: "21" }, 1);
    expect(v.doble).toBe("42");
    expect(v).not.toHaveProperty("raro");
  });

  it("dos random() en la misma fórmula no dan el mismo número", () => {
    expect(azarSembrado(3, "x", 0)).not.toBe(azarSembrado(3, "x", 1));
  });
});
