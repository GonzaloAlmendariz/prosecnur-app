import { describe, expect, it } from "vitest";
import { accionesSinRepetir, accionDeObservacion } from "./accionesRevision";

describe("accionDeObservacion", () => {
  it("en PPS una manzana sin viviendas no sale (ADR 0117): si aparece, es de un sorteo anterior y basta sortear de nuevo", () => {
    for (const metodo of ["pps", "pps_tope", "conglomerado_fijo"] as const) {
      const a = accionDeObservacion("titular-sin-viviendas", null, metodo);
      expect(a?.destino).toBe("manzanas");
      expect(a?.texto).toMatch(/Sortea de nuevo/);
      expect(a?.texto).not.toMatch(/marco elegible/);
      // Con o sin marco declarado: el marco no es lo que la deja fuera en PPS.
      expect(accionDeObservacion("reemplazo-sin-viviendas", 1, metodo)?.destino).toBe("manzanas");
    }
    // Sin método conocido se asume el de siempre (PPS).
    expect(accionDeObservacion("titular-sin-viviendas", null)?.destino).toBe("manzanas");
    expect(accionDeObservacion("titular-sin-reemplazo", null)?.destino).toBe("manzanas");
  });
  it("en el sistemático, que da a todas la misma probabilidad, el arreglo es el marco elegible", () => {
    const a = accionDeObservacion("titular-sin-viviendas", null, "sistematico");
    expect(a?.destino).toBe("marco");
    expect(a?.texto).toMatch(/marco elegible/);
    expect(accionDeObservacion("reemplazo-sin-viviendas", 0, "sistematico")?.destino).toBe("marco");
  });
  it("con un mínimo declarado no promete lo que el marco ya hace", () => {
    expect(accionDeObservacion("titular-sin-viviendas", 1, "sistematico")).toBeNull();
  });
  it("las rutas que no alcanzan proponen un mínimo más alto y dicen el de hoy", () => {
    expect(accionDeObservacion("titular-corta", 3)?.texto).toMatch(/hoy 3/);
    expect(accionDeObservacion("reemplazo-corto", null)?.texto).not.toMatch(/hoy/);
  });
  it("la atípica no repite su detalle", () => {
    expect(accionDeObservacion("titular-atipica", null)).toBeNull();
  });
});

describe("acciones de varios grupos", () => {
  it("el segundo grupo con el mismo arreglo conserva sólo el enlace", () => {
    const [a, b, c] = accionesSinRepetir(["reemplazo-corto", "titular-corta", "titular-sin-reemplazo"], 3);
    expect(a?.texto).toMatch(/Un mínimo de viviendas/);
    expect(b).toEqual({ texto: "", destino: "marco" });
    expect(c?.texto).toMatch(/Sube los reemplazos/);
  });
});
