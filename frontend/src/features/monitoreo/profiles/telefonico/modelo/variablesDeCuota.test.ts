import { describe, expect, it } from "vitest";

import {
  capitalizarPalabras,
  esColumnaDeIdentidad,
  rotuloDeVariable,
  variablesDeCuotaOfrecidas,
} from "./variablesDeCuota";

const RMS = [
  { name: "Código proGres", n_unique: 800 },
  { name: "Nombre", n_unique: 790 },
  { name: "Tef1", n_unique: 800 },
  { name: "Origen", n_unique: 2 },
  { name: "Periodo de Llegada", n_unique: 4 },
  { name: "Responsable", n_unique: 6 },
];

describe("esColumnaDeIdentidad", () => {
  it("reconoce códigos, nombres y teléfonos por su encabezado", () => {
    expect(esColumnaDeIdentidad({ name: "Código proGres", n_unique: 3 })).toBe(true);
    expect(esColumnaDeIdentidad({ name: "Tef2", n_unique: 3 })).toBe(true);
    expect(esColumnaDeIdentidad({ name: "nombre_completo", n_unique: 3 })).toBe(true);
    expect(esColumnaDeIdentidad({ name: "codpulso", n_unique: 3 })).toBe(true);
  });

  it("descarta una columna con más categorías de las que una cuota reparte", () => {
    expect(esColumnaDeIdentidad({ name: "Comentario", n_unique: 31 })).toBe(true);
    expect(esColumnaDeIdentidad({ name: "Periodo de Llegada", n_unique: 4 })).toBe(false);
    expect(esColumnaDeIdentidad({ name: "Validez", n_unique: 2 })).toBe(false);
  });
});

describe("variablesDeCuotaOfrecidas", () => {
  it("en RMS no ofrece el código ni el teléfono y pone primero lo que reparte", () => {
    const ofrecidas = variablesDeCuotaOfrecidas(RMS.map((v) => v.name), RMS, []);
    expect(ofrecidas).not.toContain("Código proGres");
    expect(ofrecidas).not.toContain("Tef1");
    expect(ofrecidas).not.toContain("Nombre");
    expect(ofrecidas[0]).toBe("Periodo de Llegada");
    expect(ofrecidas).toContain("Origen");
  });

  it("respeta una columna que alguien ya guardó, aunque parezca identificador", () => {
    const ofrecidas = variablesDeCuotaOfrecidas(RMS.map((v) => v.name), RMS, ["Código proGres"]);
    expect(ofrecidas[0]).toBe("Código proGres");
  });

  it("la sede va primero aunque tenga muchas categorías", () => {
    const variables = [{ name: "region", n_unique: 3 }, { name: "sede", n_unique: 45 }];
    expect(variablesDeCuotaOfrecidas(["region", "sede"], variables, [])).toEqual(["sede", "region"]);
  });

  it("conserva variables que sólo vienen del reporte de cuotas", () => {
    expect(variablesDeCuotaOfrecidas(["dim_segmento"], [], [])).toEqual(["dim_segmento"]);
  });
});

describe("rotuloDeVariable", () => {
  it("respeta un encabezado escrito por una persona", () => {
    expect(rotuloDeVariable("Código proGres")).toBe("Código proGres");
    expect(rotuloDeVariable("Periodo de Llegada")).toBe("Periodo de Llegada");
  });

  it("humaniza una clave técnica sin partir la palabra en la tilde", () => {
    expect(rotuloDeVariable("dim_periodo_llegada")).toBe("Periodo Llegada");
    expect(rotuloDeVariable("sede")).toBe("Sede");
    expect(rotuloDeVariable("código_región")).toBe("Código Región");
    expect(rotuloDeVariable("")).toBe("Variable");
  });

  it("capitaliza cada palabra y no la letra que sigue a una vocal tildada", () => {
    expect(capitalizarPalabras("código progres")).toBe("Código Progres");
  });
});
