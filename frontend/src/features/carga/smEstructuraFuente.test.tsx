import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { EstudioPayload, SurveyMonkeyMultibaseDiff, SurveyMonkeyRefreshBasePlan } from "../../api/client";
import { SmEstructuraFuenteAccion } from "./SmEstructuraFuenteAccion";
import {
  SM_ACCION_BASE_POR_POSICION,
  SM_ACCION_INSTRUMENTO_DISTINTO,
  equivalenciasDisponibleEnEstudio,
  smDiffAccion,
  smDiffKindLabel,
  smDiffSeverityLabel,
  smRefreshStructureDetail,
} from "./smEstructuraFuente";

function diff(partial: Partial<SurveyMonkeyMultibaseDiff>): SurveyMonkeyMultibaseDiff {
  return {
    survey_id: "s2",
    pos: 1,
    variable: "p1",
    severity: "review",
    kind: "options",
    message: "",
    ref: "",
    current: "",
    ...partial,
  };
}

function row(diffs: SurveyMonkeyMultibaseDiff[], extra: Partial<SurveyMonkeyRefreshBasePlan> = {}): SurveyMonkeyRefreshBasePlan {
  return {
    base_name: "egresados",
    ok: true,
    updateable: true,
    structure: { diffs, n_blocking: diffs.filter((d) => d.severity === "blocking").length },
    ...extra,
  };
}

function estudio(partial: Partial<EstudioPayload>): Pick<EstudioPayload, "topology_declared" | "processing_mode" | "bases"> {
  const base = { nombre: "x" } as EstudioPayload["bases"][string];
  return {
    topology_declared: "independent",
    bases: { a: { ...base, nombre: "a" }, b: { ...base, nombre: "b" } },
    ...partial,
  };
}

describe("smEstructuraFuente · etiquetas de los kinds de emparejado (ADR 0099)", () => {
  it("nombra los cuatro kinds nuevos sin jerga", () => {
    expect(smDiffKindLabel("question_order")).toBe("Preguntas en otro orden");
    expect(smDiffKindLabel("unpaired_source")).toBe("Preguntas de la fuente sin par");
    expect(smDiffKindLabel("unpaired_base")).toBe("Preguntas de la base sin par");
    expect(smDiffKindLabel("different_instrument")).toBe("Instrumento distinto");
    expect(smDiffKindLabel("wording")).toBe("Fraseo distinto");
    expect(smDiffKindLabel("algo_nuevo")).toBe("algo nuevo");
  });

  it("el orden distinto es informativo, no una revisión", () => {
    expect(smDiffSeverityLabel("info", "question_order")).toBe("Informativo");
    expect(smDiffSeverityLabel("review", "question_order")).toBe("Informativo");
    expect(smDiffSeverityLabel("blocking", "different_instrument")).toBe("Estructura");
    expect(smDiffSeverityLabel("review", "unpaired_source")).toBe("Revisión");
  });

  it("solo el instrumento distinto trae una acción", () => {
    expect(smDiffAccion("different_instrument")).toBe(SM_ACCION_INSTRUMENTO_DISTINTO);
    expect(smDiffAccion("legacy_positional")).toBe(SM_ACCION_BASE_POR_POSICION);
    expect(smDiffAccion("unpaired_source")).toBeNull();
  });
});

describe("smRefreshStructureDetail", () => {
  it("un instrumento distinto es una decisión, no una lista de variables", () => {
    const detail = smRefreshStructureDetail(row([
      diff({ severity: "blocking", kind: "different_instrument", variable: "", pos: 0, message: "30 de 73" }),
    ], { updateable: false }));
    expect(detail?.label).toBe("Instrumento distinto");
    expect(detail?.label).not.toContain("pos.");
  });

  it("agrupa las preguntas sin par por lado y acota a tres con +N", () => {
    const detail = smRefreshStructureDetail(row([
      diff({ kind: "unpaired_source", variable: "cod_pulso" }),
      diff({ kind: "unpaired_source", variable: "celular" }),
      diff({ kind: "unpaired_source", variable: "enumerador" }),
      diff({ kind: "unpaired_source", variable: "dni" }),
      diff({ kind: "unpaired_base", variable: "p7" }),
    ]));
    expect(detail?.label).toBe(
      "Preguntas de la fuente sin par: cod_pulso, celular, enumerador +1 · Preguntas de la base sin par: p7",
    );
  });

  it("una fuente solo reordenada se informa sin pedir revisión", () => {
    const detail = smRefreshStructureDetail(row([diff({ severity: "special", kind: "question_order", variable: "" })]));
    expect(detail?.label).toBe("Preguntas en otro orden");
  });

  it("conserva las lecturas previas: bloqueos con +N y metadata opcional", () => {
    const blocking = smRefreshStructureDetail(row(
      ["a", "b", "c", "d", "e"].map((variable) => diff({ severity: "blocking", kind: "structure", variable })),
      { updateable: false },
    ));
    expect(blocking?.label).toBe("Bloqueos en a, b, c, d +1");
    const metadata = smRefreshStructureDetail(row([diff({ kind: "metadata_optional", variable: "ip" })]));
    expect(metadata?.label).toBe("Metadata opcional ip");
    expect(smRefreshStructureDetail(row([]))).toBeNull();
  });
});

