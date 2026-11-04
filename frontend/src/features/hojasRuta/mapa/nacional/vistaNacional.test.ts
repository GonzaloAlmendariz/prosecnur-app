import { describe, expect, it } from "vitest";
import { CIUDADES, ciudadesDelAtlas } from "../territorio/ciudades";
import { cajaNacional, ciudadesConDistritos, cifrasPorCiudad, departamentosDelEstudio, nivelDelMapa } from "./vistaNacional";

const atlas = ciudadesDelAtlas([]);
const lima = CIUDADES.find((c) => c.codigo === "lima")!;
const otra = CIUDADES.find((c) => c.codigo !== "lima" && c.ubigeos.length > 1)!;
const uLima = lima.ubigeos[0];
const uOtra = otra.ubigeos[0];

describe("vista nacional del mapa", () => {
  it("lista las ciudades de los distritos confirmados, sin repetir", () => {
    expect(ciudadesConDistritos([uLima, lima.ubigeos[1], uOtra], atlas).sort()).toEqual(["lima", otra.codigo].sort());
  });

  it("sólo hay nivel nacional en las cuatro secciones y con dos o más ciudades", () => {
    const base = { ciudades: ["lima", otra.codigo], ciudad: null, distrito: null, confirmados: [uLima, uOtra] };
    expect(nivelDelMapa({ ...base, seccion: "muestra" })).toEqual({ nivel: "nacional" });
    expect(nivelDelMapa({ ...base, seccion: "territorio" })).toBeNull();
    expect(nivelDelMapa({ ...base, seccion: "muestra", ciudades: ["lima"] })).toBeNull();
  });

  it("baja a la ciudad y al distrito; una ciudad o un distrito ajenos no cuentan", () => {
    const base = { seccion: "poblacion", ciudades: ["lima", otra.codigo], confirmados: [uLima, uOtra] };
    expect(nivelDelMapa({ ...base, ciudad: otra.codigo, distrito: null })).toEqual({ nivel: "ciudad", ciudad: otra.codigo });
    expect(nivelDelMapa({ ...base, ciudad: otra.codigo, distrito: uOtra })).toEqual({ nivel: "distrito", ciudad: otra.codigo, distrito: uOtra });
    // El distrito enfocado es de Lima: mirando la otra ciudad no se baja a él.
    expect(nivelDelMapa({ ...base, ciudad: otra.codigo, distrito: uLima })).toEqual({ nivel: "ciudad", ciudad: otra.codigo });
    // Una ciudad sin distritos en el estudio (enlace viejo) cae al Perú.
    expect(nivelDelMapa({ ...base, ciudad: "9999", distrito: null })).toEqual({ nivel: "nacional" });
  });

  it("Lima y Callao aporta dos departamentos y el encuadre los incluye", () => {
    expect(departamentosDelEstudio(atlas, ["lima"]).sort()).toEqual(["callao", "lima"]);
    const caja = cajaNacional(atlas, [], ["lima", otra.codigo])!;
    const l = atlas.find((c) => c.codigo === "lima")!.caja;
    expect(caja[0]).toBeLessThanOrEqual(l[0]);
    expect(caja[3]).toBeGreaterThanOrEqual(l[3]);
  });

  it("la cifra es la de la sección y sin dato no inventa un cero", () => {
    const ciudades = atlas.filter((c) => ["lima", otra.codigo].includes(c.codigo));
    const datos = { confirmados: [uLima, uOtra], territorios: [{ ubigeo: uLima, poblacion: 2_500_000 }, { ubigeo: uOtra, poblacion: 80_000 }] };
    const pob = cifrasPorCiudad("poblacion", ciudades, datos);
    expect(pob.find((c) => c.codigo === "lima")?.cifra).toBe("2.5 M hab.");
    expect(pob.find((c) => c.codigo === otra.codigo)?.cifra).toBe("80 mil hab.");
    const sinTamano = cifrasPorCiudad("muestra", ciudades, datos);
    expect(sinTamano[0]).toMatchObject({ cifra: "1 distrito", detalle: "sin tamaño calculado" });
    const conTamano = cifrasPorCiudad("muestra", ciudades, { ...datos, entrevistasPorUbigeo: new Map([[uLima, 120], [uOtra, 40]]) });
    expect(conTamano.find((c) => c.codigo === otra.codigo)?.cifra).toBe("40 entrevistas");
    const sel = cifrasPorCiudad("seleccion", ciudades, { ...datos, titulares: [{ ubigeo: uLima }, { ubigeo: uLima }] });
    expect(sel.find((c) => c.codigo === "lima")?.cifra).toBe("2 UMP");
    expect(sel.find((c) => c.codigo === otra.codigo)?.cifra).toBe("0 UMP");
    expect(cifrasPorCiudad("manzanas", ciudades, datos)[0].detalle).toBe("sin sorteo");
  });
});
