import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../../api/graficos";
import { contenidoDeLamina } from "./contenidoLamina";

const arg = (name: string, tipo_input: ArgMetadata["tipo_input"], grupo: ArgMetadata["grupo"] = "textos"): ArgMetadata =>
  ({ name, label: name.toUpperCase(), tipo_input, grupo });

describe("contenidoDeLamina", () => {
  it("lista los textos simples con el título primero y excluye ranuras y meta", () => {
    const c = contenidoDeLamina([
      arg("base", "string"), arg("titulo", "string"), arg("pie", "textarea"),
      arg("grafico", "variable", "datos"), arg("meta", "meta"), arg("size_titulo", "number", "estilo"),
    ], ["grafico"]);
    expect(c.campos.map((x) => x.name)).toEqual(["titulo", "base", "pie"]);
    expect(c.campos[2].multilinea).toBe(true);
    expect(c.pendientes).toEqual([]);
  });

  it("nombra lo que sigue en el editor anterior y garantiza el título", () => {
    const c = contenidoDeLamina([arg("filas", "technical_rows", "datos"), arg("icono", "icono")], []);
    expect(c.campos.map((x) => x.name)).toEqual(["titulo"]);
    expect(c.pendientes).toEqual(["FILAS", "ICONO"]);
  });

  it("no ofrece args de estilo aunque sean texto", () => {
    const c = contenidoDeLamina([arg("font_family", "string", "estilo")], []);
    expect(c.campos.map((x) => x.name)).toEqual(["titulo"]);
  });
});