describe("enlace a Equivalencias desde el diagnóstico", () => {
  it("la pestaña existe solo con bases separadas o independientes y más de una primaria", () => {
    expect(equivalenciasDisponibleEnEstudio(estudio({}))).toBe(true);
    expect(equivalenciasDisponibleEnEstudio(estudio({ topology_declared: "integrated" }))).toBe(false);
    expect(equivalenciasDisponibleEnEstudio(estudio({ topology_declared: null }))).toBe(false);
    const unaPrimaria = estudio({});
    unaPrimaria.bases.b = { ...unaPrimaria.bases.b, source_kind: "kobo_repeat", parent_base: "a" };
    expect(equivalenciasDisponibleEnEstudio(unaPrimaria)).toBe(false);
  });

  it("un estudio de hermanos independientes la tiene aunque no declare topología", () => {
    // Espejo de `estudio_is_independent_siblings` en el backend: el estudio
    // medido (3 públicos, topología null) servía la pestaña y el enlace no salía.
    expect(equivalenciasDisponibleEnEstudio(
      estudio({ topology_declared: null, processing_mode: "independent_siblings" }),
    )).toBe(true);
  });

  it("enlaza a la dirección canónica cuando la pestaña existe", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/carga?pestana=fuentes"]}>
        <SmEstructuraFuenteAccion diffs={[{ kind: "different_instrument" }]} estudio={estudio({})} />
      </MemoryRouter>,
    );
    expect(html).toContain('href="/carga?pestana=equivalencias"');
    expect(html.replace(/<[^>]+>/g, "")).toBe(SM_ACCION_INSTRUMENTO_DISTINTO);
  });

  it("sin la pestaña dice qué hacer sin un enlace muerto", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/carga?pestana=fuentes"]}>
        <SmEstructuraFuenteAccion diffs={[{ kind: "different_instrument" }]} estudio={estudio({ topology_declared: "single" })} />
      </MemoryRouter>,
    );
    expect(html).not.toContain("<a");
    expect(html.replace(/<[^>]+>/g, "")).toBe(SM_ACCION_INSTRUMENTO_DISTINTO);
  });

  it("no dice nada si la fuente no es otro instrumento", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/carga"]}>
        <SmEstructuraFuenteAccion diffs={[{ kind: "question_order" }]} estudio={estudio({})} />
      </MemoryRouter>,
    );
    expect(html).toBe("");
  });
});

describe("bloqueos que son una sola decisión", () => {
  it("una base armada por posición se nombra como tal y nunca dice «pos. null»", () => {
    const detail = smRefreshStructureDetail({
      base_name: "egresados",
      refresh_action: "blocked",
      updateable: false,
      structure: { n_blocking: 1, diffs: [{ kind: "legacy_positional", severity: "blocking", pos: Number.NaN, variable: "", message: "Regenera la base" }] },
    } as unknown as Parameters<typeof smRefreshStructureDetail>[0]);
    expect(detail?.label).toBe("Base armada por posición");
    expect(detail?.title).not.toMatch(/pos\. (null|NaN)/u);
  });

  it("una opción guardada sin equivalente se nombra en español y dice qué variable bloquea", () => {
    expect(smDiffKindLabel("saved_codes_mismatch")).toBe("Opción guardada sin equivalente");
    const detail = smRefreshStructureDetail({
      base_name: "pesos",
      refresh_action: "blocked",
      updateable: false,
      structure: { n_blocking: 1, diffs: [{ kind: "saved_codes_mismatch", severity: "blocking", pos: 1, variable: "p1", message: "La base guarda «Neutral» en p1" }] },
    } as unknown as Parameters<typeof smRefreshStructureDetail>[0]);
    expect(detail?.label).toBe("Bloqueos en p1");
    expect(detail?.title).toContain("Opción guardada sin equivalente");
    expect(detail?.title).not.toContain("saved codes mismatch");
  });
});
