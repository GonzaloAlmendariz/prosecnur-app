// @vitest-environment happy-dom
/**
 * Caracterización de Validación: grupo "instrumento" (lo que era la pestaña
 * "Reglas del formulario"). Ver arnes.tsx.
 *
 * Fija el plan, la auditoría y los resultados, el panel de una regla abierto
 * por dirección y lo que se guarda al excluir una variable, al construir el
 * plan y al lanzar la auditoría. Desde la rebanada V2 de P6 el plan se ve en
 * Reglas y la auditoría, sus resultados y el panel en Hallazgos; los nombres de
 * los escenarios no cambian, para que las huellas sigan comparables. Desde la
 * rebanada V0 del plan de fidelidad, los tres escenarios del panel por
 * dirección entran con la clave nueva (`pestana=hallazgos&panel=regla`), donde
 * el detalle de transición sigue, y piden lo mismo que antes. El enlace viejo
 * (`pestana=instrumento&panel=regla`) abre Reglas con su foco: lo fija
 * `instrumento_panel-alias-cierra-en-hallazgos`, que conserva su nombre.
 *
 * Rebanada V1 del plan de fidelidad: Reglas es la mesa del catálogo (M3). El
 * plan se lee con "Leer el formulario" (mismo POST), los controles del
 * operativo y los roles viven en sus paneles (`panel=operativo`,
 * `panel=roles`) y las preguntas fuera de la auditoría son una familia de la
 * columna. Los escenarios `reglas_*` fijan lo nuevo de la mesa.
 */
import { describe, expect } from "vitest";
import { useValidacionStore } from "../store";
import {
  Fallo,
  asentar,
  control,
  direccionActual,
  escenario,
  escribir,
  fijar,
  hay,
  montar,
  pulsar,
  prepararGrupo,
  type Ruta,
} from "./arnes";
import {
  DOS_BASES,
  MADRE_E_HIJA,
  RUTAS_EXPLORAR,
  SIN_INSUMOS,
  COLA_TRES_CLASES,
  UNA_BASE,
  estadoInstrumento,
  limpieza,
  rutasInstrumento,
  rutasLimpieza,
} from "./escenarios";

prepararGrupo("instrumento");

const PLAN_CONSTRUIDO: Ruta = ["POST", "/api/validacion/v2/instrumento/plan", {
  ok: true,
  base_nombre: null,
  n_reglas: 6,
  resumen: [],
  plan_preview: [{ id_regla: "R_REQ_EDAD", relational: false }],
  relational_summary: null,
}];
const AUDITORIA_LANZADA: Ruta = ["POST", "/api/validacion/v2/instrumento/auditoria", { ok: true, job_id: "job-auditoria" }];
const EXCLUSION_GUARDADA: Ruta = ["POST", "/api/validacion/v2/instrumento/variables-excluidas", (_url: string, cuerpo: string) => ({
  ok: true,
  base_nombre: null,
  variables: (JSON.parse(cuerpo || "{}") as { variables?: string[] }).variables ?? [],
  opciones: [],
})];

function rutas(plan: boolean, auditoria: boolean, extra: Ruta[] = []): Ruta[] {
  return [...extra, PLAN_CONSTRUIDO, AUDITORIA_LANZADA, EXCLUSION_GUARDADA, ...rutasInstrumento(plan, auditoria), ...RUTAS_EXPLORAR];
}

