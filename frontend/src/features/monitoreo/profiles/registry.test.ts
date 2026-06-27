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

  test("mantiene telefonico como perfil ligero sin cargar aulas o territorial", async () => {
    const profile = await preloadMonitoreoFamily("telefonico");

    expect(profile?.chunk).toBe("monitoreo-telefonico");
    expect(profile?.views[0]).toBe("telefonico");
    expect(profile?.views).toEqual(["telefonico", "avance", "modelo", "fuentes"]);
    expect(profile?.warmupScopes).toEqual(["source", "advance_summary"]);
    expect(profile?.reportScopes?.telefonico).toBe("full");
    expect(profile?.reportScopes?.modelo).toBe("source");
  });
});
