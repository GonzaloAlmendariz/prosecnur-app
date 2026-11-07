// Mata: un nivel fuera de su lista, un peso que no se respeta, un condicional que aparece sin su condición, un orden
// de atributos que cambia entre tareas del mismo encuestado o se repite dentro de una tarea, una tabla que cita
// variables inexistentes y un diseño inválido que genera filas igual. El oráculo es el evaluador de «Probar».
import { describe, expect, it } from "vitest";
import { calcularValores } from "../shell/simulador/calculosPrueba";
import type { BuilderNode } from "../types";
import { type DisenoConjoint, SIN_NIVEL, generarConjoint, literal, validarDiseno, variableNivel } from "./modeloConjoint";

// Conjoint sintético: un vehículo con formación ponderada y dos atributos que sólo existen si hay motor.
const diseno: DisenoConjoint = {
  prefijo: "cj",
  tareas: 3,
  rotulosPerfil: ["Opción A", "Opción B"],
  pregunta: "¿Cuál prefiere?",
  intro: "Compare estas dos opciones.",
  atributos: [
    { clave: "motor", rotulo: "Motor", niveles: [{ codigo: "ninguno", texto: "Ninguno", peso: 0.2 }, { codigo: "gas", texto: "A gasolina", peso: 0.3 }, { codigo: "elec", texto: "Eléctrico", peso: 0.5 }] },
    { clave: "potencia", rotulo: "Potencia", niveles: [{ codigo: "baja", texto: "Baja" }, { codigo: "alta", texto: "Alta" }], soloSi: { atributo: "motor", noEs: ["ninguno"] } },
    { clave: "color", rotulo: "Color", niveles: [{ codigo: "rojo", texto: "Rojo" }, { codigo: "azul", texto: "Azul" }, { codigo: "verde", texto: "Verde de l'atelier" }] },
  ],
};

function nodos(d: DisenoConjoint): BuilderNode[] {
  return generarConjoint(d).survey.map((f, i) => ({
    ...f,
    rowIndex: i + 1,
    kind: f.type === "calculate" ? "calculate" : f.type === "note" ? "note" : "question",
    relevant: "",
    typeInfo: { raw: f.type, base: f.type.split(" ")[0]!, listName: f.type.split(" ")[1] ?? "" },
  })) as unknown as BuilderNode[];
}

describe("generar un conjoint", () => {
  it("cada perfil sale con niveles de su lista y el condicional respeta su condición", () => {
    const n = nodos(diseno);
    for (let s = 0; s < 300; s += 1) {
      const v = calcularValores(n, {}, s);
      for (let t = 1; t <= 3; t += 1) {
        for (const p of ["A", "B"] as const) {
          const motor = v[variableNivel(diseno, t, p, "motor")]!;
          const potencia = v[variableNivel(diseno, t, p, "potencia")]!;
          expect(["ninguno", "gas", "elec"]).toContain(motor);
          expect(potencia === "NA").toBe(motor === "ninguno");
          expect(v[`${variableNivel(diseno, t, p, "potencia")}_txt`]).toBe(potencia === "NA" ? SIN_NIVEL : potencia === "baja" ? "Baja" : "Alta");
        }
      }
    }
  });

  it("los pesos 20/30/50 se cumplen en muchas entrevistas", () => {
    const n = nodos(diseno);
    const cuenta: Record<string, number> = { ninguno: 0, gas: 0, elec: 0 };
    for (let s = 0; s < 3000; s += 1) cuenta[calcularValores(n, {}, s)[variableNivel(diseno, 1, "A", "motor")]!]! += 1;
    expect(cuenta.ninguno! / 3000).toBeGreaterThan(0.17);
    expect(cuenta.ninguno! / 3000).toBeLessThan(0.23);
    expect(cuenta.elec! / 3000).toBeGreaterThan(0.46);
  }, 20_000); // 3000 entrevistas simuladas: con la máquina cargada pasa de los 5 s por defecto.

  it("con orden aleatorio cada fila muestra un atributo distinto y el orden es el mismo en todas las tareas", () => {
    const d = { ...diseno, ordenAleatorio: true };
    const n = nodos(d);
    const ordenes = new Set<string>();
    for (let s = 0; s < 60; s += 1) {
      const v = calcularValores(n, {}, s);
      const orden = [1, 2, 3].map((k) => v[`cj_fila${k}`]);
      expect(new Set(orden).size).toBe(3);
      ordenes.add(orden.join(","));
      for (const t of [1, 2, 3]) {
        const k = orden.indexOf("color") + 1;
        expect(v[`cj_t${t}A_celda${k}`]).toBe(v[`${variableNivel(d, t, "A", "color")}_txt`]);
      }
    }
    expect(ordenes.size).toBeGreaterThan(1);
  });

  it("la tabla de cada tarea sólo cita variables que existen y la elección es obligatoria", () => {
    for (const ordenAleatorio of [false, true]) {
      const { survey, choices } = generarConjoint({ ...diseno, ordenAleatorio });
      const nombres = new Set(survey.map((f) => f.name));
      const tablas = survey.filter((f) => f.name.endsWith("_tabla"));
      expect(tablas).toHaveLength(3);
      for (const t of tablas) for (const m of t.label.matchAll(/\$\{([^}]+)\}/g)) expect(nombres.has(m[1]!)).toBe(true);
      expect(survey.filter((f) => f.name.endsWith("_eleccion")).every((f) => f.required === "yes" && f.type === "select_one cj_perfil")).toBe(true);
      expect(choices.map((c) => c.label)).toEqual(["Opción A", "Opción B"]);
    }
  });

  it("un diseño inválido se explica y no genera filas", () => {
    const malo: DisenoConjoint = {
      ...diseno,
      prefijo: "1 malo",
      atributos: [
        { clave: "a", rotulo: "A", niveles: [{ codigo: "x", texto: "X", peso: 0.4 }, { codigo: "y", texto: "Y", peso: 0.4 }] },
        { clave: "b", rotulo: "B", niveles: [{ codigo: "z", texto: "Z" }, { codigo: "w", texto: "W" }], soloSi: { atributo: "c", noEs: ["q"] } },
      ],
    };
    const problemas = validarDiseno(malo);
    expect(problemas.join(" ")).toMatch(/prefijo/);
    expect(problemas.join(" ")).toMatch(/sumar 1/);
    expect(problemas.join(" ")).toMatch(/debe ir antes/);
    expect(() => generarConjoint(malo)).toThrow();
  });

  it("un texto con apóstrofo no rompe la fórmula", () => {
    expect(literal("l'atelier")).toBe(`"l'atelier"`);
    expect(literal(`dijo "l'a"`)).toBe("'dijo \"l’a\"'");
  });
});