describe("Validación, Reglas del formulario: estados", () => {
  escenario("instrumento_sin-insumos", "sin formulario ni respuestas: vacío con enlace a Carga", async () => {
    await montar({ estado: SIN_INSUMOS, estudio: UNA_BASE.estudio, pestana: "reglas", rutas: rutas(false, false) });
    fijar("instrumento_sin-insumos");
  });

  escenario("instrumento_sin-plan", "una base sin plan: el vacío del formulario con Leer el formulario", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutas(false, false) });
    expect(hay(".pulso-panel-de-mesa--reglas", "El plan del formulario todavía no se leyó")).toBe(true);
    expect(hay("button", "Leer el formulario")).toBe(true);
    fijar("instrumento_sin-plan");
  });

  escenario("instrumento_plan-sin-auditoria", "plan construido sin auditoría: Hallazgos ofrece Auditar (rebanada V3)", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutas(true, false, rutasLimpieza(limpieza({ auditoria: false }))) });
    expect(hay(".pulso-cabecera-pestana-acciones button", "Auditar")).toBe(true);
    fijar("instrumento_plan-sin-auditoria");
  });

  escenario("instrumento_con-auditoria", "auditoría corrida: la mesa de Hallazgos con Volver a auditar", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutas(true, true, rutasLimpieza(limpieza({ auditoria: true, cola: COLA_TRES_CLASES }))) });
    expect(hay(".pulso-cabecera-pestana-acciones button", "Volver a auditar")).toBe(true);
    fijar("instrumento_con-auditoria");
  });

  // Rebanada V3: el desplegable de las que pasaron sin casos es la línea "N reglas no encontraron casos" con "Ver".
  escenario("instrumento_con-auditoria_despliega-sin-casos", "auditoría corrida: las reglas sin casos se ven en Reglas", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutas(true, true, rutasLimpieza(limpieza({ auditoria: true, cola: COLA_TRES_CLASES }))) });
    expect(hay(".pulso-hz-resto", "reglas no encontraron casos")).toBe(true);
    await pulsar(".pulso-hz-resto button", "Ver");
    expect(direccionActual()).toBe("/validacion?pestana=reglas");
    fijar("instrumento_con-auditoria_despliega-sin-casos");
  });

  escenario("instrumento_error-de-estado", "el estado del formulario falla: error en la pestaña", async () => {
    await montar({
      ...UNA_BASE,
      pestana: "reglas",
      rutas: [["GET", "/api/validacion/v2/instrumento/estado", new Fallo("E_PRUEBA", "No se pudo leer el plan")], ...rutas(true, true)],
    });
    fijar("instrumento_error-de-estado");
  });

  escenario("instrumento_dos-bases", "dos bases: la base activa viaja en cada pedido", async () => {
    await montar({ ...DOS_BASES, pestana: "hallazgos", rutas: rutas(true, true, rutasLimpieza(limpieza({ auditoria: true, cola: COLA_TRES_CLASES }))) });
    fijar("instrumento_dos-bases");
  });

  escenario("instrumento_madre-e-hija", "madre con hija de un grupo repetido: auditoría sobre la hija", async () => {
    await montar({ ...MADRE_E_HIJA, pestana: "hallazgos", rutas: rutas(true, true, rutasLimpieza(limpieza({ auditoria: true, cola: COLA_TRES_CLASES }))) });
    fijar("instrumento_madre-e-hija");
  });
});

