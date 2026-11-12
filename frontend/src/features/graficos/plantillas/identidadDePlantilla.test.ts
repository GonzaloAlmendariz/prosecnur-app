import { describe, expect, it } from "vitest";
import type { PptStyleProfileMeta } from "../../../api/graficos";
import { cambiosDeIdentidad, configDePlantilla, nombreDePaleta, sinPerfil, type IdentidadEditable } from "./identidadDePlantilla";

const ACNUR: PptStyleProfileMeta = {
  name: "acnur_kobo_cruncher_plus",
  titulo_humano: "ACNUR",
  descripcion: "",
  icono_ui: "",
  preview_colors: [],
  presets: { pie: { decimales_pct: 1 }, barras_apiladas: { decimales: 1 } },
  paletas: {
    yesno: { Si: "#0072BC", "Sí": "#0072BC", No: "#CBCBCB" },
    likert: { "Totalmente en desacuerdo": "#D7DDE5", "De acuerdo": "#00B398", "Totalmente de acuerdo": "#0072BC" },
  },
  overrides_reusables: [{ id: "ovr-acnur", nombre: "par", tipo_preset: "barras_agrupadas", args: {} } as never],
};

const pulso = (extra: Partial<IdentidadEditable> = {}): IdentidadEditable => ({
  presets: { pie: { decimales_pct: 0 } },
  paletas: {},
  overridesReusables: [],
  scopeRules: {},
  ...extra,
});

/** El proyecto tal como queda después de aplicar ACNUR sobre `pulso()`. */
const conAcnur = (extra: Partial<IdentidadEditable> = {}): IdentidadEditable => ({
  presets: { pie: { decimales_pct: 1 }, barras_apiladas: { decimales: 1 } },
  paletas: { ...ACNUR.paletas! },
  overridesReusables: [{ id: "ovr-acnur" }],
  scopeRules: { global: { profile_id: "acnur_kobo_cruncher_plus", template_id: "acnur_16_9", acnur_mode: "general", otra: 1 } },
  ...extra,
});

describe("cambiosDeIdentidad", () => {
  it("de Pulso a ACNUR: cambia el estilo, agrega paletas, cambia ajustes y avisa de los logos", () => {
    const c = cambiosDeIdentidad(pulso(), null, ACNUR, { logosPropios: 2 });
    expect(c.map((x) => x.clave)).toEqual(["estilo", "paletas-nuevas", "ajustes", "logos"]);
    expect(c[0].texto).toBe("El estilo de PowerPoint pasa de Pulso a ACNUR.");
    expect(c[1].texto).toBe('Se agregan las paletas de "Sí / No" y "Totalmente en desacuerdo" a "Totalmente de acuerdo".');
    expect(c[2].texto).toBe("Cambia el estilo de 2 tipos de gráfico.");
  });

  it("una paleta propia con el mismo nombre se reemplaza y se dice", () => {
    const c = cambiosDeIdentidad(pulso({ paletas: { yesno: { "Sí": "#111111", No: "#222222" } } }), null, ACNUR, { logosPropios: 0 });
    const r = c.find((x) => x.clave === "paletas-reemplazadas");
    expect(r?.texto).toBe('Se reemplazan tus colores de "Sí / No".');
    expect(r?.pisa).toBe(true);
    expect(c.some((x) => x.clave === "logos")).toBe(false);
  });

  it("volver a crear con ACNUR sobre ACNUR intacto no cambia nada", () => {
    expect(cambiosDeIdentidad(conAcnur(), ACNUR, ACNUR, { logosPropios: 0 })).toEqual([]);
  });

  it("de ACNUR a Pulso: quita lo de ACNUR y conserva la paleta editada", () => {
    const editada = conAcnur({ paletas: { ...ACNUR.paletas!, yesno: { "Sí": "#123456", No: "#CBCBCB" } } });
    const c = cambiosDeIdentidad(editada, ACNUR, null, { logosPropios: 1 });
    expect(c.map((x) => x.clave)).toEqual(["estilo", "paletas-quitadas", "paletas-conservadas", "ajustes"]);
    expect(c[0].texto).toBe("El estilo de PowerPoint pasa de ACNUR a Pulso.");
    expect(c[1].texto).toBe('Se quita la paleta de ACNUR: "Totalmente en desacuerdo" a "Totalmente de acuerdo".');
    expect(c[2].texto).toBe('Se conserva "Sí / No", que editaste.');
  });

  it("En blanco mantiene la identidad", () => {
    expect(cambiosDeIdentidad(pulso(), null, ACNUR, { logosPropios: 3, mantieneIdentidad: true })).toEqual([]);
  });
});

describe("sinPerfil", () => {
  it("quita lo que el perfil dejó tal cual, conserva lo editado y borra el estilo de global", () => {
    const estado = conAcnur({ presets: { pie: { decimales_pct: 1, size_leyenda: 14 }, barras_apiladas: { decimales: 2 } } });
    const s = sinPerfil(estado, ACNUR);
    expect(s.presets).toEqual({ pie: { size_leyenda: 14 }, barras_apiladas: { decimales: 2 } });
    expect(Object.keys(s.paletas)).toEqual([]);
    expect(s.overridesReusables).toEqual([]);
    expect(s.scopeRules).toEqual({ global: { otra: 1 } });
  });
});

describe("nombreDePaleta", () => {
  it("nombra por las respuestas, sin repetir Si y Sí", () => {
    expect(nombreDePaleta({ Si: "#1", "Sí": "#1", No: "#2" })).toBe('"Sí / No"');
    expect(nombreDePaleta({ Bajo: "#1", Medio: "#2", Alto: "#3" })).toBe('"Bajo" a "Alto"');
  });
});

describe("configDePlantilla", () => {
  const config = { presets: {}, scope_rules: { coverage_exclusions: ["x"], global: { profile_id: "acnur_kobo_cruncher_plus", template_id: "acnur_16_9", otra: 1 } } };
  it("la plantilla escribe su identidad entera: Pulso pisa la plantilla de PowerPoint de ACNUR", () => {
    const c = configDePlantilla(config, { config: { perfil_auto: false } });
    expect(c.scope_rules).toEqual({ coverage_exclusions: ["x"], global: { otra: 1, profile_id: "", template_id: "generic_16_9", acnur_mode: "general" } });
    expect(c.perfil_auto).toBe(false);
    const a = configDePlantilla({}, { config: { profile_id: "acnur_kobo_cruncher_plus", template_id: "acnur_16_9", acnur_mode: "territorial" } });
    expect((a.scope_rules as { global: unknown }).global).toEqual({ profile_id: "acnur_kobo_cruncher_plus", template_id: "acnur_16_9", acnur_mode: "territorial" });
  });
  it("En blanco conserva la del proyecto", () => {
    expect(configDePlantilla(config, { config: {}, enBlanco: true }).scope_rules).toEqual(config.scope_rules);
  });
});

describe("perfilVigente", () => {
  it("la plantilla de PowerPoint de ACNUR sin su perfil sigue siendo ACNUR", async () => {
    const { perfilVigente } = await import("./identidadDePlantilla");
    expect(perfilVigente({ global: { template_id: "acnur_16_9" } })).toBe("acnur_kobo_cruncher_plus");
    expect(perfilVigente({ global: { template_id: "generic_16_9" } })).toBe("");
    expect(perfilVigente({})).toBe("");
  });
});
