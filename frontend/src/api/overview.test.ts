import { describe, expect, it } from "vitest";
import { normalizeProjectOverview, type ProjectOverview } from "./overview";

function overviewViejo(): ProjectOverview {
  // Solo lo que el normalizador toca; el resto viaja intacto.
  return {
    ok: true,
    schema: "project_overview_v1",
    generated_at: "",
    project: { name: "", client: "", project_file: "", has_project: true, processing_mode: "", saved_at: "" },
    maturity: {
      level: "in_progress",
      has_any_work: true,
      readiness_score: 0,
      ready_count: 0,
      active_count: 0,
      warning_count: 0,
      pending_count: 0,
      total_count: 0,
    },
    metrics: {} as ProjectOverview["metrics"],
    protocol: {} as ProjectOverview["protocol"],
    facts: {} as ProjectOverview["facts"],
    modules: [
      {
        id: "recopiladores",
        label: "Recopiladores",
        route: "/recopiladores?seccion=materiales",
        state: "ready",
        summary: "",
        evidence: [],
        owner: "",
        category: "",
      },
      {
        id: "hojas-ruta",
        label: "Hojas de ruta",
        route: "/hojas-ruta?seccion=entrega",
        state: "active",
        summary: "",
        evidence: [],
        owner: "",
        category: "",
      },
    ],
    added_modules: ["recopiladores", "monitoreo", "material-campo"],
    next_actions: [{ label: "Abrir", route: "/recopiladores", reason: "", state: "pending" }],
    risks: [{ title: "", detail: "", route: "/recopiladores?seccion=accesos", severity: "warning" }],
  };
}

describe("normalizeProjectOverview (ADR 0108)", () => {
  it("lee el slug y las rutas de Recopiladores como Material de campo", () => {
    const out = normalizeProjectOverview(overviewViejo());
    expect(out.modules[0].id).toBe("material-campo");
    expect(out.modules[0].route).toBe("/material-campo?seccion=materiales");
    expect(out.modules[1].route).toBe("/hojas-ruta?seccion=seleccion");
    expect(out.added_modules).toEqual(["material-campo", "monitoreo"]);
    expect(out.next_actions[0].route).toBe("/material-campo");
    expect(out.risks[0].route).toBe("/material-campo?seccion=accesos");
  });

  it("conserva null en added_modules: el proyecto nunca curó su lista", () => {
    const out = normalizeProjectOverview({ ...overviewViejo(), added_modules: null });
    expect(out.added_modules).toBeNull();
  });

  it("tolera listas ausentes sin reventar", () => {
    const roto = { ...overviewViejo(), modules: undefined, risks: undefined } as unknown as ProjectOverview;
    const out = normalizeProjectOverview(roto);
    expect(out.modules).toEqual([]);
    expect(out.risks).toEqual([]);
  });

  describe("facts de Material de campo", () => {
    const bloque = { total: 4, titulares: 3, with_link: 1, without_link: 2, faculties_count: 1, eligible_total: 9 };

    it("backend nuevo: lee `facts[\"material-campo\"]` tal cual", () => {
      const out = normalizeProjectOverview({
        ...overviewViejo(),
        facts: { "material-campo": bloque } as unknown as ProjectOverview["facts"],
      });
      expect(out.facts["material-campo"]).toEqual(bloque);
      expect(out.facts).not.toHaveProperty("recopiladores");
    });

    it("backend viejo: mueve `facts.recopiladores` a `material-campo`", () => {
      const out = normalizeProjectOverview({
        ...overviewViejo(),
        facts: { recopiladores: bloque } as unknown as ProjectOverview["facts"],
      });
      expect(out.facts["material-campo"]).toEqual(bloque);
      expect(out.facts).not.toHaveProperty("recopiladores");
    });

    it("si llegan las dos, manda la vigente", () => {
      const viejo = { ...bloque, total: 99 };
      const out = normalizeProjectOverview({
        ...overviewViejo(),
        facts: { recopiladores: viejo, "material-campo": bloque } as unknown as ProjectOverview["facts"],
      });
      expect(out.facts["material-campo"]).toEqual(bloque);
    });
  });
});