// Rebanada V3: el detalle de transición de Hallazgos (`panel=regla`) se retiró. El
// enlace viejo abre el hallazgo de esa regla en la cola, sin panel; una regla que no
// está en la cola abre el primero por decidir. Clic en la cola escribe el foco.
describe("Validación, Reglas del formulario: panel de la regla", () => {
  const CON_COLA = () => rutas(true, true, rutasLimpieza(limpieza({ auditoria: true, cola: COLA_TRES_CLASES })));

  escenario("instrumento_panel-por-direccion_con-casos", "panel=regla con foco en una regla con casos: abre su hallazgo, sin panel", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=hallazgos&panel=regla&foco=R_REQ_EDAD", rutas: CON_COLA() });
    expect(direccionActual()).toBe("/validacion?pestana=hallazgos&foco=R_REQ_EDAD");
    expect(hay(".pulso-panel-de-mesa--hallazgo .pulso-panel-de-mesa-titulo", "Edad obligatoria")).toBe(true);
    fijar("instrumento_panel-por-direccion_con-casos");
  });

  escenario("instrumento_panel-por-direccion_sin-casos", "panel=regla con foco en una regla sin casos: abre el primero por decidir", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=hallazgos&panel=regla&foco=R_SALTO_P21", rutas: CON_COLA() });
    expect(direccionActual()).toBe("/validacion?pestana=hallazgos&foco=R_SALTO_P21");
    expect(hay(".pulso-panel-de-mesa--hallazgo .pulso-panel-de-mesa-titulo", "Edad entre 16 y 25")).toBe(true);
    fijar("instrumento_panel-por-direccion_sin-casos");
  });

  escenario("instrumento_panel-por-direccion_inexistente", "panel=regla con foco en una regla que no está: abre el primero por decidir", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=hallazgos&panel=regla&foco=R_NO_ESTA", rutas: CON_COLA() });
    expect(hay(".pulso-panel-de-mesa--hallazgo .pulso-panel-de-mesa-titulo", "Edad entre 16 y 25")).toBe(true);
    fijar("instrumento_panel-por-direccion_inexistente");
  });

  escenario("instrumento_panel-por-clic", "clic en un hallazgo de la cola: la dirección nombra su foco", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: CON_COLA() });
    await pulsar("button.pulso-hz-fila", "Edad obligatoria");
    expect(direccionActual()).toBe("/validacion?pestana=hallazgos&foco=R_REQ_EDAD");
    fijar("instrumento_panel-por-clic");
  });

  // El nombre se conserva para que la huella siga comparable; el comportamiento
  // cambió a propósito (plan de fidelidad, rebanada V0): el enlace viejo al
  // detalle de una regla abre Reglas con su foco, sin abrir un panel, y la
  // dirección no se reescribe al abrir.
  escenario("instrumento_panel-alias-cierra-en-hallazgos", "el enlace viejo al detalle de una regla abre Reglas, sin panel", async () => {
    const entrada = "/validacion?pestana=instrumento&panel=regla&foco=R_REQ_EDAD";
    await montar({ ...UNA_BASE, entrada, rutas: rutas(true, true) });
    expect(document.querySelector("#validacion-tab-reglas")?.getAttribute("aria-selected")).toBe("true");
    expect(hay('button[aria-label="Cerrar panel"]')).toBe(false);
    expect(direccionActual()).toBe(entrada);
    // Plan de fidelidad, rebanada V1: el foco es la ficha de esa regla en su familia.
    expect(hay(".pulso-panel-de-mesa--ficha .pulso-panel-de-mesa-titulo", 'Regla de "Edad en años cumplidos"')).toBe(true);
    expect(hay('.pulso-rl-familia[aria-current="true"]', "Obligatorias")).toBe(true);
    fijar("instrumento_panel-alias-cierra-en-hallazgos");
  });
});

