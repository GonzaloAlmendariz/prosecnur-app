// @vitest-environment happy-dom
/** Caracterización de Carga: grupo "fuentes". Ver arnes.tsx. */
import { describe } from "vitest";
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
  estudio,
  fijar,
  montar,
  prepararGrupo,
  pulsar,
  rutasDeMonitoreo,
  rutasDeRevision,
} from "./arnes";

prepararGrupo("fuentes");

escenariosDeMatriz("fuentes");

describe("CargaPage, una base: Fuentes por origen y en curso", () => {
  escenario("una-base_fuentes_plataforma", "Plataforma, antes de leer el catálogo", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    await pulsar(ORIGEN, "Plataforma");
    fijar("una-base_fuentes_plataforma");
  });

  escenario("una-base_fuentes_plataforma-catalogo-sm", "Plataforma, catálogo de SurveyMonkey leído", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    await pulsar(ORIGEN, "Plataforma");
    await pulsar("button.pulso-platform-load");
    fijar("una-base_fuentes_plataforma-catalogo-sm");
  });

  escenario("una-base_fuentes_plataforma-catalogo-kobo", "Plataforma, catálogo de KoboToolbox leído y segundo proyecto elegido", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    await pulsar(ORIGEN, "Plataforma");
    await pulsar(".pulso-platform-provider-tabs button", "KoboToolbox");
    await pulsar("button.pulso-platform-load");
    await pulsar("button.pulso-platform-row", "Piloto de hogares");
    fijar("una-base_fuentes_plataforma-catalogo-kobo");
  });

  escenario("una-base_fuentes_plataforma-importando", "Plataforma, importando la encuesta elegida", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    await pulsar(ORIGEN, "Plataforma");
    await pulsar("button.pulso-platform-load");
    await pulsar("button.pulso-platform-import-button");
    fijar("una-base_fuentes_plataforma-importando");
  });

  escenario("una-base_fuentes_plataforma-sin-conexion", "Plataforma sin conexiones", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes", rutas: [["GET", "/api/connections", { ok: true, connections: [] }]] });
    await pulsar(ORIGEN, "Plataforma");
    fijar("una-base_fuentes_plataforma-sin-conexion");
  });

  escenario("una-base_fuentes_monitoreo", "Monitoreo, antes de revisar", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    await pulsar(ORIGEN, "Monitoreo");
    fijar("una-base_fuentes_monitoreo");
  });

  escenario("una-base_fuentes_monitoreo-telefonico-sin-formulario", "Monitoreo telefónico: trabajo de campo con formulario pendiente de subir", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes", rutas: rutasDeMonitoreo("telefonico", "needs_upload") });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    fijar("una-base_fuentes_monitoreo-telefonico-sin-formulario");
  });

  escenario("una-base_fuentes_monitoreo-territorial-listo", "Monitoreo territorial: trabajo de campo listo que reemplaza la base actual", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "fuentes", rutas: rutasDeMonitoreo("territorial", "local", true) });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    fijar("una-base_fuentes_monitoreo-territorial-listo");
  });

  escenario("una-base_fuentes_monitoreo-territorial-trayendo", "Monitoreo territorial: trayendo el trabajo de campo", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "fuentes", rutas: rutasDeMonitoreo("territorial", "local", true) });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    await pulsar("button.pulso-carga-handoff-primary");
    fijar("una-base_fuentes_monitoreo-territorial-trayendo");
  });

  escenario("una-base_fuentes_monitoreo-acreditacion", "Monitoreo de acreditación: asignaciones y creación conjunta", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes", rutas: rutasDeMonitoreo("acreditacion", "local") });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    fijar("una-base_fuentes_monitoreo-acreditacion");
  });

  escenario("una-base_fuentes_subiendo-formulario", "subiendo el formulario", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    await elegirArchivo(ARCHIVO_FORMULARIO, "formulario.xlsx");
    fijar("una-base_fuentes_subiendo-formulario");
  });

  escenario("una-base_fuentes_formulario-subido", "formulario subido, respuestas en espera", async () => {
    await montar({
      estado: UNA_BASE_VACIA,
      pestana: "fuentes",
      rutas: SUBIDA,
      trasRefrescar: [estado({ xlsform: true, instrumento_parsed: true })],
    });
    await elegirArchivo(ARCHIVO_FORMULARIO, "formulario.xlsx");
    fijar("una-base_fuentes_formulario-subido");
  });

  escenario("una-base_fuentes_respuestas-subidas", "formulario y respuestas subidos, con mapeo de códigos por confirmar", async () => {
    await montar({
      estado: UNA_BASE_VACIA,
      pestana: "fuentes",
      rutas: [...SUBIDA, ...rutasDeRevision(true)],
      trasRefrescar: [estado({ xlsform: true, instrumento_parsed: true }), UNA_BASE_COMPLETA],
    });
    await elegirArchivo(ARCHIVO_FORMULARIO, "formulario.xlsx");
    await elegirArchivo(ARCHIVO_RESPUESTAS, "respuestas.xlsx");
    fijar("una-base_fuentes_respuestas-subidas");
  });

  escenario("una-base_fuentes_respuestas-sin-formulario", "respuestas elegidas sin formulario: aviso de orden", async () => {
    await montar({ estado: estado({ data: true }), pestana: "fuentes" });
    // La tarjeta de respuestas está deshabilitada; se fuerza el cambio para ver el aviso.
    await elegirArchivo(ARCHIVO_RESPUESTAS, "respuestas.xlsx");
    fijar("una-base_fuentes_respuestas-sin-formulario");
  });

  escenario("una-base_fuentes_plan-de-varias-bases", "con varias bases declaradas en Plan y sin estudio todavía", async () => {
    useCargaStore.getState().setTopologyIntent("separate");
    await montar({ estado: UNA_BASE_VACIA, pestana: "fuentes" });
    fijar("una-base_fuentes_plan-de-varias-bases");
  });
});

