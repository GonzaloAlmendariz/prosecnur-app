import { describe, expect, it } from "vitest";

import type { HojasRutaWorkspaceOutputs } from "../../../api/hojasRuta";
import { salidasSanas } from "./salidasSanas";

const con = (sample: unknown) => ({ sample } as unknown as HojasRutaWorkspaceOutputs);

describe("salidasSanas", () => {
  it("una muestra vaciada ({} desde R) se lee como que no hay muestra", () => {
    expect(salidasSanas(con({}))?.sample).toBeNull();
  });
  it("una muestra con titulares y sin reemplazos lee los reemplazos vacíos", () => {
    expect(salidasSanas(con({ blocks: [{ id_manzana: "1" }] }))?.sample?.replacement_blocks).toEqual([]);
  });
  it("lo sano pasa tal cual, y sin salidas no inventa nada", () => {
    const sana = con({ blocks: [], replacement_blocks: [] });
    expect(salidasSanas(sana)).toBe(sana);
    expect(salidasSanas(undefined)).toBeUndefined();
  });
});
