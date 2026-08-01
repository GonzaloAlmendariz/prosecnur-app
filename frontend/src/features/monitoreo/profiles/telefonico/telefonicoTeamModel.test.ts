import { describe, expect, it } from "vitest";

import { buildTelefonicoStatusMatrix } from "./telefonicoTeamModel";

// La matriz agrupaba por actor × responsable y solo pintaba el responsable, así
// que cada encuestador aparecía una vez por componente sin decirlo. En el PDM
// Medios de Vida los cuatro salían ocho veces, y las filas del componente chico
// (6–7 casos) se rotulaban «poco volumen» como si tuvieran poca carga.
//
// Los datos son los del estudio real, que su propia tabla dinámica resume así:
//   Jorge 40 + 6 = 46 · Katherine 39 + 6 = 45 · Mary 39 + 7 = 46 · Silbia 39 + 7 = 46

const filasMedVida = [
  { Actor: "Homologación Laboral", Responsable: "Jorge Del Solar", Estado: "No barrido", Casos: 40 },
  { Actor: "Homologación Laboral", Responsable: "Katherine Colan", Estado: "No barrido", Casos: 39 },
  { Actor: "Homologación Laboral", Responsable: "Mary Berrocal", Estado: "No barrido", Casos: 39 },
  { Actor: "Homologación Laboral", Responsable: "Silbia Cruzado", Estado: "No barrido", Casos: 39 },
  { Actor: "Vinculación Laboral", Responsable: "Jorge Del Solar", Estado: "No barrido", Casos: 6 },
  { Actor: "Vinculación Laboral", Responsable: "Katherine Colan", Estado: "No barrido", Casos: 6 },
  { Actor: "Vinculación Laboral", Responsable: "Mary Berrocal", Estado: "No barrido", Casos: 7 },
  { Actor: "Vinculación Laboral", Responsable: "Silbia Cruzado", Estado: "No barrido", Casos: 7 },
];

describe("buildTelefonicoStatusMatrix", () => {
  it("una persona es una fila, aunque cubra varios componentes", () => {
    const matrix = buildTelefonicoStatusMatrix(filasMedVida);

    expect(matrix.responsables).toHaveLength(4);
    expect(matrix.responsables.map((row) => row.responsable).sort()).toEqual([
      "Jorge Del Solar", "Katherine Colan", "Mary Berrocal", "Silbia Cruzado",
    ]);
  });

  it("suma las dos cargas de cada persona", () => {
    const matrix = buildTelefonicoStatusMatrix(filasMedVida);
    const total = (nombre: string) => matrix.responsables.find((row) => row.responsable === nombre)?.total;

    expect(total("Jorge Del Solar")).toBe(46);
    expect(total("Katherine Colan")).toBe(45);
    expect(total("Mary Berrocal")).toBe(46);
    expect(total("Silbia Cruzado")).toBe(46);
    expect(matrix.total).toBe(183);
  });

  it("nadie cae bajo el mínimo de comparación por partirse en dos", () => {
    // Era el efecto visible: cuatro filas rotuladas «poco volumen» con 6 y 7
    // casos, cuando la carga real de esas personas supera el mínimo.
    const matrix = buildTelefonicoStatusMatrix(filasMedVida);
    expect(matrix.responsables.every((row) => row.total >= matrix.minimoParaComparar)).toBe(true);
  });

  it("quien cubre varios componentes no queda etiquetado con uno", () => {
    const matrix = buildTelefonicoStatusMatrix(filasMedVida);
    expect(matrix.responsables.every((row) => row.actor === "")).toBe(true);
  });

  it("con un solo componente la etiqueta de actor se conserva", () => {
    const matrix = buildTelefonicoStatusMatrix([
      { Actor: "Homologación Laboral", Responsable: "Jorge Del Solar", Estado: "No barrido", Casos: 40 },
    ]);
    expect(matrix.responsables[0].actor).toBe("Homologación Laboral");
  });

  it("los estados se suman a través de los componentes", () => {
    const matrix = buildTelefonicoStatusMatrix([
      { Actor: "A", Responsable: "Jorge", Estado: "Efectivo", Casos: 10 },
      { Actor: "B", Responsable: "Jorge", Estado: "Efectivo", Casos: 5 },
      { Actor: "B", Responsable: "Jorge", Estado: "Rechazo", Casos: 3 },
    ]);

    const jorge = matrix.responsables[0];
    expect(jorge.total).toBe(18);
    expect(jorge.celdas.find((cell) => cell.estado === "Efectivo")?.casos).toBe(15);
    expect(jorge.celdas.find((cell) => cell.estado === "Rechazo")?.casos).toBe(3);
  });
});