// Revisión de V2 (B1): los controles del operativo viven en Reglas y la
// auditoría en Hallazgos. Un cambio sin aplicar sobrevive al cambio de pestaña
// y bloquea la auditoría con su causa.
describe("Validación, controles del operativo sin aplicar entre pestañas", () => {
  escenario("instrumento_controles-sin-aplicar-entre-pestanas", "un control editado en Reglas bloquea la auditoría en Hallazgos y sigue al volver", async () => {
    const SWITCH = 'button[role="switch"][aria-label="Declarar Identidad del caso"]';
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutas(true, true, rutasLimpieza(limpieza({ auditoria: true, cola: COLA_TRES_CLASES }))) });
    // Los roles viven en su panel, que se abre desde la familia "Del operativo" (D-F7b).
    await pulsar(".pulso-rl-familias-accesos button", "Cómo se identifica un caso");
    expect(direccionActual()).toBe("/validacion?pestana=reglas&panel=roles");
    expect(control(SWITCH).getAttribute("aria-checked")).toBe("false");
    await pulsar(SWITCH);
    expect(control(SWITCH).getAttribute("aria-checked")).toBe("true");
    expect(hay("button", "Aplicar y reconstruir el plan")).toBe(true);
    await pulsar('button[aria-label="Cerrar cómo se identifica un caso"]');
    // Con cambios sin aplicar, Auditar se bloquea y la franja dice por qué.
    expect((control(".pulso-cabecera-pestana-acciones button", "Auditar") as HTMLButtonElement).disabled).toBe(true);
    expect(hay(".pulso-franja-aviso", "Los controles del operativo tienen cambios sin aplicar")).toBe(true);

    await pulsar("#validacion-tab-hallazgos");
    // Rebanada V3: "Volver a auditar" se bloquea con su causa y el aviso lleva a los controles.
    const volver = control(".pulso-cabecera-pestana-acciones button", "Volver a auditar") as HTMLButtonElement;
    expect(volver.disabled).toBe(true);
    expect(volver.getAttribute("title")).toBe("Los controles del operativo tienen cambios sin aplicar.");
    expect(hay(".pulso-hz-franja-avisos", "Los controles del operativo tienen cambios sin aplicar")).toBe(true);

    await pulsar(".pulso-hz-franja-avisos button", "Revisar los controles");
    expect(direccionActual()).toBe("/validacion?pestana=reglas&panel=operativo");
    expect(hay("button", "Aplicar y reconstruir el plan")).toBe(true);
    await pulsar('button[aria-label="Cerrar los controles del operativo"]');
    await pulsar(".pulso-rl-familias-accesos button", "Cómo se identifica un caso");
    expect(control(SWITCH).getAttribute("aria-checked")).toBe("true");
    fijar("instrumento_controles-sin-aplicar-entre-pestanas");
  });

  escenario("instrumento_controles-sin-aplicar-por-base", "el cambio sin aplicar de una base no aparece en la otra", async () => {
    const SWITCH = 'button[role="switch"][aria-label="Declarar Identidad del caso"]';
    await montar({ ...DOS_BASES, entrada: "/validacion?pestana=reglas&panel=roles", rutas: rutas(true, true) });
    await pulsar(SWITCH);
    expect(control(SWITCH).getAttribute("aria-checked")).toBe("true");
    // La otra base pasa a ser la activa en el backend; el store no se reinicia.
    await montar({
      estado: { ...DOS_BASES.estado, active_base: "docentes" },
      estudio: { ...DOS_BASES.estudio, active_base: "docentes" },
      entrada: "/validacion?pestana=reglas&panel=roles",
      rutas: rutas(true, true),
    });
    expect(useValidacionStore.getState().baseNombre).toBe("docentes");
    expect(control(SWITCH).getAttribute("aria-checked")).toBe("false");
    expect((control("button", "Aplicar y reconstruir el plan") as HTMLButtonElement).disabled).toBe(true);
    // Lo editado en la otra base sigue guardado para ella.
    expect(Object.keys(useValidacionStore.getState().controlesSinAplicar)).toEqual(["estudiantes"]);
    fijar("instrumento_controles-sin-aplicar-por-base");
  });
});

