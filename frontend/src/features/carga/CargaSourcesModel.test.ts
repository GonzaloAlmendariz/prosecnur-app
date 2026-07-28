import { describe, expect, it } from "vitest";
import {
  normalizePlannedInputCount,
  plannedResultBaseCount,
  processingProfileFromMonitoring,
  sourceInputCount,
} from "./CargaSourcesModel";

describe("modelo semántico de entradas de Fuentes", () => {
  it("normaliza plannedInputCount entre 1 y 16, o 1 y 10 para independientes", () => {
    expect(normalizePlannedInputCount("separate", 0)).toBe(1);
    expect(normalizePlannedInputCount("integrated", 99)).toBe(16);
    expect(normalizePlannedInputCount("independent", 99)).toBe(10);
  });

  it.each([
    ["separate", 4, 4],
    ["integrated", 4, 1],
    ["independent", 4, 4],
  ] as const)("resuelve %s con %i entradas como %i bases", (strategy, inputs, bases) => {
    expect(plannedResultBaseCount(strategy, inputs)).toBe(bases);
  });

  it("no cuenta bases repeat derivadas como entradas independientes", () => {
    expect(sourceInputCount([
      { nombre: "hogares", source_kind: "manual" },
      { nombre: "miembros", source_kind: "kobo_repeat", parent_base: "hogares" },
      { nombre: "comunidades", source_kind: "manual" },
    ])).toBe(2);
  });

  it("solo declara multi_actor cuando acreditación fue confirmada explícitamente", () => {
    const accreditation = {
      profile_family: "acreditacion",
      profile_variant: "acreditacion",
      accreditation_declared: true as boolean | null,
    };

    expect(processingProfileFromMonitoring(accreditation)).toBe("multi_actor");
    expect(processingProfileFromMonitoring({
      ...accreditation,
      accreditation_declared: false,
    })).toBeNull();
    expect(processingProfileFromMonitoring({
      ...accreditation,
      accreditation_declared: null,
    })).toBeNull();
  });

  it("clasifica PDM y territorial por familia profesional, no por nombres libres", () => {
    expect(processingProfileFromMonitoring({
      profile_family: "telefonico",
      profile_variant: "multi_actor",
    })).toBe("telefonico");
    expect(processingProfileFromMonitoring({
      profile_family: "territorial",
      profile_variant: "multi_actor",
    })).toBe("territorial");
    expect(processingProfileFromMonitoring({
      profile_family: null,
      profile_variant: "proyecto-pdm-mencionado-en-un-titulo",
    })).toBeNull();
  });
});
