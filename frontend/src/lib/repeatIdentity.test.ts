import { describe, expect, test } from "vitest";
import {
  formatRepeatGrain,
  isRepeatChildBase,
  normalizeRepeatGrain,
  repeatBadgeLabel,
  safeRepeatNum,
  type RepeatGrain,
} from "./repeatIdentity";

describe("safeRepeatNum", () => {
  test("acepta números finitos y descarta NaN/Infinity", () => {
    expect(safeRepeatNum(668)).toBe(668);
    expect(safeRepeatNum(0)).toBe(0);
    expect(safeRepeatNum(Number.NaN)).toBeNull();
    expect(safeRepeatNum(Number.POSITIVE_INFINITY)).toBeNull();
  });

  test("parsea strings numéricos y descarta NA/vacíos/basura (payload R)", () => {
    expect(safeRepeatNum("427")).toBe(427);
    expect(safeRepeatNum("  12 ")).toBe(12);
    expect(safeRepeatNum("NA")).toBeNull();
    expect(safeRepeatNum("NaN")).toBeNull();
    expect(safeRepeatNum("")).toBeNull();
    expect(safeRepeatNum("abc")).toBeNull();
  });

  test("descarta null/undefined/objetos", () => {
    expect(safeRepeatNum(null)).toBeNull();
    expect(safeRepeatNum(undefined)).toBeNull();
    expect(safeRepeatNum({})).toBeNull();
  });
});

describe("isRepeatChildBase", () => {
  test("solo TRUE para source_kind kobo_repeat", () => {
    expect(isRepeatChildBase({ source_kind: "kobo_repeat" })).toBe(true);
    expect(isRepeatChildBase({ source_kind: "manual" })).toBe(false);
    expect(isRepeatChildBase({ source_kind: "surveymonkey" })).toBe(false);
    expect(isRepeatChildBase({ source_kind: null })).toBe(false);
    expect(isRepeatChildBase({})).toBe(false);
    expect(isRepeatChildBase(null)).toBe(false);
    expect(isRepeatChildBase(undefined)).toBe(false);
  });
});

describe("repeatBadgeLabel", () => {
  test("incluye el grupo cuando existe", () => {
    expect(repeatBadgeLabel("rep_servicios")).toBe("Repetible · rep_servicios");
    expect(repeatBadgeLabel("  rep_hijos  ")).toBe("Repetible · rep_hijos");
  });

  test("cae a 'Repetible' cuando no hay grupo", () => {
    expect(repeatBadgeLabel("")).toBe("Repetible");
    expect(repeatBadgeLabel("   ")).toBe("Repetible");
    expect(repeatBadgeLabel(null)).toBe("Repetible");
    expect(repeatBadgeLabel(undefined)).toBe("Repetible");
  });
});

describe("normalizeRepeatGrain", () => {
  test("normaliza un grano de instancia completo", () => {
    const grain = normalizeRepeatGrain({
      kind: "instancia",
      n_instancias: 668,
      n_personas: 427,
      repeat_group: "rep_servicios",
      parent_base: "acnur_pdm",
      nota: "El grano de esta base es la INSTANCIA del repeat.",
    });
    expect(grain).toEqual<RepeatGrain>({
      kind: "instancia",
      n_instancias: 668,
      n_personas: 427,
      repeat_group: "rep_servicios",
      parent_base: "acnur_pdm",
      nota: "El grano de esta base es la INSTANCIA del repeat.",
    });
  });

  test("tolera N como string y NA (payload R)", () => {
    const grain = normalizeRepeatGrain({
      kind: "instancia",
      n_instancias: "668",
      n_personas: "NA",
      repeat_group: "rep_servicios",
    });
    expect(grain?.n_instancias).toBe(668);
    expect(grain?.n_personas).toBeNull();
    expect(grain?.parent_base).toBe("");
    expect(grain?.nota).toBe("");
  });

  test("devuelve null para bases no-repeat o formas inesperadas", () => {
    expect(normalizeRepeatGrain(null)).toBeNull();
    expect(normalizeRepeatGrain(undefined)).toBeNull();
    expect(normalizeRepeatGrain("instancia")).toBeNull();
    expect(normalizeRepeatGrain({})).toBeNull();
    expect(normalizeRepeatGrain({ kind: "otro" })).toBeNull();
  });
});

describe("formatRepeatGrain", () => {
  test("arma el headline con instancias + grupo + personas", () => {
    const display = formatRepeatGrain({
      kind: "instancia",
      n_instancias: 668,
      n_personas: 427,
      repeat_group: "rep_servicios",
      parent_base: "acnur_pdm",
      nota: "Ignora el clustering por persona.",
    });
    expect(display).toEqual({
      headline: "N = 668 instancias de rep_servicios · 427 personas",
      caveat: "Ignora el clustering por persona.",
    });
  });

  test("singulariza y omite el grupo cuando no está", () => {
    const display = formatRepeatGrain({
      kind: "instancia",
      n_instancias: 1,
      n_personas: 1,
      repeat_group: "",
      parent_base: "",
      nota: "",
    });
    expect(display).toEqual({
      headline: "N = 1 instancia · 1 persona",
      caveat: "",
    });
  });

  test("muestra solo el N disponible", () => {
    expect(formatRepeatGrain({
      kind: "instancia",
      n_instancias: 668,
      n_personas: null,
      repeat_group: "rep_servicios",
      parent_base: "",
      nota: "",
    })?.headline).toBe("N = 668 instancias de rep_servicios");
  });

  test("devuelve null cuando no hay ningún N ni grano", () => {
    expect(formatRepeatGrain(null)).toBeNull();
    expect(formatRepeatGrain(undefined)).toBeNull();
    expect(formatRepeatGrain({
      kind: "instancia",
      n_instancias: null,
      n_personas: null,
      repeat_group: "rep_servicios",
      parent_base: "",
      nota: "algo",
    })).toBeNull();
  });
});
