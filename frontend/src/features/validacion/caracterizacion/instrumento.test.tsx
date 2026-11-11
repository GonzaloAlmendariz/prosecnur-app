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

  escenario("instrumento_sin-plan", "una base sin plan: paso 1 con la secuencia y el botón de construir", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutas(false, false) });
    expect(hay("button", "Construir plan")).toBe(true);
    fijar("instrumento_sin-plan");
  });

  escenario("instrumento_plan-sin-auditoria", "plan construido sin auditoría: pasos 1 y 2", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutas(true, false) });
    expect(hay("button", "Ejecutar auditoría")).toBe(true);
    fijar("instrumento_plan-sin-auditoria");
  });

  escenario("instrumento_con-auditoria", "auditoría corrida: resultados con todos los grupos de reglas", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutas(true, true) });
    expect(hay("button", "Ejecutar de nuevo")).toBe(true);
    fijar("instrumento_con-auditoria");
  });

  escenario("instrumento_con-auditoria_despliega-sin-casos", "auditoría corrida: despliega las validaciones que pasaron", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutas(true, true) });
    await pulsar("button[aria-expanded]", "Validaciones que pasaron");
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
    await montar({ ...DOS_BASES, pestana: "hallazgos", rutas: rutas(true, true) });
    fijar("instrumento_dos-bases");
  });

  escenario("instrumento_madre-e-hija", "madre con hija de un grupo repetido: auditoría sobre la hija", async () => {
    await montar({ ...MADRE_E_HIJA, pestana: "hallazgos", rutas: rutas(true, true) });
    fijar("instrumento_madre-e-hija");
  });
});

describe("Validación, Reglas del formulario: panel de la regla", () => {
  escenario("instrumento_panel-por-direccion_con-casos", "panel=regla con foco en una regla con casos: carga sus casos", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=hallazgos&panel=regla&foco=R_REQ_EDAD", rutas: rutas(true, true) });
    fijar("instrumento_panel-por-direccion_con-casos");
  });

  escenario("instrumento_panel-por-direccion_sin-casos", "panel=regla con foco en una regla sin casos: solo la explicación", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=hallazgos&panel=regla&foco=R_SALTO_P21", rutas: rutas(true, true) });
    fijar("instrumento_panel-por-direccion_sin-casos");
  });

  escenario("instrumento_panel-por-direccion_inexistente", "panel=regla con foco en una regla que no está: dice por qué", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=hallazgos&panel=regla&foco=R_NO_ESTA", rutas: rutas(true, true) });
    fijar("instrumento_panel-por-direccion_inexistente");
  });

  escenario("instrumento_panel-por-clic", "clic en una regla con casos: la dirección nombra el panel", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutas(true, true) });
    await pulsar("article.pulso-vv2-rule-card[role=button]", "5 casos");
    expect(direccionActual()).toContain("panel=regla");
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
    fijar("instrumento_panel-alias-cierra-en-hallazgos");
  });
});

