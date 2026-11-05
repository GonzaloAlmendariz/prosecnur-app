import { describe, expect, it } from "vitest";
import { accionesSinRepetir, accionDeObservacion } from "./accionesRevision";

describe("accionDeObservacion", () => {
  it("sin marco elegible, las manzanas sin viviendas se arreglan volviendo a sortear con él", () => {
    const a = accionDeObservacion("titular-sin-viviendas", null);
    expect(a?.destino).toBe("marco");
    expect(a?.texto).toMatch(/marco elegible/);
    expect(accionDeObservacion("reemplazo-sin-viviendas", 0)?.destino).toBe("marco");
    expect(accionDeObservacion("titular-sin-reemplazo", null)?.destino).toBe("manzanas");
  });
  it("con un mínimo declarado no promete lo que el marco ya hace", () => {
    expect(accionDeObservacion("titular-sin-viviendas", 1)).toBeNull();
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