// QA dentro de la app de V2 (punto 1, C5): al terminar la auditoría en
// Hallazgos, la mesa (banda Decisiones y cola) se vuelve a leer sin salir de la pestaña.
describe("Validación, Hallazgos tras ejecutar la auditoría", () => {
  escenario("instrumento_auditoria-refresca-la-cola", "al terminar la auditoría la cola muestra los hallazgos sin cambiar de pestaña", async () => {
    let auditada = false;
    const JOB_TERMINADO = {
      id: "job-auditoria", kind: "validacion.v2.auditoria", status: "done", started_at: "2026-01-01T00:00:00Z",
      finished_at: "2026-01-01T00:00:01Z", has_file_result: false, result_filename: null, result_data: {}, progress: null, error: "",
    };
    // Rebanada V3: "Auditar" lanza la auditoría completa (`POST /auditoria`, antes `/instrumento/auditoria`).
    const conEstado: Ruta[] = [
      ["POST", "/api/validacion/v2/auditoria", () => {
        auditada = true;
        return { ok: true, job_id: "job-auditoria", n_reglas: 6, n_plan: 6, n_propias: 0 };
      }],
      ["GET", "/api/jobs/job-auditoria", JOB_TERMINADO],
      ["GET", "/api/validacion/v2/instrumento/estado", () => estadoInstrumento(true, auditada)],
      ["GET", "/api/validacion/v2/limpieza", () => limpieza({ auditoria: auditada, cola: auditada ? COLA_TRES_CLASES : [] })],
    ];
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: [...conEstado, ...rutas(true, false), ...rutasLimpieza(limpieza({ auditoria: false }))] });
    expect(hay(".pulso-panel-de-mesa--cola", "La base no se ha auditado")).toBe(true);
    await pulsar(".pulso-cabecera-pestana-acciones button", "Auditar");
    await asentar(20);
    expect(direccionActual()).toBe("/validacion?pestana=hallazgos");
    expect(hay(".pulso-cabecera-pestana-acciones button", "Volver a auditar")).toBe(true);
    expect(hay(".pulso-panel-de-mesa--cola", "La base no se ha auditado")).toBe(false);
    expect(control(".pulso-panel-de-mesa--cola .pulso-panel-de-mesa-conteo").textContent).toBe("3");
    fijar("instrumento_auditoria-refresca-la-cola");
  });
});

describe("Validación, Reglas del formulario: lo que se guarda", () => {
  escenario("instrumento_construir-plan", "leer el formulario manda la configuración del operativo", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutas(false, false) });
    await pulsar("button", "Leer el formulario");
    fijar("instrumento_construir-plan");
  });

  // Rebanada V3: lanza la auditoría completa (`POST /auditoria`), como "Auditar" en Reglas.
  escenario("instrumento_ejecutar-auditoria", "ejecutar la auditoría lanza el trabajo", async () => {
    await montar({
      ...UNA_BASE,
      pestana: "hallazgos",
      rutas: rutas(true, false, [
        ["POST", "/api/validacion/v2/auditoria", { ok: true, job_id: "job-auditoria", n_reglas: 6, n_plan: 6, n_propias: 0 }],
        ...rutasLimpieza(limpieza({ auditoria: false })),
      ]),
    });
    await pulsar(".pulso-cabecera-pestana-acciones button", "Auditar");
    fijar("instrumento_ejecutar-auditoria");
  });

  // Rebanada V3: las preguntas fuera de la auditoría viven en Reglas (familia propia, D-F7c).
  escenario("instrumento_excluir-variable", "excluir una variable pide el motivo y lo manda", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&familia=fuera-de-auditoria", rutas: rutas(true, true) });
    await pulsar('button[role="switch"][aria-label="Excluir edad"]');
    expect(hay('input[aria-label="Motivo para excluir edad"]')).toBe(true);
    await escribir('input[aria-label="Motivo para excluir edad"]', "La edad se valida en otra base");
    await pulsar(".pulso-dialog__actions button", "Excluir");
    fijar("instrumento_excluir-variable");
  });

  escenario("instrumento_reponer-variable", "reponer una variable excluida no pide motivo", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&familia=fuera-de-auditoria", rutas: rutas(true, true) });
    expect(control('button[role="switch"][aria-label="Excluir obs_campo"]').getAttribute("aria-checked")).toBe("true");
    await pulsar('button[role="switch"][aria-label="Excluir obs_campo"]');
    fijar("instrumento_reponer-variable");
  });
});

