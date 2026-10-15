// ID3c (2026-10-15). Mata: guardar una línea que arrastra el profile_id de la aplicada antes (se reconocería como otra),
// que guarda paletas con «Colores» apagado, o que promete logos y letra que aplicar no pondría.
import { describe, expect, it } from "vitest";
import { coloresDeMuestra, lineaDesdePerfil, lineaDesdePlan } from "./modeloLineaPropia";

const plan = {
  presets: { base: { size_titulo: 20 } },
  paletas: { sino: { "Sí": "#003366", No: "#999999" }, acuerdo: { A: "#003366", B: "#c00" } },
  overridesReusables: [{ id: "compacto" }],
  scopeRules: { global: { profile_id: "acnur", template_id: "acnur_16_9" }, otra: 1 },
};

describe("línea propia desde el plan", () => {
  it("con todo encendido lleva paletas, gráficos y reglas, sin el profile_id viejo", () => {
    const l = lineaDesdePlan(plan, { titulo: " Mía ", descripcion: "", colores: true, graficos: true });
    expect(l.titulo_humano).toBe("Mía");
    expect(l.scope_rules).toEqual({ otra: 1, global: { template_id: "acnur_16_9" } });
    expect(l.presets).toEqual(plan.presets);
    expect(l.preview_colors).toEqual(["#003366", "#999999", "#C00"]);
    expect(l.incluye).toEqual({ colores: true, portada: true, letra: false, logos: false });
  });

  it("cada interruptor apaga lo suyo", () => {
    const sinColores = lineaDesdePlan(plan, { titulo: "X", descripcion: "", colores: false, graficos: true });
    expect(sinColores.paletas).toEqual({});
    expect(sinColores.preview_colors).toEqual([]);
    const sinGraficos = lineaDesdePlan(plan, { titulo: "X", descripcion: "", colores: true, graficos: false });
    expect(sinGraficos.presets).toEqual({});
    expect(sinGraficos.overrides_reusables).toEqual([]);
    expect(sinGraficos.scope_rules).toEqual({});
  });

  it("duplicar una línea del recetario parte de sus valores", () => {
    const d = lineaDesdePerfil({ name: "acnur", titulo_humano: "ACNUR", descripcion: "Azul", icono_ui: "", preview_colors: [], presets: { base: { a: 1 } }, paletas: {}, scope_rules: { global: { profile_id: "acnur" } } }, "ACNUR (copia)");
    expect(d.titulo_humano).toBe("ACNUR (copia)");
    expect(d.presets).toEqual({ base: { a: 1 } });
    expect(d.scope_rules).toEqual({ global: {} });
  });

  it("los colores de muestra no se repiten y son seis a lo más", () => {
    expect(coloresDeMuestra({ a: { x: "#111", y: "#111", z: "#222" }, b: { w: "#333", v: "#444", u: "#555", t: "#666", s: "#777" } })).toHaveLength(6);
  });
});
