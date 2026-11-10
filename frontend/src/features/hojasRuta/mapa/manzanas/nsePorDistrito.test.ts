import { describe, expect, it } from "vitest";
import { nsePorDistrito } from "./nsePorDistrito";

describe("UMP titulares por NSE y distrito", () => {
  it("cuenta cada manzana en su nivel y deja fuera de rango como sin dato", () => {
    const out = nsePorDistrito([
      { ubigeo: "150103", nse: 3 },
      { ubigeo: "150103", nse: 3 },
      { ubigeo: "150103", nse: 5 },
      { ubigeo: "150132", nse: 0 },
      { ubigeo: "150132", nse: 9 },
    ]);
    expect(out.get("150103")).toEqual([0, 0, 0, 2, 0, 1]);
    expect(out.get("150132")).toEqual([2, 0, 0, 0, 0, 0]);
  });
});
