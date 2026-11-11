// @vitest-environment happy-dom
/**
 * Caracterización de Carga: grupo "bases". Ver arnes.tsx.
 *
 * ADR 0142: Bases reúne lo que eran Plan y Fuentes. Los escenarios que antes
 * entraban por `pestana=plan` o `pestana=fuentes` siguen como escenarios de
 * alias (misma vista, dirección sin reescribir).
 */
import { describe, expect } from "vitest";
import { useCargaStore } from "../../store";
import {
  ARCHIVO_FORMULARIO,
  ARCHIVO_RESPUESTAS,
  BASES_DOS,
  ORIGEN,
  SUBIDA,
  UNA_BASE_COMPLETA,
  UNA_BASE_VACIA,
  VARIAS_INTEGRADAS,
  VARIAS_SEPARADAS,
  base,
  elegirArchivo,
  escenario,
  escenariosDeMatriz,
  estado,
  escenariosDeAlias,
  estudio,
  fijar,
  montar,
  pedidosHechos,
  prepararGrupo,
  pulsar,
  rutasDeMonitoreo,
  rutasDeRevision,
} from "./arnes";

prepararGrupo("bases");

escenariosDeMatriz("bases");
escenariosDeAlias("plan", "bases");
escenariosDeAlias("fuentes", "bases");

describe("CargaPage, una base: Bases por origen y en curso", () => {
  escenario("una-base_bases_plataforma", "Plataforma, antes de leer el catálogo", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases" });
    await pulsar(ORIGEN, "Plataforma");
    fijar("una-base_bases_plataforma");
  });

  escenario("una-base_bases_plataforma-catalogo-sm", "Plataforma, catálogo de SurveyMonkey leído", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases" });
    await pulsar(ORIGEN, "Plataforma");
    await pulsar("button.pulso-platform-load");
    fijar("una-base_bases_plataforma-catalogo-sm");
  });

  escenario("una-base_bases_plataforma-catalogo-kobo", "Plataforma, catálogo de KoboToolbox leído y segundo proyecto elegido", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases" });
    await pulsar(ORIGEN, "Plataforma");
    await pulsar(".pulso-platform-provider-tabs button", "KoboToolbox");
    await pulsar("button.pulso-platform-load");
    await pulsar("button.pulso-platform-row", "Piloto de hogares");
    fijar("una-base_bases_plataforma-catalogo-kobo");
  });

  escenario("una-base_bases_plataforma-importando", "Plataforma, importando la encuesta elegida", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases" });
    await pulsar(ORIGEN, "Plataforma");
    await pulsar("button.pulso-platform-load");
    await pulsar("button.pulso-platform-import-button");
    fijar("una-base_bases_plataforma-importando");
  });

  escenario("una-base_bases_plataforma-sin-conexion", "Plataforma sin conexiones", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases", rutas: [["GET", "/api/connections", { ok: true, connections: [] }]] });
    await pulsar(ORIGEN, "Plataforma");
    fijar("una-base_bases_plataforma-sin-conexion");
  });

  escenario("una-base_bases_monitoreo", "Monitoreo, antes de revisar", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases" });
    await pulsar(ORIGEN, "Monitoreo");
    fijar("una-base_bases_monitoreo");
  });

  escenario("una-base_bases_monitoreo-telefonico-sin-formulario", "Monitoreo telefónico: trabajo de campo con formulario pendiente de subir", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases", rutas: rutasDeMonitoreo("telefonico", "needs_upload") });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    fijar("una-base_bases_monitoreo-telefonico-sin-formulario");
  });

  escenario("una-base_bases_monitoreo-territorial-listo", "Monitoreo territorial: trabajo de campo listo que reemplaza la base actual", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "bases", rutas: rutasDeMonitoreo("territorial", "local", true) });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    fijar("una-base_bases_monitoreo-territorial-listo");
  });

  escenario("una-base_bases_monitoreo-territorial-trayendo", "Monitoreo territorial: trayendo el trabajo de campo", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "bases", rutas: rutasDeMonitoreo("territorial", "local", true) });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    await pulsar("button.pulso-carga-handoff-primary");
    fijar("una-base_bases_monitoreo-territorial-trayendo");
  });

  escenario("una-base_bases_monitoreo-acreditacion", "Monitoreo de acreditación: asignaciones y creación conjunta", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases", rutas: rutasDeMonitoreo("acreditacion", "local") });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    fijar("una-base_bases_monitoreo-acreditacion");
  });

  escenario("una-base_bases_subiendo-formulario", "subiendo el formulario", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases" });
    await elegirArchivo(ARCHIVO_FORMULARIO, "formulario.xlsx");
    fijar("una-base_bases_subiendo-formulario");
  });

  escenario("una-base_bases_formulario-subido", "formulario subido, respuestas en espera", async () => {
    await montar({
      estado: UNA_BASE_VACIA,
      pestana: "bases",
      rutas: SUBIDA,
      trasRefrescar: [estado({ xlsform: true, instrumento_parsed: true })],
    });
    await elegirArchivo(ARCHIVO_FORMULARIO, "formulario.xlsx");
    fijar("una-base_bases_formulario-subido");
  });

  escenario("una-base_bases_respuestas-subidas", "formulario y respuestas subidos, con mapeo de códigos por confirmar", async () => {
    await montar({
      estado: UNA_BASE_VACIA,
      pestana: "bases",
      rutas: [...SUBIDA, ...rutasDeRevision(true)],
      trasRefrescar: [estado({ xlsform: true, instrumento_parsed: true }), UNA_BASE_COMPLETA],
    });
    await elegirArchivo(ARCHIVO_FORMULARIO, "formulario.xlsx");
    await elegirArchivo(ARCHIVO_RESPUESTAS, "respuestas.xlsx");
    fijar("una-base_bases_respuestas-subidas");
  });

  escenario("una-base_bases_respuestas-sin-formulario", "respuestas elegidas sin formulario: aviso de orden", async () => {
    await montar({ estado: estado({ data: true }), pestana: "bases" });
    // La tarjeta de respuestas está deshabilitada; se fuerza el cambio para ver el aviso.
    await elegirArchivo(ARCHIVO_RESPUESTAS, "respuestas.xlsx");
    fijar("una-base_bases_respuestas-sin-formulario");
  });

  escenario("una-base_bases_plan-de-varias-bases", "con varias bases separadas elegidas y sin estudio todavía", async () => {
    useCargaStore.getState().setTopologyIntent("separate");
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases" });
    fijar("una-base_bases_plan-de-varias-bases");
  });

  // Era "una-base_plan_plan-de-varias-bases" (pestaña Plan, intención integrada).
  escenario("una-base_bases_plan-integrada", "con base integrada elegida y sin estudio todavía", async () => {
    useCargaStore.getState().setTopologyIntent("integrated");
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases" });
    fijar("una-base_bases_plan-integrada");
  });
});

