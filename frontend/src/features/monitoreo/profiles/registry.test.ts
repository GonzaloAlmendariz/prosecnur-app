import { describe, expect, test } from "vitest";
import { preloadMonitoreoFamily } from "./registry";
import type { MonitoreoFamilyId } from "./types";

const FAMILIES: MonitoreoFamilyId[] = [
  "acreditacion",
  "territorial",
  "aulas_universitarias",
  "telefonico",
];

describe("monitoreo profile registry", () => {
  test("resuelve perfiles dinamicos por familia", async () => {
    for (const family of FAMILIES) {
      const profile = await preloadMonitoreoFamily(family);
      expect(profile?.family).toBe(family);
      expect(profile?.chunk).not.toBe("monitoreo-original");
      expect(typeof profile?.loadPage).toBe("function");
      expect(profile?.views.length).toBeGreaterThan(0);
    }
  });

  test("mantiene telefonico alineado con el flujo canonico de acreditacion", async () => {
    const profile = await preloadMonitoreoFamily("telefonico");

    expect(profile?.chunk).toBe("monitoreo-telefonico");
    expect(profile?.views).toEqual(["fuentes", "modelo", "consultas", "telefonico", "avance"]);
    expect(profile?.warmupScopes).toEqual(["source", "advance_summary", "queries_summary", "phone_summary"]);
    expect(profile?.reportScopes?.telefonico).toBe("phone_summary");
    expect(profile?.reportScopes?.consultas).toBe("queries_summary");
    expect(profile?.reportScopes?.modelo).toBe("advance_summary");
  });

  test("declara warmup liviano para acreditacion", async () => {
    const profile = await preloadMonitoreoFamily("acreditacion");

    expect(profile?.chunk).toBe("monitoreo-acreditacion");
    expect(profile?.warmupScopes).toEqual(["source", "advance_summary", "queries_summary", "phone_summary"]);
    expect(profile?.warmupScopes).not.toContain("full");
  });
});
