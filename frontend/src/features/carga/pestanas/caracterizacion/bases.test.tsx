// @vitest-environment happy-dom
/**
 * Caracterización de Carga: grupo "bases". Ver arnes.tsx.
 *
 * ADR 0142: Bases reúne lo que eran Plan y Fuentes. Los escenarios que antes
 * entraban por `pestana=plan` o `pestana=fuentes` siguen como escenarios de
 * alias (misma vista, dirección sin reescribir).
 *
 * R2 (P4b): Bases es una colección con inspector. La relación entre las bases
 * es una línea con "Cambiar" (`panel=relacion`); "Agregar base" es un recorrido
 * por pasos (`panel=agregar-base`, el origen en `foco`). Los diálogos se montan
 * en un portal, así que este grupo mide también el marcado del portal.
 *
 * Oleada 15-B (fidelidad al prototipo "carga-bases"): las bases van en filas a
 * todo el ancho, los orígenes para agregar otra están a la vista bajo las filas
 * (`button.pulso-bases-origen-vista`) y el inspector está siempre a la vista:
 * muestra la base del `foco` o, sin foco, la primera.
 */
import { act } from "react";
import { describe, expect, it } from "vitest";
import { useCargaStore } from "../../store";
import {
  ARCHIVO_FORMULARIO,
  ARCHIVO_RESPUESTAS,
  Fallo,
  BASES_DOS,
  MADRE_E_HIJA,
  SUBIDA,
  UNA_BASE_COMPLETA,
  UNA_BASE_VACIA,
  VARIAS_INTEGRADAS,
  VARIAS_SEPARADAS,
  base,
  asentar,
  control,
  direccionActual,
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
  type Ruta,
} from "./arnes";

prepararGrupo("bases", { conPortales: true });

escenariosDeMatriz("bases");
escenariosDeAlias("plan", "bases");
escenariosDeAlias("fuentes", "bases");

const AGREGAR = 'button[data-plf-abrir="agregar-base"]';
const origen = (id: string) => `button.pulso-bases-origen[data-origen="${id}"]`;
/** El origen a la vista bajo las bases (o, sin bases, en la pantalla). */
const origenALaVista = (id: string) => `button.pulso-bases-origen-vista[data-origen="${id}"]`;
const agregarEn = (origenId: string) => `/carga?pestana=bases&panel=agregar-base&foco=${origenId}`;

/** La base `default` que deja la carga simple en el estudio. */
const BASE_UNICA = base("default", {
  n_filas: 421,
  n_columnas: 141,
  xlsform_file_name: "formulario_hogares.xlsx",
  data_file_name: "respuestas_hogares_03_08_26.xlsx",
});
const ESTUDIO_UNA_BASE: Ruta = ["GET", "/api/estudio", estudio([BASE_UNICA], { processing_mode: "multibase", topology_declared: null })];

const SEIS = ["docentes", "estudiantes", "egresados", "empleadores", "administrativos", "autoridades"].map((n, i) => base(n, { n_filas: 100 + i * 37 }));
const VARIAS_SEIS = {
  estado: estado({
    has_estudio: true,
    estudio_processing_mode: "multibase",
    estudio_topology_declared: "separate",
    n_bases: 6,
    bases_nombres: SEIS.map((b) => b.nombre),
    active_base: "docentes",
  }),
  estudio: estudio(SEIS),
};

/** Dos bases separadas, una de SurveyMonkey (recibe otra fuente) y otra de archivos. */
const BASES_SM = [
  base("docentes", { source_kind: "surveymonkey", survey_id: "501", source_title: "Encuesta a docentes", source_channel: "QR en aula", n_filas: 42 }),
  base("estudiantes", { n_filas: 310 }),
];
const VARIAS_SM = { ...VARIAS_SEPARADAS, estudio: estudio(BASES_SM) };

const PUBLICADOS: Ruta = ["GET", "/api/carga/formularios-publicados", {
  ok: true,
  formularios: [{
    form_id: "f1", form_name: "Encuesta a egresados", revision_id: "r1", revision_no: 2,
    published_at: "2026-03-01T00:00:00Z", survey_id: "", campanas: [], logic_status: "", logic_external: false,
    logic_external_herramienta: "", n_campos: 40,
  }],
}];