describe("CargaPage, varias bases: Bases por origen y en curso", () => {
  for (const origen of ["Plataforma", "Monitoreo"]) {
    escenario(`varias_integradas_bases_${origen.toLowerCase()}`, `formulario compartido, origen ${origen}`, async () => {
      await montar({ ...VARIAS_INTEGRADAS, pestana: "bases" });
      await pulsar(ORIGEN, origen);
      fijar(`varias_integradas_bases_${origen.toLowerCase()}`);
    });
  }

  escenario("varias_integradas_bases_monitoreo-acreditacion", "formulario compartido, Monitoreo de acreditación revisado", async () => {
    await montar({ ...VARIAS_INTEGRADAS, pestana: "bases", rutas: rutasDeMonitoreo("acreditacion", "local") });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    fijar("varias_integradas_bases_monitoreo-acreditacion");
  });

  for (const [rotulo, clave] of [
    ["SurveyMonkey", "surveymonkey"],
    ["KoboToolbox", "kobo"],
    ["Archivos", "archivos"],
    ["Archivo .sav", "sav"],
    ["Monitoreo", "monitoreo"],
  ]) {
    escenario(`varias_separadas_bases_agregar-${clave}`, `bases separadas, Agregar base desde ${rotulo}`, async () => {
      await montar({ ...VARIAS_SEPARADAS, pestana: "bases" });
      await pulsar("button.pulso-button--primary", "Agregar base");
      await pulsar("button.pulso-bde-origen-opcion", rotulo);
      fijar(`varias_separadas_bases_agregar-${clave}`);
    });
  }

  escenario("varias_separadas_bases_importando", "bases separadas, importando una encuesta como base nueva", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "bases" });
    await pulsar("button.pulso-button--primary", "Agregar base");
    await pulsar("button.pulso-bde-origen-opcion", "SurveyMonkey");
    await pulsar("button.pulso-platform-load");
    await pulsar("button.pulso-platform-import-button");
    fijar("varias_separadas_bases_importando");
  });

  escenario("varias_independientes_bases", "hermanas independientes", async () => {
    const bases = BASES_DOS.map((b) => ({ ...b, processing_mode: "independent_siblings", source_kind: "surveymonkey", survey_id: `9${b.n_filas}` }));
    await montar({
      estado: estado({
        has_estudio: true,
        estudio_processing_mode: "independent_siblings",
        estudio_topology_declared: "independent",
        n_bases: 2,
        bases_nombres: ["docentes", "estudiantes"],
        active_base: "docentes",
      }),
      estudio: estudio(bases, { processing_mode: "independent_siblings", topology_declared: "independent" }),
      pestana: "bases",
    });
    fijar("varias_independientes_bases");
  });
});

describe("CargaPage, Bases no pide el catálogo de variables por base", () => {
  // El panel "Variables de la base" ya no se monta en Bases (ADR 0142): Bases
  // no pide `/api/carga/equivalencias/variables`, que fuera de un estudio con
  // equivalencias responde 409.
  for (const [nombre, opciones] of [
    ["varias_separadas_bases_sin-catalogo", VARIAS_SEPARADAS],
    ["varias_integradas_bases_sin-catalogo", VARIAS_INTEGRADAS],
  ] as const) {
    escenario(nombre, `${nombre}: sin pedido del catálogo de variables`, async () => {
      await montar({ ...opciones, pestana: "bases" });
      expect(pedidosHechos().filter((p) => p.includes("/api/carga/equivalencias/variables"))).toEqual([]);
      fijar(nombre);
    });
  }
});
