// X5: el orden de la lámina se ve («1», «2»…) y se cambia con Subir y Bajar; con dos grupos decide la diferencia.
import { describe, expect, it } from "vitest";
import { filasEnOrdenDeLamina, filasGrupos, incluidosEnOrden, moverGrupo, textoDiferencia } from "./modeloGruposPadron";

const OPCIONES = [{ codigo: "1", etiqueta: "TC" }, { codigo: "2", etiqueta: "TP" }, { codigo: "3", etiqueta: "Contratado" }];

describe("moverGrupo", () => {
  it("intercambia con el vecino; en el borde o fuera de la lámina no cambia nada", () => {
    const args = { grupos: ["2", "1", "3"] };
    expect(moverGrupo(args, "1", -1)).toEqual({ grupos: ["1", "2", "3"] });
    expect(moverGrupo(args, "1", 1)).toEqual({ grupos: ["2", "3", "1"] });
    expect(moverGrupo(args, "2", -1)).toEqual({ grupos: ["2", "1", "3"] });
    expect(moverGrupo(args, "3", 1)).toEqual({ grupos: ["2", "1", "3"] });
    expect(moverGrupo({ grupos: ["1"] }, "2", -1)).toEqual({ grupos: ["1"] });
  });

  it("la posición de cada fila es su lugar en la lámina, no en el instrumento", () => {
    const args = { grupos: ["3", "1"] };
    expect(filasGrupos(OPCIONES, null, args).map((f) => f.posicion)).toEqual([2, null, 1]);
  });
});

describe("textoDiferencia", () => {
  it("con dos, el primero menos el segundo; con más, el mayor menos el menor; con uno, nada", () => {
    const dos = { grupos: ["2", "1"] };
    expect(textoDiferencia(incluidosEnOrden(filasGrupos(OPCIONES, null, dos), dos))).toBe("Diferencia: TP menos TC");
    const invertido = { ...dos, ...moverGrupo(dos, "1", -1) };
    expect(textoDiferencia(incluidosEnOrden(filasGrupos(OPCIONES, null, invertido), invertido))).toBe("Diferencia: TC menos TP");
    const tres = { grupos: ["1", "2", "3"] };
    expect(textoDiferencia(incluidosEnOrden(filasGrupos(OPCIONES, null, tres), tres))).toBe("Diferencia: el mayor menos el menor");
    expect(textoDiferencia(incluidosEnOrden(filasGrupos(OPCIONES, null, { grupos: ["1"] }), { grupos: ["1"] }))).toBeNull();
  });
});

describe("R8-4: las filas se ven en el orden de la lámina", () => {
  it("primero las incluidas en el orden de `grupos`; después las de fuera, en el del instrumento", () => {
    const args = { grupos: ["3", "1"] };
    expect(filasEnOrdenDeLamina(filasGrupos(OPCIONES, null, args), args).map((f) => f.codigo)).toEqual(["3", "1", "2"]);
    const subido = { ...args, ...moverGrupo(args, "1", -1) };
    expect(filasEnOrdenDeLamina(filasGrupos(OPCIONES, null, subido), subido).map((f) => f.codigo)).toEqual(["1", "3", "2"]);
  });
});