// Plan de fidelidad, rebanada V1: la mesa de Reglas con el catálogo (M3).
describe("Validación, Reglas: la mesa del catálogo", () => {
  const ACTIVA: Ruta = ["PATCH", /^\/api\/validacion\/v2\/instrumento\/regla\/[^/]+\/activa$/, (url: string, cuerpo: string) => ({
    ok: true, id_regla: decodeURIComponent(url.split("/").at(-2) ?? ""), activa: (JSON.parse(cuerpo || "{}") as { activa?: boolean }).activa ?? true, n_desactivadas: 1,
  })];

  escenario("reglas_familia-saltos", "familia=salto abre los saltos y la ficha con sus dos sentidos y su base", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&familia=salto", rutas: rutas(true, true) });
    expect(hay('.pulso-rl-familia[aria-current="true"]', "Saltos")).toBe(true);
    expect(hay(".pulso-panel-de-mesa--ficha .pulso-rl-sentido", "Le correspondía y está vacía")).toBe(true);
    expect(hay(".pulso-panel-de-mesa--ficha .pulso-rl-hechos", "64 a quienes les correspondía responder")).toBe(true);
    expect(hay(".pulso-panel-de-mesa--ficha .pulso-rl-expresion", "${p4} = '1'")).toBe(true);
    expect(hay(".pulso-cifras-pestana", "8 nov")).toBe(true);
    fijar("reglas_familia-saltos");
  });

  escenario("reglas_sin-evaluar-convierte", "una regla sin evaluar dice por qué y se convierte en regla propia", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&familia=sin-evaluar&foco=R_ODK_RAW", rutas: rutas(true, true) });
    expect(hay('.pulso-table [role="row"], .pulso-table tr', "Expresión que no se pudo leer")).toBe(true);
    expect(hay(".pulso-panel-de-mesa--ficha", "Por qué no se evaluó")).toBe(true);
    await pulsar(".pulso-panel-de-mesa--ficha button", "Convertir en regla propia");
    expect(direccionActual()).toBe("/validacion?pestana=reglas&familia=sin-evaluar&panel=regla&foco=nueva&pregunta=q9");
    fijar("reglas_sin-evaluar-convierte");
  });

  escenario("reglas_desactiva-con-motivo", "desactivar una regla del formulario pide el motivo y lo manda por su ruta", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&familia=obligatoria", rutas: [ACTIVA, ...rutas(true, true)] });
    await pulsar('button[role="switch"][aria-label^="Desactivar la regla"]');
    expect(hay('[role="dialog"]', "Motivo para desactivar la regla")).toBe(true);
    expect((control(".pulso-dialog__actions button", "Desactivar") as HTMLButtonElement).disabled).toBe(true);
    await escribir('input[aria-label="Motivo para desactivar la regla"]', "Se revisa en el consolidado");
    await pulsar(".pulso-dialog__actions button", "Desactivar");
    fijar("reglas_desactiva-con-motivo");
  });

  escenario("reglas_excluye-pregunta", "dejar una pregunta fuera de la auditoría desde su familia manda lo mismo que antes", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=reglas&familia=fuera-de-auditoria", rutas: rutas(true, true) });
    await pulsar('button[role="switch"][aria-label="Excluir edad"]');
    await escribir('input[aria-label="Motivo para excluir edad"]', "La edad se valida en otra base");
    await pulsar(".pulso-dialog__actions button", "Excluir");
    fijar("reglas_excluye-pregunta");
  });

  escenario("reglas_audita", "Auditar lanza la auditoría completa y relee la mesa al terminar", async () => {
    const JOB = {
      id: "job-aud", kind: "validacion.v2.auditoria", status: "done", started_at: "2026-01-01T00:00:00Z",
      finished_at: "2026-01-01T00:00:01Z", has_file_result: false, result_filename: null, result_data: {}, progress: null, error: "",
    };
    await montar({
      ...UNA_BASE,
      pestana: "reglas",
      rutas: [
        ["POST", "/api/validacion/v2/auditoria", { ok: true, job_id: "job-aud", n_reglas: 6, n_plan: 6, n_propias: 0 }],
        ["GET", "/api/jobs/job-aud", JOB],
        ...rutas(true, true),
      ],
    });
    await pulsar(".pulso-cabecera-pestana-acciones button", "Auditar");
    await asentar(20);
    expect(direccionActual()).toBe("/validacion?pestana=reglas");
    fijar("reglas_audita");
  });
});