describe("CargaPage, una base: Agregar base por origen y en curso", () => {
  escenario("una-base_bases_agregar", "sin archivos: el primer paso de Agregar base, por dirección", async () => {
    await montar({ estado: UNA_BASE_VACIA, entrada: "/carga?pestana=bases&panel=agregar-base" });
    fijar("una-base_bases_agregar");
  });

  escenario("una-base_bases_plataforma", "SurveyMonkey desde los orígenes a la vista, antes de leer el catálogo", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases" });
    await pulsar(origenALaVista("surveymonkey"));
    expect(direccionActual()).toBe("/carga?pestana=bases&panel=agregar-base&foco=surveymonkey");
    fijar("una-base_bases_plataforma");
  });

  escenario("una-base_bases_plataforma-catalogo-sm", "SurveyMonkey, catálogo leído", async () => {
    await montar({ estado: UNA_BASE_VACIA, entrada: agregarEn("surveymonkey") });
    await pulsar("button.pulso-platform-load");
    fijar("una-base_bases_plataforma-catalogo-sm");
  });

  escenario("una-base_bases_plataforma-catalogo-kobo", "KoboToolbox, catálogo leído y segundo proyecto elegido", async () => {
    await montar({ estado: UNA_BASE_VACIA, entrada: agregarEn("kobo") });
    await pulsar("button.pulso-platform-load");
    await pulsar("button.pulso-platform-row", "Piloto de hogares");
    fijar("una-base_bases_plataforma-catalogo-kobo");
  });

  escenario("una-base_bases_plataforma-importando", "SurveyMonkey, importando la encuesta elegida", async () => {
    await montar({ estado: UNA_BASE_VACIA, entrada: agregarEn("surveymonkey") });
    await pulsar("button.pulso-platform-load");
    await pulsar("button.pulso-platform-import-button");
    fijar("una-base_bases_plataforma-importando");
  });

  escenario("una-base_bases_plataforma-sin-conexion", "SurveyMonkey sin conexiones", async () => {
    await montar({ estado: UNA_BASE_VACIA, entrada: agregarEn("surveymonkey"), rutas: [["GET", "/api/connections", { ok: true, connections: [] }]] });
    fijar("una-base_bases_plataforma-sin-conexion");
  });

  escenario("una-base_bases_monitoreo", "Monitoreo, antes de revisar", async () => {
    await montar({ estado: UNA_BASE_VACIA, entrada: agregarEn("monitoreo") });
    fijar("una-base_bases_monitoreo");
  });

  escenario("una-base_bases_monitoreo-telefonico-sin-formulario", "Monitoreo telefónico: trabajo de campo con formulario pendiente de subir", async () => {
    await montar({ estado: UNA_BASE_VACIA, entrada: agregarEn("monitoreo"), rutas: rutasDeMonitoreo("telefonico", "needs_upload") });
    await pulsar("button", "Revisar Monitoreo");
    fijar("una-base_bases_monitoreo-telefonico-sin-formulario");
  });

  escenario("una-base_bases_monitoreo-territorial-listo", "Monitoreo territorial: trabajo de campo listo que reemplaza la base actual", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, entrada: agregarEn("monitoreo"), rutas: [...rutasDeMonitoreo("territorial", "local", true), ESTUDIO_UNA_BASE] });
    await pulsar("button", "Revisar Monitoreo");
    fijar("una-base_bases_monitoreo-territorial-listo");
  });

  escenario("una-base_bases_monitoreo-territorial-trayendo", "Monitoreo territorial: trayendo el trabajo de campo", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, entrada: agregarEn("monitoreo"), rutas: [...rutasDeMonitoreo("territorial", "local", true), ESTUDIO_UNA_BASE] });
    await pulsar("button", "Revisar Monitoreo");
    await pulsar("button.pulso-carga-handoff-primary");
    fijar("una-base_bases_monitoreo-territorial-trayendo");
  });

  escenario("una-base_bases_monitoreo-acreditacion", "Monitoreo de acreditación: asignaciones y creación conjunta", async () => {
    await montar({ estado: UNA_BASE_VACIA, entrada: agregarEn("monitoreo"), rutas: rutasDeMonitoreo("acreditacion", "local") });
    await pulsar("button", "Revisar Monitoreo");
    fijar("una-base_bases_monitoreo-acreditacion");
  });

  escenario("una-base_bases_subiendo-formulario", "Archivos: subiendo el formulario", async () => {
    await montar({ estado: UNA_BASE_VACIA, entrada: agregarEn("archivos") });
    await elegirArchivo(ARCHIVO_FORMULARIO, "formulario.xlsx");
    fijar("una-base_bases_subiendo-formulario");
  });

  escenario("una-base_bases_formulario-subido", "Archivos: formulario subido, la tarjeta dice que faltan las respuestas", async () => {
    await montar({
      estado: UNA_BASE_VACIA,
      entrada: agregarEn("archivos"),
      rutas: SUBIDA,
      trasRefrescar: [estado({ xlsform: true, instrumento_parsed: true })],
    });
    await elegirArchivo(ARCHIVO_FORMULARIO, "formulario.xlsx");
    fijar("una-base_bases_formulario-subido");
  });

  escenario("una-base_bases_respuestas-subidas", "Archivos: formulario y respuestas subidos, con mapeo de códigos por confirmar", async () => {
    await montar({
      estado: UNA_BASE_VACIA,
      entrada: agregarEn("archivos"),
      rutas: [...SUBIDA, ...rutasDeRevision(true)],
      trasRefrescar: [estado({ xlsform: true, instrumento_parsed: true }), UNA_BASE_COMPLETA],
    });
    await elegirArchivo(ARCHIVO_FORMULARIO, "formulario.xlsx");
    await elegirArchivo(ARCHIVO_RESPUESTAS, "respuestas.xlsx");
    fijar("una-base_bases_respuestas-subidas");
  });

  escenario("una-base_bases_respuestas-sin-formulario", "Archivos: respuestas elegidas sin formulario, aviso de orden", async () => {
    await montar({ estado: estado({ data: true }), entrada: agregarEn("archivos") });
    // La tarjeta de respuestas está deshabilitada; se fuerza el cambio para ver el aviso.
    await elegirArchivo(ARCHIVO_RESPUESTAS, "respuestas.xlsx");
    fijar("una-base_bases_respuestas-sin-formulario");
  });

  escenario("una-base_bases_sin-estudio", "solo el formulario y sin estudio: una tarjeta que dice lo que falta", async () => {
    await montar({ estado: estado({ xlsform: true, instrumento_parsed: true }), pestana: "bases" });
    fijar("una-base_bases_sin-estudio");
  });

  escenario("una-base_bases_completa", "una base completa: la fila con su cifra; Agregar base abre la relación", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "bases", rutas: [ESTUDIO_UNA_BASE] });
    expect(control(".pulso-bases-fila-cifra").textContent).toBe("421respuestas");
    expect(document.querySelector('header.pulso-tab-heading button[data-plf-abrir="relacion"]')?.textContent).toBe("Agregar base");
    fijar("una-base_bases_completa");
  });

  escenario("una-base_bases_completa-inspector", "una base completa con el inspector abierto", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, entrada: "/carga?pestana=bases&foco=default", rutas: [ESTUDIO_UNA_BASE] });
    fijar("una-base_bases_completa-inspector");
  });

  escenario("una-base_bases_cambiar-archivos", "una base completa: sus archivos, sin el paso de origen", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, entrada: agregarEn("archivos"), rutas: [ESTUDIO_UNA_BASE] });
    fijar("una-base_bases_cambiar-archivos");
  });

  escenario("una-base_bases_relacion", "la relación entre las bases abierta con Cambiar", async () => {
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases" });
    await pulsar('button[data-plf-abrir="relacion"]');
    fijar("una-base_bases_relacion");
  });

  escenario("una-base_bases_plan-de-varias-bases", "con varias bases separadas elegidas y sin estudio todavía", async () => {
    useCargaStore.getState().setTopologyIntent("separate");
    await montar({ estado: UNA_BASE_VACIA, pestana: "bases" });
    fijar("una-base_bases_plan-de-varias-bases");
  });

  // Era "una-base_plan_plan-de-varias-bases" (pestaña Plan, intención integrada).
  escenario("una-base_bases_plan-integrada", "con base integrada elegida y sin estudio todavía, relación abierta", async () => {
    useCargaStore.getState().setTopologyIntent("integrated");
    await montar({ estado: UNA_BASE_VACIA, entrada: "/carga?pestana=bases&panel=relacion" });
    fijar("una-base_bases_plan-integrada");
  });
});

