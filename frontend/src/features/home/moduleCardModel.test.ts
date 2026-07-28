import { describe, expect, it } from "vitest";
import type {
  DisenoEstudioSource,
  ProjectOverview,
} from "../../api/client";
import {
  PROSECNUR_PRIMARY_ACTIVE_MODULES,
  type ProsecnurModuleSlug,
} from "../../lib/modules";
import {
  buildModuleCardView,
  type ModuleCardView,
  type ProcState,
} from "./moduleCardModel";

const NOW = new Date("2026-07-14T12:00:00-05:00").getTime();

const proc: ProcState = {
  done: 1,
  total: 5,
  analiticaDone: 2,
  analiticaTotal: 9,
  ppt: false,
  word: false,
};

function source(
  id: string,
  route: string,
  state: DisenoEstudioSource["state"] = "ready",
): DisenoEstudioSource {
  return {
    id,
    label: id,
    route,
    state,
    summary: `${id}:${state}`,
    evidence: [],
    owner: "test",
    category: "test",
  };
}

function makeOverview(): ProjectOverview {
  return {
    ok: true,
    schema: "project_overview_v1",
    generated_at: "2026-07-14T12:00:00-05:00",
    project: {
      name: "Proyecto de prueba",
      client: "PULSO",
      project_file: "prueba.pulso",
      has_project: true,
      processing_mode: "multibase",
      saved_at: "2026-07-14T11:00:00-05:00",
    },
    maturity: {
      level: "in_progress",
      has_any_work: true,
      readiness_score: 50,
      ready_count: 6,
      active_count: 1,
      warning_count: 0,
      pending_count: 2,
      total_count: 9,
    },
    metrics: {
      bases_count: 2,
      records_count: 999,
      variables_count: 777,
      sample_target_n: 2_088,
      classroom_units_count: 8,
      monitoring_sources_count: 1,
      monitoring_family: "aulas_universitarias",
      monitoreo_last_cut: "2026-07-14T10:00:00-05:00",
    },
    protocol: {
      title: "Proyecto de prueba",
      client: "PULSO",
      client_type: "universidad",
      description: "",
      processing_mode: "multibase",
      active_base: "base_1",
      bases_count: 2,
      instruments_count: 1,
      records_count: 999,
      variables_count: 777,
      sample_components_count: 4,
      sample_target_n: 2_088,
      sample_operational_n: 2_200,
      classroom_units_count: 8,
      route_phase: "field",
      route_outputs_count: 1,
      workplan_title: "",
      workplan_tasks_count: 0,
      workplan_milestones_count: 0,
      workplan_windows_count: 0,
      monitoring_family: "aulas_universitarias",
      monitoring_sources_count: 1,
      project_file: "prueba.pulso",
    },
    facts: {
      bitacora: {
        next_title: "",
        next_date: "",
        pending: 0,
        total_tasks: 0,
        entries_count: 0,
        last_entry_at: "",
        last_entry_title: "",
        decisions_count: 0,
        risks_count: 0,
        blocks_count: 0,
      },
      monitoreo: {
        family: "aulas_universitarias",
        has_snapshot: true,
        collected: 0,
        valid: 8,
        target: 0,
        avance_pct: -1,
        alerts: 8,
      },
      calc: {
        macro_familia: "acreditacion",
        mode: "aulas",
        aulas_titulares: 0,
        students_covered: 64,
        faculties_count: 1,
        territories_count: 0,
        techniques_count: 3,
        actors_count: 4,
      },
      hojas: {
        phase: "field",
        districts_count: 2,
        n_objetivo: 24,
        blocks_count: 0,
        replacement_blocks_count: 0,
        interviews_count: 0,
        quota_assigned: 0,
        from_pilot: false,
      },
      recopiladores: {
        total: 4,
        titulares: 4,
        with_link: 0,
        without_link: 4,
        faculties_count: 1,
        eligible_total: 64,
      },
      editor: {
        source_kind: "xlsform",
        questions_count: 25,
        sections_count: 2,
        catalogs_count: 9,
      },
      dashboard: {
        sections_count: 2,
        excluded_vars_count: 3,
        confirmed: false,
        published: false,
        published_at: "",
        rows_count: 0,
      },
    },
    modules: [
      source("editor-xlsform", "/editor-xlsform"),
      source("carga", "/carga"),
      source("validacion", "/validacion", "pending"),
      source("codificacion", "/codificacion"),
      source("analitica", "/analitica"),
      source("graficos", "/graficos"),
      source("dashboard", "/tablero", "active"),
      source("calc-muestra", "/calc-muestra"),
      source("hojas-ruta", "/hojas-ruta"),
      source("plan-trabajo", "/bitacora?tab=cronograma", "pending"),
      source("recopiladores", "/recopiladores"),
      source("monitoreo", "/monitoreo"),
    ],
    added_modules: PROSECNUR_PRIMARY_ACTIVE_MODULES.map(({ slug }) => slug),
    next_actions: [],
    risks: [],
  } satisfies ProjectOverview;
}

