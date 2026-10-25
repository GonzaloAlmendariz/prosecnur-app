import { describe, expect, it } from "vitest";
import { normalizeProjectOverview } from "../../api/overview";
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
      "material-campo": {
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
      source("plan-trabajo", "/bitacora?seccion=cronograma", "pending"),
      source("material-campo", "/material-campo"),
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
      "material-campo",
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

  it("lee los hechos de un backend anterior al ADR 0108 (`facts.recopiladores`)", () => {
    const base = makeOverview();
    const { "material-campo": bloque, ...resto } = base.facts;
    const viejo = { ...base, facts: { ...resto, recopiladores: bloque } } as unknown as typeof base;
    const qr = view("material-campo", normalizeProjectOverview(viejo));
    expect(qr.viz.kind).toBe("progress");
    expect(JSON.stringify(qr)).toContain("0/4");
  });

  it("muestra progreso propio en Material de campo y Dashboard", () => {
    const qr = view("material-campo");
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
      ["validacion", "material-campo", "dashboard"].includes(item.id)
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

    for (const slug of ["material-campo", "dashboard"] as const) {
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

  it("Material de campo resume por campaña cuando el inicio trae `campaigns` (ADR 0111 §9)", () => {
    const crudo = makeOverview() as unknown as { facts: Record<string, Record<string, unknown>> };
    crudo.facts["material-campo"] = {
      ...crudo.facts["material-campo"],
      campaigns: [
        { id: "aulas.principal", tipo: "aulas", name: "Campo en aulas", archived: false, resumen: { unidades: 3, titulares: 3, con_enlace: 2, deployment_status: "draft", plan_desfasado: false } },
        {
          id: "correo.egresados-2026", tipo: "correo", name: "Egresados 2026", archived: false,
          resumen: {
            platform: "surveymonkey", envios: 2, bloques: 9, recipients_loaded: false,
            envios_detalle: [
              { send_id: "invitacion", label: "Invitación", last_export_at: "2026-10-20T15:30:38Z", last_export_platform: "surveymonkey" },
              { send_id: "recordatorio-1", label: "Recordatorio 1", last_export_at: null, last_export_platform: null },
            ],
          },
        },
        { id: "correo.vieja", tipo: "correo", name: "Vieja", archived: true, resumen: null },
      ],
    };
    const card = view("material-campo", normalizeProjectOverview(crudo as unknown as ProjectOverview));
    expect(card.viz).toMatchObject({ kind: "progress", current: 2, total: 3, label: "titulares con enlace" });
    expect(card.sub).toBe("2 campañas: campo en aulas y 1 correo");
    expect(card.facts).toEqual([
      { label: "Campo en aulas", value: "Accesos en borrador" },
      { label: "Egresados 2026", value: "Invitación exportada 20/10 · Recordatorio 1 pendiente" },
    ]);
  });

  it("sin `campaigns` la tarjeta de Material de campo sigue como antes", () => {
    const card = view("material-campo", normalizeProjectOverview(makeOverview()));
    expect(card.facts.map((f) => f.label)).toContain("unidades en el plan");
  });

  it("evita un progreso indeterminado 0/0 en Material de campo", () => {
    const overview = makeOverview();
    overview.facts["material-campo"] = {
      ...overview.facts["material-campo"],
      total: 0,
      titulares: 0,
      with_link: 0,
      without_link: 0,
    };

    const qr = view("material-campo", overview);
    expect(qr.viz.kind).toBe("stat");
    expect(JSON.stringify(qr)).not.toContain("0/0");
  });

  it("Material de campo sin plan habla de unidades, no de aulas titulares", () => {
    const overview = makeOverview();
    overview.facts["material-campo"] = {
      ...overview.facts["material-campo"],
      total: 0,
      titulares: 0,
      with_link: 0,
      without_link: 0,
      faculties_count: 0,
    };
    overview.facts.calc = { ...overview.facts.calc, mode: "territorial" };

    const qr = view("material-campo", overview);
    expect(qr.viz).toMatchObject({ kind: "stat", value: "Sin unidades", label: "en el plan" });
    const texto = JSON.stringify(qr);
    expect(texto).not.toMatch(/aulas|titulares en el plan|Sin titulares/);
    // «facultades» es vocabulario de un plan de aulas: fuera de él no se enseña.
    expect((qr.facts ?? []).map((f) => f.label)).toEqual(["unidades en el plan"]);
  });

  it("Material de campo con plan de aulas conserva sus facultades", () => {
    const labels = (view("material-campo").facts ?? []).map((f) => f.label);
    expect(labels).toEqual(["unidades en el plan", "facultades"]);
  });

  it("la tarjeta de Material de campo lleva el nombre entero y una tagline corta", () => {
    const module = PROSECNUR_PRIMARY_ACTIVE_MODULES.find((item) => item.slug === "material-campo");
    expect(module?.cardTitle).toBe("Material de campo");
    // El rail y los tiles del chrome siguen con el corto: ahí manda el ancho.
    expect(module?.shortLabel).toBe("Material");
    // Comparte la cabecera con el chip «Por iniciar»: tiene que caber entera.
    expect(module?.tagline.length).toBeLessThanOrEqual(28);
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
      route: "/bitacora?seccion=cronograma",
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
    expect(monitoreo.sub).toBe("188 de 287 efectivas, faltan 99");
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
    expect(monitoreo.sub).toBe("423 de 400 efectivas, meta cumplida");
    expect(monitoreo.sub).not.toContain("Faltan");
    expect(monitoreo.facts).toContainEqual({ label: "universo", value: "2,296" });
  });

  it("mientras el tablero se regenera dice «Actualizando» y no publica la cifra vieja como actual (L20)", () => {
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
      regenerando: true,
    } as typeof overview.facts.monitoreo;
    const monitoreo = view("monitoreo", overview);
    expect(monitoreo.statusLabel).toBe("Actualizando");
    expect(monitoreo.viz).toMatchObject({ kind: "stat", value: "Actualizando", label: "avance de meta" });
    expect(JSON.stringify(monitoreo.viz)).not.toContain("105.8");
    expect(monitoreo.sub).toBe("Corte anterior: 423 de 400 efectivas");
  });

  it("el actor rezagado va a su propio pie, sin encadenarlo con «·»", () => {
    const overview = makeOverview();
    overview.facts.monitoreo = {
      family: "acreditacion",
      has_snapshot: true,
      collected: 519,
      valid: 188,
      target: 287,
      avance_pct: 65.5,
      alerts: 0,
      valid_label: "efectivas",
      collected_label: "universo",
      avance_label: "avance de meta",
      actors_count: 4,
      lagging_actor: "Docentes",
      lagging_pct: 12.4,
    };
    const monitoreo = view("monitoreo", overview);
    expect(monitoreo.sub).toBe("188 de 287 efectivas, faltan 99");
    expect(monitoreo.sub).not.toMatch(/[·;]/);
    expect(monitoreo.facts).toContainEqual({ label: "va último", value: "Docentes al 12%" });
  });

  it("un actor que ya cumplió su meta no se nombra como rezagado", () => {
    // acred_conta: Administrativos 15 de 15 (100 %) con el agregado al 145.6 %.
    const overview = makeOverview();
    overview.facts.monitoreo = {
      family: "acreditacion",
      has_snapshot: true,
      collected: 519,
      valid: 418,
      target: 287,
      avance_pct: 145.6,
      alerts: 0,
      valid_label: "efectivas",
      actors_count: 4,
      lagging_actor: "Administrativos",
      lagging_pct: 100,
    };
    const etiquetas = (view("monitoreo", overview).facts ?? []).map((fact) => fact.label);
    expect(etiquetas).not.toContain("va último");
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
    expect(monitoreo.sub).toBe("975 de 1,200 válidos, faltan 225");
    expect(monitoreo.facts).toContainEqual({ label: "recolectados", value: "1,351" });
  });

  it("marca la actividad como señal principal cuando una cifra no explica qué hacer", () => {
    expect(view("monitoreo").emphasis).toBe("activity");
    expect(view("calc-muestra").emphasis).toBe("activity");
    expect(view("diseno-estudio").emphasis).toBe("activity");
    expect(view("editor-xlsform").emphasis).toBeUndefined();
  });
});

describe("la tarjeta no gasta sus ranuras repitiendo el mismo dato", () => {
  it("Material de campo: los pies dicen lo que la barra NO dice", () => {
    // Medido en HSVG2026 el 2026-08-23: la barra marcaba «0/193 fichas con
    // enlace», el subtítulo «193 fichas requieren enlace» y los pies «con
    // enlace 0 · faltantes 193 · facultades 15». La misma pareja de números
    // TRES veces, mientras `total` —las 2.616 unidades del plan— no se
    // enseñaba en ninguna parte.
    const v = view("material-campo");
    const etiquetas = (v.facts ?? []).map((f) => f.label);
    expect(etiquetas).toContain("unidades en el plan");
    expect(etiquetas).not.toContain("con enlace");
    expect(etiquetas).not.toContain("faltantes");
    // Y el dato sigue estando: en la barra, que es donde se lee de un vistazo.
    expect(v.viz).toMatchObject({ kind: "progress", display: "0/4" });
  });

  it("Material de campo: no mete un segundo denominador de elegibles", () => {
    // `eligible_total` cuenta los elegibles de TODAS las unidades y la tarjeta
    // de Cálculo, a diez centímetros, cuenta los de las titulares. Dos
    // denominadores en la misma pantalla es peor que un hueco.
    const etiquetas = (view("material-campo").facts ?? []).map((f) => f.label);
    expect(etiquetas.some((l) => /elegible/i.test(l))).toBe(false);
  });
});

describe("el vocabulario de la tarjeta es el de la app", () => {
  it("Monitoreo de aulas se llama «Cursos-horario», como en todo el módulo", () => {
    // El diccionario decía «Aulas» mientras la barra del módulo, el selector de
    // propósito y las tarjetas del plan dicen «Cursos-horario». Dos nombres
    // para la misma cosa obligan a averiguar si son dos cosas.
    const tipo = (view("monitoreo").facts ?? []).find((f) => f.label === "tipo");
    expect(tipo?.value).toBe("Cursos-horario");
  });
});

describe("la tarjeta no se contradice consigo misma", () => {
  it("Monitoreo: sin fuentes no dice «Tablero operativo conectado»", () => {
    // Medido en HSVG2026: la tarjeta decía «Sin fuentes» en grande y «Tablero
    // operativo conectado» debajo. Las dos salían del mismo payload —el estado
    // del protocolo da «ready» en cuanto se declara la familia, aunque no haya
    // ninguna fuente— y se negaban entre sí.
    const sinFuentes = makeOverview();
    sinFuentes.protocol.monitoring_sources_count = 0;
    // Sin fuentes Y sin casos: es el estado real de un estudio que ya declaró
    // su familia de monitoreo y todavía no ha salido a campo.
    sinFuentes.facts.monitoreo.collected = 0;
    sinFuentes.facts.monitoreo.target = 0;
    sinFuentes.facts.monitoreo.valid = 0;
    sinFuentes.facts.monitoreo.avance_pct = -1;
    // Sin alertas: una alerta SÍ debe mandar sobre el estado —es lo accionable—
    // y taparía el caso que este test mide.
    sinFuentes.facts.monitoreo.alerts = 0;
    const v = view("monitoreo", sinFuentes);
    expect(v.viz).toMatchObject({ value: "Sin fuentes" });
    expect(v.sub).not.toContain("conectado");
    expect(v.sub).toContain("Conecta una fuente");
  });

  it("y con fuentes conectadas la cifra deja de ser el hueco", () => {
    const conFuentes = makeOverview();
    conFuentes.protocol.monitoring_sources_count = 2;
    conFuentes.facts.monitoreo.collected = 0;
    conFuentes.facts.monitoreo.target = 0;
    conFuentes.facts.monitoreo.valid = 0;
    conFuentes.facts.monitoreo.avance_pct = -1;
    conFuentes.facts.monitoreo.alerts = 0;
    const v = view("monitoreo", conFuentes);
    expect(v.viz).not.toMatchObject({ value: "Sin fuentes" });
    expect(v.sub).not.toContain("Conecta una fuente");
  });
});

/**
 * **«Ficha» significaba dos cosas a un click de distancia.**
 *
 * La tarjeta de Recopiladores decía «193 fichas requieren enlace» y «0/193
 * fichas con enlace»; Materiales, un click más allá, dice «0 de 2.616» porque
 * una reserva necesita su ficha impresa el día que su titular cae.
 *
 * Las dos cifras son correctas y miden cosas distintas: el homepage sigue el
 * operativo real —«las reservas son respaldo», dice el motor— y Materiales
 * cuenta lo que se va a imprimir. Lo que estaba mal era la palabra.
 */
describe("la tarjeta de Material de campo nombra lo que cuenta", () => {
  // Se usa el mismo `view()` que el resto del archivo, con el overview base al
  // que se le fija el bloque de Material de campo.
  const conFichas = (over: Partial<Record<string, number>> = {}) => {
    const overview = makeOverview();
    overview.facts = {
      ...(overview.facts ?? {}),
      "material-campo": {
        total: 2616, titulares: 193, with_link: 0, without_link: 193,
        faculties_count: 15, eligible_total: 84110, ...over,
      },
    } as typeof overview.facts;
    return view("material-campo", overview);
  };

  it("la barra habla de titulares, no de fichas", () => {
    const card = conFichas();
    expect((card.viz as { label?: string })?.label).toBe("titulares con enlace");
    expect(JSON.stringify(card)).not.toContain("fichas con enlace");
  });

  it("y el subtitulo tambien, en sus dos ramas", () => {
    expect(conFichas().sub).toContain("titulares requieren enlace");
    expect(conFichas({ with_link: 193, without_link: 0 }).sub).toContain("Todos los titulares");
  });

  it("el total del plan sigue visible en los pies: son las 2.616", () => {
    // El denominador del operativo es 193, pero el plan tiene 2.616 y esa es la
    // cifra que cuadra con Materiales.
    expect(JSON.stringify(conFichas().facts)).toContain("2,616");
  });
});
