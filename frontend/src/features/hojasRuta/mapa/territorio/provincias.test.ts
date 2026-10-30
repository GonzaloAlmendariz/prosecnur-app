import { describe, expect, it } from "vitest";
import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { captacionDe, contarProvincias, etiquetaProvincia, gruposPorProvincia, marcoDeProvincias, nombreDelMarco } from "./provincias";

const t = (ubigeo: string, departamento: string, provincia: string, distrito: string, poblacion: number, extra: Partial<HojasRutaTerritory> = {}): HojasRutaTerritory => ({
  ubigeo,
  departamento,
  provincia,
  distrito,
  poblacion,
  viviendas: Math.round(poblacion / 3),
  manzanas: 10,
  provincia_codigo: ubigeo.slice(0, 4),
  ...extra,
});

const territorios = [
  t("040104", "AREQUIPA", "AREQUIPA", "CERRO COLORADO", 197_954, { cobertura_nivel: "1", captacion: 63.2 }),
  t("150122", "LIMA", "LIMA", "MIRAFLORES", 97_531, { cobertura_nivel: "1", captacion: 88 }),
  t("070106", "CALLAO", "CALLAO", "VENTANILLA", 292_250, { cobertura_nivel: "1" }),
  t("080104", "CUSCO", "CUSCO", "SAN JERONIMO", 57_075, { cobertura_nivel: "1", captacion: 50 }),
  t("040101", "AREQUIPA", "AREQUIPA", "AREQUIPA", 55_437, { cobertura_nivel: "1", captacion: 91.9 }),
  t("150802", "LIMA", "HUAURA", "AMBAR", 2_000, { cobertura_nivel: "2" }),
];

describe("provincias del registro de territorios (ADR 0119)", () => {
  it("agrupa por provincia con Lima y Callao primero y las ciudades por nombre", () => {
    const grupos = gruposPorProvincia(territorios);
    expect(grupos.map((g) => g.etiqueta)).toEqual(["Lima Metropolitana", "Callao", "Arequipa", "Cusco", "Huaura · Lima"]);
    expect(grupos[2].filas.map((f) => f.distrito)).toEqual(["AREQUIPA", "CERRO COLORADO"]);
    expect(grupos[2].nivel).toBe("1");
  });

  it("el marco de un porcentaje es el de las provincias tocadas, no el del país", () => {
    const miraflores = territorios[1];
    expect(marcoDeProvincias(territorios, [miraflores])).toBe(97_531); // Huaura (1508) no es Lima Metropolitana
    const arequipa = territorios.filter((x) => x.provincia === "AREQUIPA");
    expect(marcoDeProvincias(territorios, [arequipa[0]])).toBe(197_954 + 55_437);
    expect(nombreDelMarco([miraflores])).toBe("de Lima Metropolitana");
    expect(nombreDelMarco([territorios[1], territorios[2]])).toBe("de Lima Metropolitana y Callao");
    expect(nombreDelMarco(territorios)).toBe("de 5 provincias");
  });

  it("separa Lima Metropolitana de las provincias de la región Lima", () => {
    expect(etiquetaProvincia(territorios[5])).toBe("Huaura · Lima");
    expect(contarProvincias(territorios)).toBe(5);
  });

  it("informa la captación y avisa bajo 55 %", () => {
    expect(captacionDe(territorios[3])).toEqual({ texto: "capta 50 %", baja: true });
    expect(captacionDe(territorios[4])).toEqual({ texto: "capta 92 %", baja: false });
    expect(captacionDe(territorios[2])).toBeNull();
  });
});
