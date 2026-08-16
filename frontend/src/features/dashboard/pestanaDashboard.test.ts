import { describe, expect, it } from "vitest";

import { resolverPestanaDashboard } from "./pestanaDashboard";

// Vara V7. El resolver del tablero quedó sin cubrir al publicar las
// direcciones del Dashboard, y tiene la misma costura de normalización que el
// de Validación: `base_datos` vuelve de la dirección como `base-datos`.

describe("resolverPestanaDashboard", () => {
  it("resuelve las cuatro pestañas del tablero", () => {
    expect(resolverPestanaDashboard("resumen")).toBe("resumen");
    expect(resolverPestanaDashboard("relaciones")).toBe("relaciones");
    expect(resolverPestanaDashboard("base_datos")).toBe("base_datos");
    expect(resolverPestanaDashboard("dimensiones")).toBe("dimensiones");
  });

  it("acepta el token normalizado que devuelve la dirección", () => {
    // `__pulsoNav.describir()` reporta `dashboard/dashboard/base-datos`: si el
    // resolver no lo aceptara, volver desde esa dirección caería en Resumen.
    expect(resolverPestanaDashboard("base-datos")).toBe("base_datos");
  });

  it("cae a Resumen cuando la URL no nombra una pestaña válida", () => {
    expect(resolverPestanaDashboard("inexistente")).toBe("resumen");
    expect(resolverPestanaDashboard(null)).toBe("resumen");
    expect(resolverPestanaDashboard(undefined)).toBe("resumen");
    expect(resolverPestanaDashboard("")).toBe("resumen");
  });
});