describe("CargaPage, varias bases: Fuentes por origen y en curso", () => {
  for (const origen of ["Plataforma", "Monitoreo"]) {
    escenario(`varias_integradas_fuentes_${origen.toLowerCase()}`, `formulario compartido, origen ${origen}`, async () => {
      await montar({ ...VARIAS_INTEGRADAS, pestana: "fuentes" });
      await pulsar(ORIGEN, origen);
      fijar(`varias_integradas_fuentes_${origen.toLowerCase()}`);
    });
  }

  escenario("varias_integradas_fuentes_monitoreo-acreditacion", "formulario compartido, Monitoreo de acreditación revisado", async () => {
    await montar({ ...VARIAS_INTEGRADAS, pestana: "fuentes", rutas: rutasDeMonitoreo("acreditacion", "local") });
    await pulsar(ORIGEN, "Monitoreo");
    await pulsar("button", "Revisar Monitoreo");
    fijar("varias_integradas_fuentes_monitoreo-acreditacion");
  });

  for (const [rotulo, clave] of [
    ["SurveyMonkey", "surveymonkey"],
    ["KoboToolbox", "kobo"],
    ["Archivos", "archivos"],
    ["Archivo .sav", "sav"],
    ["Monitoreo", "monitoreo"],
  ]) {
    escenario(`varias_separadas_fuentes_agregar-${clave}`, `bases separadas, Agregar base desde ${rotulo}`, async () => {
      await montar({ ...VARIAS_SEPARADAS, pestana: "fuentes" });
      await pulsar("button.pulso-button--primary", "Agregar base");
      await pulsar("button.pulso-bde-origen-opcion", rotulo);
      fijar(`varias_separadas_fuentes_agregar-${clave}`);
    });
  }

  escenario("varias_separadas_fuentes_importando", "bases separadas, importando una encuesta como base nueva", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "fuentes" });
    await pulsar("button.pulso-button--primary", "Agregar base");
    await pulsar("button.pulso-bde-origen-opcion", "SurveyMonkey");
    await pulsar("button.pulso-platform-load");
    await pulsar("button.pulso-platform-import-button");
    fijar("varias_separadas_fuentes_importando");
  });

  escenario("varias_independientes_fuentes", "hermanas independientes", async () => {
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
      pestana: "fuentes",
    });
    fijar("varias_independientes_fuentes");
  });
});