describe("CargaPage, varias bases: colección, inspector y Agregar base", () => {
  for (const clave of ["varias", "monitoreo", "sav"]) {
    escenario(`varias_integradas_bases_${clave}`, `base integrada, Agregar base desde ${clave}`, async () => {
      await montar({ ...VARIAS_INTEGRADAS, pestana: "bases" });
      await pulsar(AGREGAR);
      await pulsar(origen(clave));
      fijar(`varias_integradas_bases_${clave}`);
    });
  }

  escenario("varias_integradas_bases_monitoreo-acreditacion", "base integrada, Monitoreo de acreditación revisado", async () => {
    await montar({ ...VARIAS_INTEGRADAS, entrada: agregarEn("monitoreo"), rutas: rutasDeMonitoreo("acreditacion", "local") });
    await pulsar("button", "Revisar Monitoreo");
    fijar("varias_integradas_bases_monitoreo-acreditacion");
  });

  escenario("varias_integradas_bases_inspector", "base integrada: el inspector dice cómo se unieron sus fuentes", async () => {
    await montar({ ...VARIAS_INTEGRADAS, entrada: "/carga?pestana=bases&foco=integrada" });
    fijar("varias_integradas_bases_inspector");
  });

  escenario("varias_separadas_bases_agregar", "bases separadas: el primer paso de Agregar base", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "bases" });
    await pulsar(AGREGAR);
    fijar("varias_separadas_bases_agregar");
  });

  for (const clave of ["surveymonkey", "kobo", "archivos", "sav", "monitoreo", "varias"]) {
    escenario(`varias_separadas_bases_agregar-${clave}`, `bases separadas, Agregar base desde ${clave}`, async () => {
      await montar({ ...VARIAS_SEPARADAS, pestana: "bases" });
      await pulsar(AGREGAR);
      await pulsar(origen(clave));
      fijar(`varias_separadas_bases_agregar-${clave}`);
    });
  }

  escenario("varias_separadas_bases_agregar-formulario", "bases separadas con un formulario publicado, Agregar base desde él", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "bases", rutas: [PUBLICADOS] });
    await pulsar(AGREGAR);
    await pulsar(origen("formulario"));
    fijar("varias_separadas_bases_agregar-formulario");
  });

  escenario("varias_separadas_bases_importando", "bases separadas, importando una encuesta como base nueva", async () => {
    await montar({ ...VARIAS_SEPARADAS, entrada: agregarEn("surveymonkey") });
    await pulsar("button.pulso-platform-load");
    await pulsar("button.pulso-platform-import-button");
    fijar("varias_separadas_bases_importando");
  });

  escenario("varias_separadas_bases_inspector", "bases separadas: inspector de una base de archivos", async () => {
    await montar({ ...VARIAS_SEPARADAS, entrada: "/carga?pestana=bases&foco=docentes" });
    fijar("varias_separadas_bases_inspector");
  });

  escenario("varias_separadas_bases_inspector-sm", "bases separadas: inspector de una base de SurveyMonkey", async () => {
    await montar({ ...VARIAS_SM, entrada: "/carga?pestana=bases&foco=docentes" });
    fijar("varias_separadas_bases_inspector-sm");
  });

  escenario("varias_separadas_bases_agregar-fuente", "bases separadas: otra encuesta para una base de SurveyMonkey", async () => {
    await montar({ ...VARIAS_SM, entrada: "/carga?pestana=bases&panel=agregar-fuente&foco=docentes" });
    fijar("varias_separadas_bases_agregar-fuente");
  });

  escenario("varias_seis_bases", "seis bases separadas", async () => {
    await montar({ ...VARIAS_SEIS, pestana: "bases" });
    fijar("varias_seis_bases");
  });

  escenario("varias_madre-hija_bases", "madre con grupo repetido: la hija va dentro de su madre", async () => {
    await montar({ ...MADRE_E_HIJA, pestana: "bases" });
    expect(document.querySelectorAll(".pulso-bases-fila")).toHaveLength(1);
    expect(control(".pulso-bases-fila .pulso-bases-hija").textContent).toContain("miembros");
    fijar("varias_madre-hija_bases");
  });

  escenario("varias_madre-hija_bases_inspector-hija", "madre con grupo repetido: inspector de la hija", async () => {
    await montar({ ...MADRE_E_HIJA, entrada: "/carga?pestana=bases&foco=miembros" });
    fijar("varias_madre-hija_bases_inspector-hija");
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

  escenario("varias_independientes_bases_agregar-varias", "hermanas independientes: Varias encuestas a la vez", async () => {
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
      entrada: agregarEn("varias"),
    });
    fijar("varias_independientes_bases_agregar-varias");
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

describe("CargaPage › Bases: interacción por dirección", () => {
  it("sin foco el inspector muestra la primera base, y una fila escribe su foco", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "bases" });
    expect(document.getElementById("pulso-bases-inspector")?.getAttribute("aria-label")).toBe("Detalle de docentes");
    expect(control("button.pulso-bases-fila-abrir", "docentes").getAttribute("aria-current")).toBe("true");
    // El inspector está siempre a la vista: no tiene X.
    expect(document.querySelector('#pulso-bases-inspector button[aria-label^="Cerrar"]')).toBeNull();
    await pulsar("button.pulso-bases-fila-abrir", "estudiantes");
    expect(direccionActual()).toBe("/carga?pestana=bases&foco=estudiantes");
    expect(document.getElementById("pulso-bases-inspector")?.getAttribute("aria-label")).toBe("Detalle de estudiantes");
    expect(control("button.pulso-bases-fila-abrir", "docentes").hasAttribute("aria-current")).toBe(false);
  });

  it("un enlace guardado con foco=<base> abre el inspector de esa base", async () => {
    await montar({ ...VARIAS_SEPARADAS, entrada: "/carga?pestana=bases&foco=estudiantes" });
    expect(document.getElementById("pulso-bases-inspector")?.getAttribute("aria-label")).toBe("Detalle de estudiantes");
    expect(control("button.pulso-bases-fila-abrir", "estudiantes").getAttribute("aria-current")).toBe("true");
  });

  it("la cabecera dice las bases y las respuestas del estudio, y Agregar base abre el recorrido", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "bases" });
    // Número sobre rótulo, como el prototipo y Frecuencias; sin palabra de estado junto al título.
    const cifras = Array.from(document.querySelectorAll(".pulso-bases-cifra-cabecera")).map((c) => `${c.querySelector("dd")?.textContent} ${c.querySelector("dt")?.textContent}`);
    expect(cifras[0]).toBe("2 bases");
    expect(cifras[1]).toMatch(/^\d[\d,]* respuestas$/);
    expect(document.querySelector("header.pulso-tab-heading .pulso-tab-heading-estado")).toBeNull();
    await pulsar('header.pulso-tab-heading button[data-plf-abrir="agregar-base"]');
    expect(direccionActual()).toBe("/carga?pestana=bases&panel=agregar-base");
  });

  it("Cambiar abre la relación entre las bases en panel=relacion", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "bases" });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await pulsar('button[data-plf-abrir="relacion"]');
    expect(direccionActual()).toBe("/carga?pestana=bases&panel=relacion");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("¿Cuántas bases organizará el estudio?");
  });

  it("Agregar una fuente queda deshabilitada con su causa fuera de SurveyMonkey, y habilitada en SurveyMonkey", async () => {
    await montar({ ...VARIAS_SM, entrada: "/carga?pestana=bases&foco=estudiantes" });
    const deshabilitada = control("#pulso-bases-inspector button", "Agregar otra fuente") as HTMLButtonElement;
    expect(deshabilitada.disabled).toBe(true);
    const causa = document.getElementById(deshabilitada.getAttribute("aria-describedby") ?? "");
    expect(causa?.textContent).toBe("Todavía no se pueden unir más fuentes a una base de este origen.");

    await montar({ ...VARIAS_SM, entrada: "/carga?pestana=bases&foco=docentes" });
    const habilitada = control("#pulso-bases-inspector button", "Agregar otra fuente") as HTMLButtonElement;
    expect(habilitada.disabled).toBe(false);
    expect(habilitada.hasAttribute("aria-describedby")).toBe(false);
    await pulsar("#pulso-bases-inspector button", "Agregar otra fuente");
    expect(direccionActual()).toBe("/carga?pestana=bases&foco=docentes&panel=agregar-fuente");
  });

  it("el origen de Agregar base vive en la dirección", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "bases" });
    await pulsar(AGREGAR);
    expect(direccionActual()).toBe("/carga?pestana=bases&panel=agregar-base");
    await pulsar(origen("kobo"));
    expect(direccionActual()).toBe("/carga?pestana=bases&panel=agregar-base&foco=kobo");
    // El foco del recorrido es el origen, no una base: el inspector sigue con la primera.
    expect(document.getElementById("pulso-bases-inspector")?.getAttribute("aria-label")).toBe("Detalle de docentes");
  });

  it("un origen a la vista abre el recorrido ya en ese origen", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "bases" });
    await pulsar(origenALaVista("sav"));
    expect(direccionActual()).toBe("/carga?pestana=bases&panel=agregar-base&foco=sav");
  });

  it("con una base que ya tiene archivos, un origen a la vista abre la relación entre las bases", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "bases", rutas: [ESTUDIO_UNA_BASE] });
    expect(control(".pulso-bases-agregar-desde-titulo").textContent).toBe("Agregar otra base desde");
    await pulsar(origenALaVista("kobo"));
    expect(direccionActual()).toBe("/carga?pestana=bases&panel=relacion");
  });
});

