import { describe, expect, it } from "vitest";

import { PROCESAMIENTO_PESTANAS } from "../../lib/navegacion/catalogos/procesamiento";
import { ALIAS_PESTANAS_ANALITICA, pestanaPedidaAnalitica } from "./pestanaAnalitica";

describe("pestanaPedidaAnalitica (ADR 0144)", () => {
  it("abre Entrega con su entregable cuando la dirección trae una clave retirada", () => {
    expect(pestanaPedidaAnalitica("?pestana=base_final")).toEqual({ pestana: "entrega", foco: "base-final" });
    expect(pestanaPedidaAnalitica("?pestana=base-final")).toEqual({ pestana: "entrega", foco: "base-final" });
    expect(pestanaPedidaAnalitica("?pestana=bases")).toEqual({ pestana: "entrega", foco: "base-final" });
    expect(pestanaPedidaAnalitica("?pestana=codebook")).toEqual({ pestana: "entrega", foco: "libro" });
    expect(pestanaPedidaAnalitica("?pestana=ficha")).toEqual({ pestana: "entrega", foco: "ficha" });
  });

  it("lee el parámetro viejo `reporte` igual que `pestana`", () => {
    expect(pestanaPedidaAnalitica("?reporte=codebook")).toEqual({ pestana: "entrega", foco: "libro" });
    expect(pestanaPedidaAnalitica("?reporte=cruces")).toEqual({ pestana: "cruces", foco: null });
  });

  it("deja pasar las claves vigentes y la dirección sin pestaña", () => {
    expect(pestanaPedidaAnalitica("?pestana=entrega&foco=ficha")).toEqual({ pestana: "entrega", foco: null });
    expect(pestanaPedidaAnalitica("")).toEqual({ pestana: null, foco: null });
  });

  it("ningún alias nombra una pestaña que siga en el catálogo", () => {
    const vigentes = new Set<string>(PROCESAMIENTO_PESTANAS.analitica.map((tab) => tab.key));
    for (const vieja of Object.keys(ALIAS_PESTANAS_ANALITICA)) expect(vigentes.has(vieja), vieja).toBe(false);
  });
});
