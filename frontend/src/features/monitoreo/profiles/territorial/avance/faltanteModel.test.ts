import { describe, expect, it } from "vitest";
import { construirFaltante, filtrarFilas, saldoDeSubsanaciones, textoDeQuienCubre } from "./faltanteModel";
import { CORTE_DE_CUOTAS } from "./fixtures/corteDeCuotas";

describe("Avance › Faltante por UMP", () => {
  const modelo = construirFaltante(CORTE_DE_CUOTAS);

  it("una fila por UMP, con su manzana en uso, y las pendientes primero", () => {
    expect(modelo.filas.map((fila) => fila.ump)).toEqual(["143", "7", "35"]);
    expect(modelo.filas[0]).toMatchObject({ estado: "pendiente", manzana: "0590", reemplazo: false, falta: 1, aplicador: "P132 · Aplicadora de Prueba" });
    expect(modelo.filas[1]).toMatchObject({ estado: "subsanada", reemplazo: true, distrito: "Ate" });
  });

  it("separa la falta de la manzana en uso de las celdas en manzanas que la UMP ya no usa", () => {
    expect(modelo.pendientes.map((fila) => fila.ump)).toEqual(["143"]);
    expect(modelo.pendientes[0].faltantes).toEqual([{ texto: "30 a 44 años", falta: 1 }]);
    expect(modelo.celdasFueraDeUso).toBe(1);
  });

  it("dice quién cubre la falta con la sugerencia del motor", () => {
    expect(textoDeQuienCubre(modelo.pendientes[0].cubre)).toBe("UMP 142, a 0.45 km");
    expect(textoDeQuienCubre(modelo.filas[2].cubre)).toBe("—");
  });

  it("conserva el signo de lo subsanado por celda y el saldo de la UMP", () => {
    const edad4559 = modelo.filas[0].celdas.find((celda) => celda.clave === "45-59");
    expect(edad4559).toMatchObject({ rotulo: "45 a 59", logrado: 3, meta: 2, delta: 1, falta: 0 });
    expect(saldoDeSubsanaciones(modelo.filas[0])).toBe("+1");
    expect(saldoDeSubsanaciones(modelo.filas[2])).toBe("—");
  });

  it("las otras manzanas de la UMP quedan en su detalle", () => {
    expect(modelo.filas[0].otras.map((otra) => otra.id_manzana)).toEqual(["150135063000600"]);
  });

  it("el mapa de calor rotula distritos y tramos, y declara su base", () => {
    expect(modelo.distritos.map((fila) => fila.distrito)).toEqual(["San Martín de Porres", "San Juan de Lurigancho"]);
    expect(modelo.columnas.map((columna) => columna.rotulo)).toEqual(["Hombre", "Mujer", "18 a 29", "30 a 44", "45 a 59", "60 o más"]);
    expect(modelo.casosConSexoYEdad).toBe(111 + 112 + 104 + 104);
  });

  it("filtra por estado y por manzana de reemplazo", () => {
    expect(filtrarFilas(modelo.filas, "pendientes", true).map((fila) => fila.ump)).toEqual(["143"]);
    expect(filtrarFilas(modelo.filas, "subsanadas", true).map((fila) => fila.ump)).toEqual(["7"]);
    expect(filtrarFilas(modelo.filas, "todas", false).map((fila) => fila.ump)).toEqual(["143", "35"]);
  });

  it("un corte que no calculó subsanaciones no afirma «sin excedente»", () => {
    const sinAjustes = construirFaltante({
      ...CORTE_DE_CUOTAS,
      operational_adjustments: { schema: "monitoreo_territorial_operational_adjustments_v1", reason: "scope_sin_subsanaciones", deficits: [], suggestions: [] },
    } as typeof CORTE_DE_CUOTAS);
    const pendiente = sinAjustes.filas.find((fila) => fila.ump === "143");
    expect(pendiente?.falta).toBe(1);
    expect(pendiente?.cubre).toBeNull();
  });

  it("sin cuota configurada no inventa filas", () => {
    expect(construirFaltante(null).configurado).toBe(false);
  });
});
