// @vitest-environment happy-dom
/**
 * Caracterización de Validación: grupo "instrumento" (pestaña "Reglas del
 * formulario"). Ver arnes.tsx.
 *
 * Fija el plan, la auditoría y los resultados tal como se ven hoy, el panel de
 * una regla abierto por dirección y lo que se guarda al excluir una variable,
 * al construir el plan y al lanzar la auditoría.
 */
import { describe, expect } from "vitest";
import {
  Fallo,
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
  UNA_BASE,
  rutasInstrumento,
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
    await montar({ estado: SIN_INSUMOS, estudio: UNA_BASE.estudio, pestana: "instrumento", rutas: rutas(false, false) });
    fijar("instrumento_sin-insumos");
  });

  escenario("instrumento_sin-plan", "una base sin plan: paso 1 con la secuencia y el botón de construir", async () => {
    await montar({ ...UNA_BASE, pestana: "instrumento", rutas: rutas(false, false) });
    expect(hay("button", "Construir plan")).toBe(true);
    fijar("instrumento_sin-plan");
  });

  escenario("instrumento_plan-sin-auditoria", "plan construido sin auditoría: pasos 1 y 2", async () => {
    await montar({ ...UNA_BASE, pestana: "instrumento", rutas: rutas(true, false) });
    expect(hay("button", "Ejecutar auditoría")).toBe(true);
    fijar("instrumento_plan-sin-auditoria");
  });

  escenario("instrumento_con-auditoria", "auditoría corrida: resultados con todos los grupos de reglas", async () => {
    await montar({ ...UNA_BASE, pestana: "instrumento", rutas: rutas(true, true) });
    expect(hay("button", "Ejecutar de nuevo")).toBe(true);
    fijar("instrumento_con-auditoria");
  });

  escenario("instrumento_con-auditoria_despliega-sin-casos", "auditoría corrida: despliega las validaciones que pasaron", async () => {
    await montar({ ...UNA_BASE, pestana: "instrumento", rutas: rutas(true, true) });
    await pulsar("button[aria-expanded]", "Validaciones que pasaron");
    fijar("instrumento_con-auditoria_despliega-sin-casos");
  });

  escenario("instrumento_error-de-estado", "el estado del formulario falla: error en la pestaña", async () => {
    await montar({
      ...UNA_BASE,
      pestana: "instrumento",
      rutas: [["GET", "/api/validacion/v2/instrumento/estado", new Fallo("E_PRUEBA", "No se pudo leer el plan")], ...rutas(true, true)],
    });
    fijar("instrumento_error-de-estado");
  });

  escenario("instrumento_dos-bases", "dos bases: la base activa viaja en cada pedido", async () => {
    await montar({ ...DOS_BASES, pestana: "instrumento", rutas: rutas(true, true) });
    fijar("instrumento_dos-bases");
  });

  escenario("instrumento_madre-e-hija", "madre con hija de un grupo repetido: auditoría sobre la hija", async () => {
    await montar({ ...MADRE_E_HIJA, pestana: "instrumento", rutas: rutas(true, true) });
    fijar("instrumento_madre-e-hija");
  });
});

describe("Validación, Reglas del formulario: panel de la regla", () => {
  escenario("instrumento_panel-por-direccion_con-casos", "panel=regla con foco en una regla con casos: carga sus casos", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=instrumento&panel=regla&foco=R_REQ_EDAD", rutas: rutas(true, true) });
    fijar("instrumento_panel-por-direccion_con-casos");
  });

  escenario("instrumento_panel-por-direccion_sin-casos", "panel=regla con foco en una regla sin casos: solo la explicación", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=instrumento&panel=regla&foco=R_SALTO_P21", rutas: rutas(true, true) });
    fijar("instrumento_panel-por-direccion_sin-casos");
  });

  escenario("instrumento_panel-por-direccion_inexistente", "panel=regla con foco en una regla que no está: dice por qué", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=instrumento&panel=regla&foco=R_NO_ESTA", rutas: rutas(true, true) });
    fijar("instrumento_panel-por-direccion_inexistente");
  });

  escenario("instrumento_panel-por-clic", "clic en una regla con casos: la dirección nombra el panel", async () => {
    await montar({ ...UNA_BASE, pestana: "instrumento", rutas: rutas(true, true) });
    await pulsar("article.pulso-vv2-rule-card[role=button]", "5 casos");
    expect(direccionActual()).toContain("panel=regla");
    fijar("instrumento_panel-por-clic");
  });
});

describe("Validación, Reglas del formulario: lo que se guarda", () => {
  escenario("instrumento_construir-plan", "construir el plan manda la configuración del operativo", async () => {
    await montar({ ...UNA_BASE, pestana: "instrumento", rutas: rutas(false, false) });
    await pulsar("button", "Construir plan");
    fijar("instrumento_construir-plan");
  });

  escenario("instrumento_ejecutar-auditoria", "ejecutar la auditoría lanza el trabajo", async () => {
    await montar({ ...UNA_BASE, pestana: "instrumento", rutas: rutas(true, false) });
    await pulsar("button", "Ejecutar auditoría");
    fijar("instrumento_ejecutar-auditoria");
  });

  escenario("instrumento_excluir-variable", "excluir una variable pide el motivo y lo manda", async () => {
    await montar({ ...UNA_BASE, pestana: "instrumento", rutas: rutas(true, true) });
    await pulsar('button[role="switch"][aria-label="Excluir edad"]');
    expect(hay('input[aria-label="Motivo para excluir edad"]')).toBe(true);
    await escribir('input[aria-label="Motivo para excluir edad"]', "La edad se valida en otra base");
    await pulsar("button", "Excluir");
    fijar("instrumento_excluir-variable");
  });

  escenario("instrumento_reponer-variable", "reponer una variable excluida no pide motivo", async () => {
    await montar({ ...UNA_BASE, pestana: "instrumento", rutas: rutas(true, true) });
    expect(control('button[role="switch"][aria-label="Excluir obs_campo"]').getAttribute("aria-checked")).toBe("true");
    await pulsar('button[role="switch"][aria-label="Excluir obs_campo"]');
    fijar("instrumento_reponer-variable");
  });
});