/** Escribe en un campo controlado por React. */
async function escribir(selector: string, valor: string) {
  const campo = control(selector) as HTMLInputElement;
  const fijarValor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    fijarValor?.call(campo, valor);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/**
 * El doble del motor para el estudio de varias bases. `downgrade-to-single`
 * responde como `router_estudio.R`: rechaza con E_MULTIPLE_BASES si el estudio
 * tiene más de una entrada en `bases` (cada hija de grupo repetido cuenta).
 */
function rutasDelEstudio(entradas: number): Ruta[] {
  return [
    ["DELETE", /^\/api\/estudio\/base\//, { ok: true, n_bases: 0 }],
    ["POST", "/api/estudio/downgrade-to-single", entradas > 1
      ? new Fallo("E_MULTIPLE_BASES", "El estudio tiene varias bases. Quita las extras antes de volver al modo simple.")
      : { ok: true }],
    ["PATCH", "/api/estudio", estudio(BASES_DOS, { nombre: "Egresados 2026" })],
  ];
}
const RUTAS_DEL_ESTUDIO = rutasDelEstudio(2);

const UNA_SOLA_EN_VARIAS = {
  estado: estado({
    has_estudio: true,
    estudio_processing_mode: "multibase",
    estudio_topology_declared: "separate",
    n_bases: 1,
    bases_nombres: ["docentes"],
    active_base: "docentes",
  }),
  estudio: estudio([base("docentes")]),
};

describe("CargaPage › Bases: acciones del estudio en la relación entre las bases", () => {
  it("con dos bases la salida es Quitar todas las bases, y quita cada una antes de volver a la carga simple", async () => {
    await montar({ ...VARIAS_SEPARADAS, entrada: "/carga?pestana=bases&panel=relacion", rutas: RUTAS_DEL_ESTUDIO });
    const panel = () => document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(panel()).not.toContain("Volver a una base");
    await pulsar('[role="dialog"] button', "Quitar todas las bases");
    expect(panel()).toContain("Se quitan las 2 bases; sus respuestas dejan de estar en el proyecto. No se puede deshacer.");
    await pulsar('[role="dialog"] .pulso-bases-confirmar button', "Quitar todas las bases");
    expect(pedidosHechos()).toEqual(expect.arrayContaining(["DELETE /api/estudio/base/docentes", "DELETE /api/estudio/base/estudiantes"]));
    expect(pedidosHechos()).not.toContain("POST /api/estudio/downgrade-to-single");
    expect(direccionActual()).toBe("/carga");
  });

  it("con madre e hija la salida es Quitar todas las bases, como cuenta el motor, y lo dice", async () => {
    await montar({ ...MADRE_E_HIJA, entrada: "/carga?pestana=bases&panel=relacion", rutas: rutasDelEstudio(2) });
    const panel = () => document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(panel()).not.toContain("Volver a una base");
    await pulsar('[role="dialog"] button', "Quitar todas las bases");
    expect(panel()).toContain("Se quita la base y su grupo repetido; sus respuestas dejan de estar en el proyecto. No se puede deshacer.");
    await pulsar('[role="dialog"] .pulso-bases-confirmar button', "Quitar todas las bases");
    expect(pedidosHechos()).toEqual(expect.arrayContaining(["DELETE /api/estudio/base/hogares", "DELETE /api/estudio/base/miembros"]));
    expect(pedidosHechos()).not.toContain("POST /api/estudio/downgrade-to-single");
  });

  it("con una sola entrada la salida es Volver a una base y conserva los datos", async () => {
    await montar({ ...UNA_SOLA_EN_VARIAS, entrada: "/carga?pestana=bases&panel=relacion", rutas: rutasDelEstudio(1) });
    const panel = () => document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(panel()).not.toContain("Quitar todas las bases");
    await pulsar('[role="dialog"] button', "Volver a una base");
    expect(panel()).toContain("El formulario y las respuestas quedan como una base.");
    await pulsar('[role="dialog"] .pulso-bases-confirmar button', "Volver a una base");
    expect(pedidosHechos()).toContain("POST /api/estudio/downgrade-to-single");
    expect(pedidosHechos().some((p) => p.startsWith("DELETE"))).toBe(false);
  });

  it("sin bases, Volver a una base no pide confirmación: no hay nada que conservar", async () => {
    const VACIO_EN_VARIAS = {
      estado: estado({ has_estudio: true, estudio_processing_mode: "multibase", estudio_topology_declared: "separate", n_bases: 0, bases_nombres: [], active_base: null }),
      estudio: estudio([]),
    };
    await montar({ ...VACIO_EN_VARIAS, entrada: "/carga?pestana=bases&panel=relacion", rutas: rutasDelEstudio(0) });
    await pulsar('[role="dialog"] button', "Volver a una base");
    expect(document.querySelector('[role="dialog"] .pulso-bases-confirmar')).toBeNull();
    expect(pedidosHechos()).toContain("POST /api/estudio/downgrade-to-single");
  });

  it("si el motor rechaza la vuelta, el panel dice la causa y que el estudio sigue como estaba", async () => {
    // El doble rechaza como si el estudio tuviera más de una entrada.
    await montar({ ...UNA_SOLA_EN_VARIAS, entrada: "/carga?pestana=bases&panel=relacion", rutas: rutasDelEstudio(2) });
    await pulsar('[role="dialog"] button', "Volver a una base");
    await pulsar('[role="dialog"] .pulso-bases-confirmar button', "Volver a una base");
    const panel = document.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(panel).toContain("No se pudo volver a una base");
    expect(panel).toContain("El estudio tiene varias bases. Quita las extras antes de volver al modo simple.");
    expect(panel).toContain("El estudio sigue como estaba.");
  });

  it("el nombre del estudio se cambia en la relación entre las bases", async () => {
    await montar({ ...VARIAS_SEPARADAS, entrada: "/carga?pestana=bases&panel=relacion", rutas: RUTAS_DEL_ESTUDIO });
    await escribir('[role="dialog"] .pulso-bases-estudio-nombre input', "Egresados 2026");
    await pulsar('[role="dialog"] .pulso-bases-estudio-nombre button', "Guardar");
    expect(pedidosHechos()).toContain("PATCH /api/estudio");
  });

  it("el inspector reemplaza el formulario o las respuestas de una base, como la fila de BasesPanel", async () => {
    await montar({ ...VARIAS_SEPARADAS, entrada: "/carga?pestana=bases&foco=docentes" });
    expect(document.querySelector("#pulso-bases-inspector .pulso-base-editor.is-replace")).toBeNull();
    await pulsar("#pulso-bases-inspector button", "Reemplazar archivos");
    expect(document.querySelector("#pulso-bases-inspector .pulso-base-editor.is-replace")).not.toBeNull();
  });
});

/** Dos bases ligadas a la misma revisión publicada: tienen "Ver armonización" y "Comparar con". */
const BASES_LIGADAS = [base("docentes", { instrument_revision_id: "r1" }), base("estudiantes", { instrument_revision_id: "r1", n_filas: 480 })];
const VARIAS_LIGADAS = { ...VARIAS_SEPARADAS, estudio: estudio(BASES_LIGADAS) };
const PUBLICADO_R1: Ruta = ["GET", "/api/carga/formularios-publicados", {
  ok: true,
  formularios: [{
    form_id: "f1", form_name: "Encuesta docente", revision_id: "r1", revision_no: 1,
    published_at: "2026-03-01T00:00:00Z", survey_id: "", campanas: [], logic_status: "", logic_external: false,
    logic_external_herramienta: "", n_campos: 40,
  }],
}];

describe("CargaPage › Bases: funciones que no se pierden (verificación R2)", () => {
  it("Fuentes previstas fija cuántos orígenes admite el asistente de integración", async () => {
    await montar({ ...VARIAS_INTEGRADAS, entrada: agregarEn("varias") });
    const campo = control('[role="dialog"] .pulso-bases-entradas input') as HTMLInputElement;
    expect(document.querySelector('[role="dialog"] .pulso-bases-entradas')?.textContent).toContain("Fuentes previstas");
    expect(campo.value).toBe("2");
    await escribir('[role="dialog"] .pulso-bases-entradas input', "3");
    await asentar();
    expect(document.querySelectorAll('[role="dialog"] .pulso-integrated-origin-row')).toHaveLength(3);
  });

  it("una base con archivos cambia su fuente desde el inspector, con el paso Origen y sus cuatro orígenes", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "bases", rutas: [ESTUDIO_UNA_BASE] });
    await pulsar("button.pulso-bases-fila-abrir");
    await pulsar("#pulso-bases-inspector button", "Cambiar la fuente");
    const dialogo = () => document.querySelector('[role="dialog"]');
    expect(dialogo()?.textContent).toContain("Cambiar la fuente");
    expect(dialogo()?.textContent).toContain("Lo que traigas reemplaza el formulario o las respuestas que tiene la base.");
    expect(Array.from(document.querySelectorAll<HTMLElement>("button.pulso-bases-origen")).map((b) => b.dataset.origen)).toEqual(["archivos", "surveymonkey", "kobo", "monitoreo"]);
    await pulsar(origen("monitoreo"));
    expect(dialogo()?.textContent).toContain("Revisar Monitoreo");
    await pulsar('[role="dialog"] .pulso-stepper button', "Origen");
    await pulsar(origen("surveymonkey"));
    expect(document.querySelector('[role="dialog"] button.pulso-platform-load')).not.toBeNull();
    // Con una base no se ofrece "Formulario publicado": no se pide su catálogo.
    expect(pedidosHechos().some((p) => p.includes("formularios-publicados"))).toBe(false);
  });

  it("la base integrada dice cómo se integró y abre su bitácora sin cerrar el inspector", async () => {
    await montar({ ...VARIAS_INTEGRADAS, entrada: "/carga?pestana=bases&foco=integrada" });
    const inspector = () => document.getElementById("pulso-bases-inspector")?.textContent ?? "";
    expect(inspector()).toContain("Unidas por la columna");
    expect(control("#pulso-bases-inspector .pulso-bases-hechos code").textContent).toBe("publico");
    expect(inspector()).toContain("Formulario guía");
    expect(inspector()).toContain("Respuestas integradas");
    expect(inspector()).toContain("Fraseo final común");
    await pulsar("#pulso-bases-inspector button", "Bitácora de la integración");
    expect(direccionActual()).toBe("/carga?pestana=bases&foco=integrada&panel=bitacora-integracion");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Variables preservadas por origen");
    expect(document.getElementById("pulso-bases-inspector")).not.toBeNull();
  });

  it("Comparar abre y cierra sin perder el inspector, y el foco vuelve al botón", async () => {
    await montar({ ...VARIAS_LIGADAS, entrada: "/carga?pestana=bases&foco=docentes", rutas: [PUBLICADO_R1] });
    await pulsar("#pulso-bases-inspector button", "Comparar con estudiantes");
    expect(direccionActual()).toBe("/carga?pestana=bases&foco=docentes%7Eestudiantes&panel=comparar-fuentes");
    expect(document.getElementById("pulso-bases-inspector")?.getAttribute("aria-label")).toBe("Detalle de docentes");
    await pulsar('[role="dialog"] .pulso-plf-cerrar');
    expect(direccionActual()).toBe("/carga?pestana=bases&foco=docentes");
    expect(document.getElementById("pulso-bases-inspector")?.getAttribute("aria-label")).toBe("Detalle de docentes");
    expect((document.activeElement as HTMLElement | null)?.dataset.plfAbrir).toBe("comparar:docentes");
  });

  it("Ver armonización cierra y deja el inspector de la misma base", async () => {
    await montar({ ...VARIAS_LIGADAS, entrada: "/carga?pestana=bases&foco=docentes", rutas: [PUBLICADO_R1] });
    await pulsar("#pulso-bases-inspector button", "Ver armonización");
    expect(direccionActual()).toBe("/carga?pestana=bases&foco=docentes&panel=armonizacion-base");
    await pulsar('[role="dialog"] .pulso-plf-cerrar');
    expect(direccionActual()).toBe("/carga?pestana=bases&foco=docentes");
    expect(document.getElementById("pulso-bases-inspector")).not.toBeNull();
  });

  it("cada fila controla el inspector y la elegida lo dice con aria-current", async () => {
    await montar({ ...VARIAS_SEPARADAS, entrada: "/carga?pestana=bases&foco=estudiantes" });
    const filas = Array.from(document.querySelectorAll<HTMLElement>("button.pulso-bases-fila-abrir"));
    expect(filas.map((f) => f.getAttribute("aria-controls"))).toEqual(filas.map(() => "pulso-bases-inspector"));
    expect(filas.filter((f) => f.getAttribute("aria-current") === "true").map((f) => f.dataset.baseAbre)).toEqual(["estudiantes"]);
  });

  it("ningún nombre accesible dice el nombre interno de la base única", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, entrada: "/carga?pestana=bases&foco=default", rutas: [ESTUDIO_UNA_BASE] });
    const nombres = Array.from(document.querySelectorAll("[aria-label]")).map((e) => e.getAttribute("aria-label") ?? "");
    expect(nombres.filter((n) => /\bdefault\b/u.test(n))).toEqual([]);
    expect(nombres).toContain("Variables de la base Base única");
  });

  it("la confirmación de Quitar base avisa lo que queda sin datos en Gráficos", async () => {
    await montar({ ...VARIAS_SEPARADAS, entrada: "/carga?pestana=bases&foco=docentes" });
    await pulsar("#pulso-bases-inspector button", "Quitar");
    expect(control("#pulso-bases-inspector .pulso-bases-confirmar").textContent).toContain("Las láminas de Gráficos que usan sus variables se quedan sin datos.");
  });
});

