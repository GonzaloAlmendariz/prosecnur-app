// Mata: una entrada del conjoint que no se encuentra buscando «conjoint» o «experimento», que cae en una familia que
// no es Estructura o que inserta una fila en vez de abrir el panel.
import { describe, expect, it, vi } from "vitest";
import { describeAddMenuItem, normalizeAddMenuSearch } from "../shell/AddElementMenu";
import { agruparAlta } from "../shell/familiasAlta";
import { itemAltaConjoint } from "./altaConjoint";

describe("entrada del conjoint en «Añadir pieza»", () => {
  const abrir = vi.fn();
  const item = itemAltaConjoint(abrir);
  const busca = (q: string) =>
    normalizeAddMenuSearch([item.label, item.hint, describeAddMenuItem(item).tag, ...describeAddMenuItem(item).searchTerms].join(" ")).includes(normalizeAddMenuSearch(q));

  it("se encuentra por conjoint, experimento y elección", () => {
    expect(busca("conjoint")).toBe(true);
    expect(busca("experimento")).toBe(true);
    expect(busca("elección")).toBe(true);
  });

  it("va con la Estructura y abre el panel", () => {
    expect(agruparAlta([item]).map((g) => g.nombre)).toEqual(["Estructura"]);
    item.action();
    expect(abrir).toHaveBeenCalledTimes(1);
  });
});
