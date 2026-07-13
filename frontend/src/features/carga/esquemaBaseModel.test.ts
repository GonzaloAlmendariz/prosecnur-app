import { describe, expect, it } from "vitest";
import type { RepeatBaseLike } from "../../lib/repeatIdentity";
import {
  defaultEsquemaBase,
  esquemaOptionLabel,
  isRepeatMother,
  repeatGroupOfMother,
} from "./esquemaBaseModel";

// Fixtures minimalistas (solo la identidad repeat, patrón estructural).
const mother: RepeatBaseLike = { source_kind: "kobo", parent_base: null, repeat_group: null };
const child: RepeatBaseLike = {
  source_kind: "kobo_repeat",
  parent_base: "post_distribution_monitoring",
  repeat_group: "rep_servicios",
};

const pdmBases: Record<string, RepeatBaseLike> = {
  post_distribution_monitoring: mother,
  rep_servicios: child,
};

describe("defaultEsquemaBase", () => {
  it("prefiere la base MADRE de una hija kobo_repeat (muestra el begin_repeat)", () => {
    expect(defaultEsquemaBase(pdmBases, "rep_servicios")).toBe("post_distribution_monitoring");
  });

  it("hija repeat sin parent_base resoluble: elige la primera base NO-hija (madre probable)", () => {
    // Caso real (ACNUR_PDM): la base hija kobo_repeat no persistió el enlace y
    // la base activa ES la hija. Igual debe defaultear a la madre (no-hija).
    const bases: Record<string, RepeatBaseLike> = {
      post_distribution_monitoring: { source_kind: "monitoreo_kobo" },
      rep_servicios: { source_kind: "kobo_repeat" },
    };
    expect(defaultEsquemaBase(bases, "rep_servicios")).toBe("post_distribution_monitoring");
  });

  it("hija repeat huérfana sin ninguna base no-hija cae a la activa/primera", () => {
    const orphan: Record<string, RepeatBaseLike> = {
      rep_servicios: { source_kind: "kobo_repeat", parent_base: "ausente", repeat_group: "rep_servicios" },
    };
    expect(defaultEsquemaBase(orphan, "rep_servicios")).toBe("rep_servicios");
  });

  it("cae a la base activa cuando no hay grupos repeat", () => {
    const bases: Record<string, RepeatBaseLike> = {
      base_a: { source_kind: "surveymonkey" },
      base_b: { source_kind: "manual" },
    };
    expect(defaultEsquemaBase(bases, "base_b")).toBe("base_b");
  });

  it("cae a la primera base cuando la activa no existe", () => {
    const bases: Record<string, RepeatBaseLike> = {
      base_a: { source_kind: "manual" },
      base_b: { source_kind: "manual" },
    };
    expect(defaultEsquemaBase(bases, "fantasma")).toBe("base_a");
    expect(defaultEsquemaBase(bases, null)).toBe("base_a");
  });

  it("devuelve cadena vacía sin bases", () => {
    expect(defaultEsquemaBase({}, null)).toBe("");
    expect(defaultEsquemaBase(null, "x")).toBe("");
  });
});

describe("isRepeatMother / repeatGroupOfMother", () => {
  it("reconoce la base madre y su grupo repetible", () => {
    expect(isRepeatMother(pdmBases, "post_distribution_monitoring")).toBe(true);
    expect(repeatGroupOfMother(pdmBases, "post_distribution_monitoring")).toBe("rep_servicios");
  });

  it("la base hija no es madre", () => {
    expect(isRepeatMother(pdmBases, "rep_servicios")).toBe(false);
    expect(repeatGroupOfMother(pdmBases, "rep_servicios")).toBeNull();
  });

  it("no marca madre en estudios sin repeat", () => {
    const bases: Record<string, RepeatBaseLike> = { a: { source_kind: "manual" } };
    expect(isRepeatMother(bases, "a")).toBe(false);
    expect(repeatGroupOfMother(bases, "a")).toBeNull();
  });
});

describe("esquemaOptionLabel", () => {
  it("anota la base hija repeat", () => {
    expect(esquemaOptionLabel(pdmBases, "rep_servicios")).toBe("rep_servicios · base repetible");
  });

  it("anota la base madre", () => {
    expect(esquemaOptionLabel(pdmBases, "post_distribution_monitoring")).toBe(
      "post_distribution_monitoring · con grupo repetible",
    );
  });

  it("deja las bases normales sin anotación", () => {
    const bases: Record<string, RepeatBaseLike> = { encuesta: { source_kind: "manual" } };
    expect(esquemaOptionLabel(bases, "encuesta")).toBe("encuesta");
  });
});