// Revisión de V2 (B1): los controles del operativo viven en Reglas y la
// auditoría en Hallazgos. Un cambio sin aplicar sobrevive al cambio de pestaña
// y bloquea la auditoría con su causa.
describe("Validación, controles del operativo sin aplicar entre pestañas", () => {
  escenario("instrumento_controles-sin-aplicar-entre-pestanas", "un control editado en Reglas bloquea la auditoría en Hallazgos y sigue al volver", async () => {
    const SWITCH = 'button[role="switch"][aria-label="Declarar Identidad del caso"]';
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutas(true, true) });
    expect(control(SWITCH).getAttribute("aria-checked")).toBe("false");
    await pulsar(SWITCH);
    expect(control(SWITCH).getAttribute("aria-checked")).toBe("true");
    expect(hay("button", "Aplicar y reconstruir plan")).toBe(true);

    await pulsar("#validacion-tab-hallazgos");
    expect((control("button", "Ejecutar de nuevo") as HTMLButtonElement).disabled).toBe(true);
    expect(hay("button", "Ir a Reglas")).toBe(true);

    await pulsar("button", "Ir a Reglas");
    expect(direccionActual()).toBe("/validacion?pestana=reglas");
    expect(control(SWITCH).getAttribute("aria-checked")).toBe("true");
    expect(hay("button", "Aplicar y reconstruir plan")).toBe(true);
    fijar("instrumento_controles-sin-aplicar-entre-pestanas");
  });

  escenario("instrumento_controles-sin-aplicar-por-base", "el cambio sin aplicar de una base no aparece en la otra", async () => {
    const SWITCH = 'button[role="switch"][aria-label="Declarar Identidad del caso"]';
    await montar({ ...DOS_BASES, pestana: "reglas", rutas: rutas(true, true) });
    await pulsar(SWITCH);
    expect(control(SWITCH).getAttribute("aria-checked")).toBe("true");
    // La otra base pasa a ser la activa en el backend; el store no se reinicia.
    await montar({
      estado: { ...DOS_BASES.estado, active_base: "docentes" },
      estudio: { ...DOS_BASES.estudio, active_base: "docentes" },
      pestana: "reglas",
      rutas: rutas(true, true),
    });
    expect(useValidacionStore.getState().baseNombre).toBe("docentes");
    expect(control(SWITCH).getAttribute("aria-checked")).toBe("false");
    expect(hay("button", "Aplicar y reconstruir plan")).toBe(false);
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
    const conEstado: Ruta[] = [
      ["POST", "/api/validacion/v2/instrumento/auditoria", () => {
        auditada = true;
        return { ok: true, job_id: "job-auditoria" };
      }],
      ["GET", "/api/jobs/job-auditoria", JOB_TERMINADO],
      ["GET", "/api/validacion/v2/instrumento/estado", () => estadoInstrumento(true, auditada)],
      ["GET", "/api/validacion/v2/limpieza", () => limpieza({ auditoria: auditada, cola: auditada ? COLA_TRES_CLASES : [] })],
    ];
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: [...conEstado, ...rutas(true, false), ...rutasLimpieza(limpieza({ auditoria: false }))] });
    expect(hay("div", "La cola aparece después de correr la auditoría.")).toBe(true);
    await pulsar("button", "Ejecutar auditoría");
    await asentar(20);
    expect(direccionActual()).toBe("/validacion?pestana=hallazgos");
    expect(hay("button", "Ejecutar de nuevo")).toBe(true);
    expect(hay("div", "La cola aparece después de correr la auditoría.")).toBe(false);
    expect(hay("#pulso-limpieza-cola-titulo", "(3)")).toBe(true);
    expect(hay(".pulso-limpieza-estado", "Sin auditoría")).toBe(false);
    fijar("instrumento_auditoria-refresca-la-cola");
  });
});

describe("Validación, Reglas del formulario: lo que se guarda", () => {
  escenario("instrumento_construir-plan", "construir el plan manda la configuración del operativo", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutas(false, false) });
    await pulsar("button", "Construir plan");
    fijar("instrumento_construir-plan");
  });

  escenario("instrumento_ejecutar-auditoria", "ejecutar la auditoría lanza el trabajo", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutas(true, false) });
    await pulsar("button", "Ejecutar auditoría");
    fijar("instrumento_ejecutar-auditoria");
  });

  escenario("instrumento_excluir-variable", "excluir una variable pide el motivo y lo manda", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutas(true, true) });
    await pulsar('button[role="switch"][aria-label="Excluir edad"]');
    expect(hay('input[aria-label="Motivo para excluir edad"]')).toBe(true);
    await escribir('input[aria-label="Motivo para excluir edad"]', "La edad se valida en otra base");
    await pulsar("button", "Excluir");
    fijar("instrumento_excluir-variable");
  });

  escenario("instrumento_reponer-variable", "reponer una variable excluida no pide motivo", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutas(true, true) });
    expect(control('button[role="switch"][aria-label="Excluir obs_campo"]').getAttribute("aria-checked")).toBe("true");
    await pulsar('button[role="switch"][aria-label="Excluir obs_campo"]');
    fijar("instrumento_reponer-variable");
  });
});