type ContextualView = ModuleCardView & {
  statusLabel?: string;
  action?: { label: string; route: string };
  emphasis?: "activity";
};

function view(
  slug: ProsecnurModuleSlug,
  overview = makeOverview(),
  now = NOW,
): ContextualView {
  const module = PROSECNUR_PRIMARY_ACTIVE_MODULES.find((item) => item.slug === slug);
  if (!module) throw new Error(`Módulo no encontrado: ${slug}`);
  return buildModuleCardView(module, overview, proc, now);
}

describe("moduleCardModel", () => {
  it("mantiene una card contextual para cada módulo del carrusel", () => {
    expect(PROSECNUR_PRIMARY_ACTIVE_MODULES.map(({ slug }) => slug)).toEqual([
      "diseno-estudio",
      "calc-muestra",
      "editor-xlsform",
      "hojas-ruta",
      "recopiladores",
      "monitoreo",
      "procesamiento",
      "dashboard",
    ]);
    for (const module of PROSECNUR_PRIMARY_ACTIVE_MODULES) {
      const card = view(module.slug);
      expect(card.statusLabel, module.slug).toBeTruthy();
      expect(card.action?.label, module.slug).toBeTruthy();
      if (module.slug !== "procesamiento") {
        expect(card.action?.route, module.slug).toBe(module.to);
      }
    }
  });

  it("no declara lista una Bitácora vacía ni la resume con un guion", () => {
    const card = view("diseno-estudio");
    expect(card.state).toBe("pending");
    expect(JSON.stringify(card)).not.toContain("—");
  });

  it("muestra progreso propio en Fichas QR y Dashboard", () => {
    const qr = view("recopiladores");
    expect(qr.viz.kind).toBe("progress");
    expect(JSON.stringify(qr)).toContain("0/4");
    expect(JSON.stringify(qr)).toContain("4");

    const dashboard = view("dashboard");
    expect(dashboard.viz.kind).toBe("progress");
    expect(JSON.stringify(dashboard)).not.toContain("windows");
    expect(JSON.stringify(dashboard)).not.toContain("999");
  });

  it("evita sustituciones cruzadas en Cálculo, Editor y Hojas de ruta", () => {
    const calc = view("calc-muestra");
    expect(calc.viz).not.toMatchObject({ value: "8", label: "aulas titulares" });

    const editor = view("editor-xlsform");
    expect(editor.facts).toContainEqual({ label: "catálogos", value: "9" });
    expect(editor.facts.some(({ label }) => label === "variables")).toBe(false);

    const hojas = view("hojas-ruta");
    expect(hojas.facts).toContainEqual({ label: "n objetivo", value: "24" });
    expect(hojas.facts).not.toContainEqual({ label: "entrevistas", value: "24" });
  });

  it("prioriza el avance accionable de Monitoreo y Procesamiento", () => {
    const monitoreo = view("monitoreo");
    expect(monitoreo.viz).toMatchObject({ kind: "stat", value: "8" });
    expect(monitoreo.action?.route).toBe("/monitoreo");

    const procesamiento = view("procesamiento");
    expect(["progress", "phases"]).toContain(procesamiento.viz.kind);
    expect(procesamiento.action).toMatchObject({ route: "/validacion" });
    expect(JSON.stringify(procesamiento)).toContain("1/5");
  });

  it("conserva advertencias y dirige a la revisión que las resuelve", () => {
    const overview = makeOverview();
    overview.modules = overview.modules.map((item) =>
      ["validacion", "recopiladores", "dashboard"].includes(item.id)
        ? { ...item, state: "warning" }
        : item,
    );

    const procesamiento = view("procesamiento", overview);
    expect(procesamiento).toMatchObject({
      state: "warning",
      statusLabel: "Requiere atención",
      action: { route: "/validacion" },
    });
    expect(procesamiento.alert).toBeTruthy();

    for (const slug of ["recopiladores", "dashboard"] as const) {
      expect(view(slug, overview)).toMatchObject({
        state: "warning",
        statusLabel: "Requiere atención",
      });
    }
  });

  it("no presenta como próxima una fecha pasada del cronograma", () => {
    const overview = makeOverview();
    overview.facts.bitacora = {
      ...overview.facts.bitacora,
      next_title: "Entrega registrada",
      next_date: "2026-07-10",
      pending: 1,
      total_tasks: 1,
    };

    const bitacora = view("diseno-estudio", overview);
    expect(JSON.stringify(bitacora).toLocaleLowerCase("es")).not.toContain("próxim");
    expect(bitacora.facts).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "fecha de cronograma" })]),
    );
    expect(bitacora.facts.find(({ label }) => label === "fecha de cronograma")?.value).toContain("10");
  });

  it("evita un progreso indeterminado 0/0 en Fichas QR", () => {
    const overview = makeOverview();
    overview.facts.recopiladores = {
      ...overview.facts.recopiladores,
      total: 0,
      titulares: 0,
      with_link: 0,
      without_link: 0,
    };

    const qr = view("recopiladores", overview);
    expect(qr.viz.kind).toBe("stat");
    expect(JSON.stringify(qr)).not.toContain("0/0");
  });

  it("abre directamente el cronograma cuando la acción lo nombra", () => {
    const overview = makeOverview();
    overview.facts.bitacora = {
      ...overview.facts.bitacora,
      pending: 1,
      total_tasks: 2,
    };

    expect(view("diseno-estudio", overview).action).toEqual({
      label: "Continuar cronograma",
      route: "/bitacora?tab=cronograma",
    });
  });

  it("calcula hoy y mañana con el calendario de Lima, no con la zona del host", () => {
    const overview = makeOverview();
    overview.facts.bitacora = {
      ...overview.facts.bitacora,
      next_title: "Entrega de mañana",
      next_date: "2026-07-15",
    };
    const nearMidnightInLima = new Date("2026-07-14T23:30:00-05:00").getTime();

    expect(view("diseno-estudio", overview, nearMidnightInLima).viz).toMatchObject({
      kind: "date",
      label: "próximo entregable",
      countdown: "Mañana",
      tone: "future",
    });
  });

  it("mide el avance por lo que falta para la meta, no por la base recorrida", () => {
    // Acreditación: la meta (287) manda; el universo contactado (519) es dato
    // secundario y baja a fact. Regresión: el home mostraba 444.9% contando
    // filas crudas, y luego 36.2% midiendo contra el universo.
    const overview = makeOverview();
    overview.facts.monitoreo = {
      family: "acreditacion",
      has_snapshot: true,
      collected: 519,
      valid: 188,
      target: 287,
      avance_pct: 65.5,
      alerts: 39,
      valid_label: "efectivas",
      collected_label: "universo",
      avance_label: "avance de meta",
    };
    const monitoreo = view("monitoreo", overview);
    expect(monitoreo.viz).toMatchObject({
      kind: "stat",
      value: "65.5%",
      label: "avance de meta",
    });
    expect(monitoreo.sub).toBe("Faltan 99 para la meta · 188 de 287");
    expect(monitoreo.facts).toContainEqual({ label: "universo", value: "519" });
    // La alerta ya no borra el progreso de la sub-línea; viaja en su chip y no
    // se repite ahí (regresión de ruido detectada en la app real).
    expect(monitoreo.alert).toBe("39 por revisar");
    expect(monitoreo.sub).not.toContain("por revisar");
  });

  it("dice que la meta está cumplida en vez de leerla como deuda", () => {
    // PDM telefónico real: 423 efectivas contra una meta de 400. El operativo
    // terminó; la tarjeta no puede sugerir lo contrario.
    const overview = makeOverview();
    overview.facts.monitoreo = {
      family: "telefonico",
      has_snapshot: true,
      collected: 2296,
      valid: 423,
      target: 400,
      avance_pct: 105.8,
      alerts: 0,
      valid_label: "efectivas",
      collected_label: "universo",
      avance_label: "avance de meta",
    };
    const monitoreo = view("monitoreo", overview);
    expect(monitoreo.viz).toMatchObject({ kind: "stat", value: "105.8%" });
    expect(monitoreo.sub).toBe("Meta cumplida · 423 de 400 efectivas");
    expect(monitoreo.sub).not.toContain("Faltan");
    expect(monitoreo.facts).toContainEqual({ label: "universo", value: "2,296" });
  });

  it("cae al vocabulario neutro cuando el backend no manda etiquetas", () => {
    const overview = makeOverview();
    overview.facts.monitoreo = {
      family: "territorial",
      has_snapshot: true,
      collected: 1351,
      valid: 975,
      target: 1200,
      avance_pct: 81.2,
      alerts: 0,
    };
    const monitoreo = view("monitoreo", overview);
    expect(monitoreo.viz).toMatchObject({ kind: "stat", label: "avance de campo" });
    expect(monitoreo.sub).toBe("Faltan 225 para la meta · 975 de 1,200");
    expect(monitoreo.facts).toContainEqual({ label: "recolectados", value: "1,351" });
  });

  it("marca la actividad como señal principal cuando una cifra no explica qué hacer", () => {
    expect(view("monitoreo").emphasis).toBe("activity");
    expect(view("calc-muestra").emphasis).toBe("activity");
    expect(view("diseno-estudio").emphasis).toBe("activity");
    expect(view("editor-xlsform").emphasis).toBeUndefined();
  });
});
