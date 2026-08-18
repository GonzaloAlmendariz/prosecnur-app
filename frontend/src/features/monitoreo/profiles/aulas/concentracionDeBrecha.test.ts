import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { concentracionDeBrecha } from "./concentracionDeBrecha";

const fila = (brecha: number) => ({ brecha } as unknown as MonitoreoRow);

describe("concentracionDeBrecha", () => {
  it("dice cuántas aulas cubren la mitad de lo que falta", () => {
    // 100 + 100 = 200 de 400: dos aulas cubren la mitad exacta.
    const r = concentracionDeBrecha([fila(100), fila(100), fila(100), fila(100)]);
    expect(r.falta).toBe(400);
    expect(r.aulasParaLaMitad).toBe(2);
  });

  it("distingue una brecha concentrada de una repartida", () => {
    const concentrada = concentracionDeBrecha([fila(90), ...Array(20).fill(0).map(() => fila(1))]);
    const repartida = concentracionDeBrecha(Array(21).fill(0).map(() => fila(10)));
    // Una aula cubre casi todo en la concentrada; en la repartida hacen falta 11.
    expect(concentrada.aulasParaLaMitad).toBe(1);
    expect(repartida.aulasParaLaMitad).toBe(11);
  });

  it("no cuenta las aulas sin brecha", () => {
    const r = concentracionDeBrecha([fila(10), fila(0), fila(5)]);
    expect(r.aulas).toBe(2);
    expect(r.falta).toBe(15);
  });

  it("sin brecha devuelve vacío en vez de dividir entre cero", () => {
    const r = concentracionDeBrecha([fila(0), fila(0)]);
    expect(r.falta).toBe(0);
    expect(r.tramos).toEqual([]);
  });
});
