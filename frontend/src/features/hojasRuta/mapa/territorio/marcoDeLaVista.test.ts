import { describe, expect, it } from "vitest";

import type { HojasRutaTerritory, TerritorialFrameMeta } from "../../../../api/hojasRuta";
import { marcoDeLaVista, unoPorProvincia } from "./marcoDeLaVista";

const META = { ok: true, coverage: "Lima Metropolitana, Callao y ciudades principales", n_distritos: 164, n_manzanas: 207891, viviendas: 4407689, poblacion: 15366674, year: 2017 } as unknown as TerritorialFrameMeta;
const t = (ubigeo: string, manzanas: number, viviendas: number, poblacion: number) => ({ ubigeo, manzanas, viviendas, poblacion, departamento: "", provincia: "", distrito: ubigeo }) as HojasRutaTerritory;
const TERR = [t("080101", 1319, 20000, 90000), t("080108", 496, 11000, 34000), t("150103", 8916, 140000, 552000), t("070101", 4000, 120000, 400000)];

describe("el Marco territorial habla de lo que se mira", () => {
  it("con una ciudad abierta, sus distritos, sus cifras y su cartografía; sin la comparación de Lima", () => {
    const f = marcoDeLaVista(META, TERR, { nombre: "Cusco", ubigeos: ["080101", "080108"] });
    expect(f.cobertura).toBe("Cusco · 2 distritos");
    expect([f.manzanas, f.viviendas, f.poblacion]).toEqual([1815, 31000, 124000]);
    expect(f.ubigeosCartografia).toEqual(["080101"]);
    expect(f.conComparacion).toBe(false);
  });

  it("Lima trae al Callao: dos provincias de cartografía y la comparación con la oficial", () => {
    const f = marcoDeLaVista(META, TERR, { nombre: "Lima y Callao", ubigeos: ["150103", "070101"] });
    expect(f.ubigeosCartografia).toEqual(["070101", "150103"]);
    expect(f.conComparacion).toBe(true);
  });

  it("sin ciudad es el catálogo, y se rotula como tal", () => {
    const f = marcoDeLaVista(META, TERR, null);
    expect(f.rotuloCobertura).toBe("Catálogo");
    expect(f.rotuloCifras).toBe("En el catálogo");
    expect(f.cobertura).toBe("Lima Metropolitana, Callao y ciudades principales · 164 distritos");
    expect(f.ubigeosCartografia).toEqual([]);
  });

  it("un ubigeo por provincia", () => {
    expect(unoPorProvincia(["150103", "150101", "070101"])).toEqual(["070101", "150103"]);
  });
});
