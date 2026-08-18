import { describe, expect, it } from "vitest";

import { claveFacultad, esExencionNivel, rangoComoPar, rangosDesdeMapa } from "../rangosNivel";
import { rangosFacultad, setRangosFacultad } from "../criteriosMarco";
import type { CriteriosSeleccionMarco } from "../../../../api/client";

// El motor R emite Array<{min,max}> con claves de ETIQUETA del marco; la UI
// emite Array<[min,max]> con claves slug. Antes la lectura hacía r[0] sobre
// {min,max} y devolvía pares de undefined: los rangos aplicados por API eran
// invisibles y cualquier re-post de la UI los borraba (HSVG2026, S2).

describe("rangoComoPar", () => {
  it("lee el shape del motor {min,max}", () => {
    expect(rangoComoPar({ min: 2, max: 10 })).toEqual([2, 10]);
  });
  it("lee el par posicional de la UI", () => {
    expect(rangoComoPar([0, 0])).toEqual([0, 0]);
  });
  it("ordena un par invertido y rechaza basura", () => {
    expect(rangoComoPar([10, 2])).toEqual([2, 10]);
    expect(rangoComoPar({ exenta: true })).toBeNull();
    expect(rangoComoPar([1])).toBeNull();
    expect(rangoComoPar("2-10")).toBeNull();
  });
});

describe("rangosDesdeMapa", () => {
  const mapaMotor = {
    "EE.GG. CIENCIAS": [{ min: 0, max: 0 }, { min: 2, max: 10 }],
    "GESTIÓN": [{ exenta: true }],
  };

  it("encuentra la facultad aunque la UI pregunte con slug", () => {
    expect(rangosDesdeMapa(mapaMotor, "ee_gg_ciencias")).toEqual([[0, 0], [2, 10]]);
  });

  it("una exención del motor se lee como «sin filtro»", () => {
    expect(rangosDesdeMapa(mapaMotor, "gestión")).toEqual([]);
    expect(esExencionNivel(mapaMotor["GESTIÓN"])).toBe(true);
  });

  it("una facultad ausente devuelve vacío", () => {
    expect(rangosDesdeMapa(mapaMotor, "derecho")).toEqual([]);
  });

  it("la ñ canonicaliza igual que .cm_criterios_fac_key", () => {
    expect(claveFacultad("GESTIÓN")).toBe(claveFacultad("gestion"));
    expect(claveFacultad("DISEÑO")).toBe("diseno");
  });
});

describe("rangosFacultad / setRangosFacultad (embudo de la UI)", () => {
  it("muestra los rangos que el motor guardó con etiqueta del marco", () => {
    const seleccion = {
      byVariable: {},
      courseLevelRanges: { "EE.GG. CIENCIAS": [{ min: 2, max: 10 }] },
    } as CriteriosSeleccionMarco;
    expect(rangosFacultad(seleccion, "ee_gg_ciencias")).toEqual([[2, 10]]);
  });

  it("reescribir con slug NO deja conviviendo la entrada de etiqueta", () => {
    const seleccion = {
      byVariable: {},
      courseLevelRanges: { "EE.GG. CIENCIAS": [{ min: 2, max: 10 }] },
    } as CriteriosSeleccionMarco;
    const nueva = setRangosFacultad(seleccion, "ee_gg_ciencias", [[0, 0]]);
    const claves = Object.keys(nueva.courseLevelRanges ?? {});
    expect(claves).toEqual(["ee_gg_ciencias"]);
    expect(rangosFacultad(nueva, "EE.GG. CIENCIAS")).toEqual([[0, 0]]);
  });

  it("borrar por slug elimina la entrada guardada con etiqueta", () => {
    const seleccion = {
      byVariable: {},
      courseLevelRanges: { "EE.GG. CIENCIAS": [{ min: 2, max: 10 }] },
    } as CriteriosSeleccionMarco;
    const nueva = setRangosFacultad(seleccion, "ee_gg_ciencias", []);
    expect(nueva.courseLevelRanges).toBeUndefined();
  });
});
