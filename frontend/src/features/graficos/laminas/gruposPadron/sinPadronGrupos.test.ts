// X5: los grupos incluidos sin padrón se nombran (su base va sólo con n) y la base del cruce se lee de la pregunta.
import { describe, expect, it } from "vitest";
import { baseDeCruce, filasGrupos, gruposSinPadron, incluidosEnOrden, textoSinPadron } from "./modeloGruposPadron";

const OPCIONES = [{ codigo: "1", etiqueta: "TC" }, { codigo: "2", etiqueta: "TP" }, { codigo: "3", etiqueta: "Contratado" }];

describe("gruposSinPadron", () => {
  it("en el orden de la lámina, sólo los incluidos sin padrón escrito", () => {
    const args = { grupos: ["3", "1", "2"], universos: "TP: 103", universos_no_confiables: "Contratado: 150" };
    const inc = incluidosEnOrden(filasGrupos(OPCIONES, null, args), args);
    expect(gruposSinPadron(inc)).toEqual(["TC"]);
    expect(textoSinPadron(["TC", "TP"])).toBe("Sin padrón: TC, TP. La base va sólo con n.");
    expect(textoSinPadron([])).toBeNull();
  });

  it("la base del cruce", () => {
    expect(baseDeCruce("docentes$dedicacion")).toBe("docentes");
    expect(baseDeCruce("dedicacion")).toBe("");
  });
});
