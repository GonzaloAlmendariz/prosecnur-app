// @vitest-environment happy-dom
/**
 * Caracterización de Validación: grupo "limpieza" (lo que era la pestaña
 * "Cierre de base"). Ver arnes.tsx. Desde la rebanada V2 de P6 la cola y el
 * editor se ven en Hallazgos, y la promoción de la base en Cierre; los nombres
 * de los escenarios no cambian, para que las huellas sigan comparables.
 *
 * Fija la banda de cierre, la cola de hallazgos de las tres clases, el editor
 * de decisión y, en claro, el cuerpo de cada decisión que se guarda o se
 * borra: es la huella que el editor nuevo de Hallazgos tendrá que reproducir.
 *
 * Rebanada V3 del plan de fidelidad: Hallazgos es la mesa de tres columnas
 * (`hallazgos/`). Los escenarios que guardan conservan su nombre y su cuerpo;
 * mientras se decide, la pantalla pide además el efecto previsto
 * (`POST /limpieza/decision/efecto`, M4), que no guarda nada. "Guardar
 * borrador" pasa al atajo con Mayúsculas (D-F7f), "Siguiente" a "Omitir" y el
 * filtro por categoría a las clases de la cola (D-F7e).
 */
import { act } from "react";
import type { LimpiezaDecision } from "../types";
import { describe, expect } from "vitest";
import {
  Fallo,
  asentar,
  control,
  cuerposEnviados,
  direccionActual,
  escenario,
  escribir,
  fijar,
  hay,
  montar,
  pulsar,
  prepararGrupo,
} from "./arnes";
import {
  COLA_TRES_CLASES,
  DECISIONES,
  DOS_BASES,
  MADRE_E_HIJA,
  SIN_INSUMOS,
  UNA_BASE,
  decision,
  limpieza,
  rutasHallazgos,
} from "./escenarios";

prepararGrupo("limpieza");

const CON_HALLAZGOS = limpieza({ auditoria: true, cola: COLA_TRES_CLASES });
const CON_DECISIONES = limpieza({ auditoria: true, cola: COLA_TRES_CLASES, decisiones: DECISIONES, preservadas: true });
const FILA = "button.pulso-hz-fila";
const OPCION = "button.pulso-hz-opcion";
const SEGMENTO_COLA = ".pulso-panel-de-mesa--cola .pulso-hz-segmentado button";

describe("Validación, Cierre de base: estados", () => {
  escenario("limpieza_sin-insumos", "sin formulario ni respuestas: vacío con enlace a Carga", async () => {
    await montar({ estado: SIN_INSUMOS, estudio: UNA_BASE.estudio, pestana: "hallazgos", rutas: rutasHallazgos(CON_HALLAZGOS) });
    fijar("limpieza_sin-insumos");
  });

  escenario("limpieza_sin-auditoria", "sin auditoría: cola vacía con Auditar, qué se va a revisar y la decisión vacía", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(limpieza({ auditoria: false })) });
    expect(hay(".pulso-panel-de-mesa--cola", "La base no se ha auditado")).toBe(true);
    expect(hay(".pulso-panel-de-mesa--hallazgo", "Qué se va a revisar")).toBe(true);
    expect(hay(".pulso-cabecera-pestana-estado", "Sin auditar")).toBe(true);
    fijar("limpieza_sin-auditoria");
  });

  escenario("limpieza_cola-vacia", "auditoría sin hallazgos: ninguna regla encontró casos y lleva a Cierre", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(limpieza({ auditoria: true, cola: [] })) });
    expect(hay(".pulso-panel-de-mesa--cola", "Ninguna regla encontró casos")).toBe(true);
    expect(hay(".pulso-panel-de-mesa--decision button", "Ir a Cierre")).toBe(true);
    fijar("limpieza_cola-vacia");
  });

  escenario("limpieza_tres-clases", "hallazgos de las tres clases: la primera pendiente queda abierta con sus casos", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(CON_HALLAZGOS) });
    expect(hay(".pulso-hz-guardar", "Guardar y seguir")).toBe(true);
    expect(hay(".pulso-panel-de-mesa--hallazgo .pulso-panel-de-mesa-titulo", "Edad entre 16 y 25")).toBe(true);
    expect(hay(".pulso-cifras-pestana", "hallazgos por decidir")).toBe(true);
    fijar("limpieza_tres-clases");
  });

  escenario("limpieza_decisiones-listas-y-borrador", "decisiones listas y en borrador, con decisiones preservadas", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(CON_DECISIONES) });
    fijar("limpieza_decisiones-listas-y-borrador");
  });

  escenario("limpieza_base-promovida", "base promovida y lista para cerrar", async () => {
    await montar({
      ...UNA_BASE,
      pestana: "cierre",
      rutas: rutasHallazgos(limpieza({ auditoria: true, cola: COLA_TRES_CLASES, decisiones: DECISIONES, listaParaCerrar: true, promovida: true })),
    });
    // Rebanada V4: la cadena del cierre, las decisiones por grupo y los archivos al día.
    expect(hay(".pulso-cabecera-pestana-estado", "Cerrada el 4 mar")).toBe(true);
    expect(hay(".pulso-franja-destino", "117")).toBe(true);
    expect(hay(".pulso-ci-grupo", "Casos excluidos")).toBe(true);
    expect(hay(".pulso-ci-archivo", "Al día")).toBe(true);
    expect(hay("button", "Cerrar la base")).toBe(false);
    fijar("limpieza_base-promovida");
  });

  escenario("limpieza_error", "la pestaña no carga: vacío con la causa", async () => {
    await montar({
      ...UNA_BASE,
      pestana: "hallazgos",
      rutas: [["GET", "/api/validacion/v2/limpieza", new Fallo("E_PRUEBA", "No se pudo leer la limpieza")]],
    });
    fijar("limpieza_error");
  });

  escenario("limpieza_dos-bases", "dos bases: la base activa viaja en cada pedido", async () => {
    await montar({ ...DOS_BASES, pestana: "hallazgos", rutas: rutasHallazgos(CON_DECISIONES) });
    fijar("limpieza_dos-bases");
  });

  escenario("limpieza_madre-e-hija", "madre con hija de un grupo repetido", async () => {
    await montar({ ...MADRE_E_HIJA, pestana: "hallazgos", rutas: rutasHallazgos(CON_HALLAZGOS) });
    fijar("limpieza_madre-e-hija");
  });
});

describe("Validación, Hallazgos: cola y decisión (rebanada V3)", () => {
  escenario("hallazgos_filtra-por-clase", "la clase de la cola filtra la lista (D-F7e, antes el chip de categoría)", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(CON_HALLAZGOS) });
    await pulsar("button.pulso-hz-clase-filtro", "inconsistencias");
    expect(control("button.pulso-hz-clase-filtro", "inconsistencias").getAttribute("aria-pressed")).toBe("true");
    fijar("hallazgos_filtra-por-clase");
  });

  escenario("limpieza_elige-decidido-con-historial", "elegir un hallazgo decidido abre su decisión, con la fecha y el motivo", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(CON_DECISIONES) });
    await pulsar(SEGMENTO_COLA, "Decididos");
    await pulsar(FILA, "Sexo y servicio");
    expect(direccionActual()).toBe("/validacion?pestana=hallazgos&foco=RC_002");
    expect(hay(".pulso-hz-decidida", "Decidida el 3 mar: Los casos se confirmaron con la supervisora de campo")).toBe(true);
    fijar("limpieza_elige-decidido-con-historial");
  });

  escenario("hallazgos_omitir", "Omitir pasa al siguiente por decidir sin guardar (antes Siguiente)", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(CON_HALLAZGOS) });
    await pulsar(".pulso-hz-pie button", "Omitir");
    expect(direccionActual()).toBe("/validacion?pestana=hallazgos&foco=R_REQ_EDAD");
    expect(cuerposEnviados().filter((c) => c.startsWith("POST /api/validacion/v2/limpieza/decision ")).length).toBe(0);
    fijar("hallazgos_omitir");
  });

  escenario("hallazgos_caso-por-direccion", "panel=caso&foco=<id> abre el caso completo; cerrarlo vuelve al hallazgo", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=hallazgos&foco=R_REQ_EDAD", rutas: rutasHallazgos(CON_HALLAZGOS) });
    await pulsar("button.pulso-hz-casoid", "c-001");
    expect(direccionActual()).toBe("/validacion?pestana=hallazgos&foco=c-001&panel=caso");
    expect(hay('[role="dialog"]', "Caso c-001")).toBe(true);
    expect(hay('[role="dialog"] .pulso-hz-respuestas', "Edad en años cumplidos")).toBe(true);
    await pulsar('[role="dialog"] button', "Cerrar");
    expect(direccionActual()).toBe("/validacion?pestana=hallazgos&foco=R_REQ_EDAD");
    fijar("hallazgos_caso-por-direccion");
  });

  escenario("hallazgos_decision-no-aplicable", "una decisión lista que no se aplica dice la causa en la cola y en la decisión", async () => {
    const resumen = limpieza({
      auditoria: true,
      cola: COLA_TRES_CLASES,
      decisiones: [decision("D_001", { aplicable: false, motivo_no_aplicable: "sin_casos_al_decidir" })],
    });
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=hallazgos&foco=RC_002", rutas: rutasHallazgos(resumen) });
    expect(hay(".pulso-hz-fila .pulso-hz-fila-nota", "No se aplica")).toBe(true);
    expect(hay(".pulso-hz-aviso", "Esta decisión no se aplica: la regla no marcaba casos cuando se dio por lista.")).toBe(true);
    fijar("hallazgos_decision-no-aplicable");
  });

  escenario("hallazgos_incluir-casos-nuevos", "una decisión congelada con casos nuevos los ofrece y vuelve a guardarla con incluir_casos_nuevos", async () => {
    const congelada = decision("D_003", {
      source_type: "instrument_rule", source_id: "R_REQ_EDAD", scope: "case_subset", action_type: "exclude_cases",
      rationale: "Edad fuera del universo del estudio", seguimiento: "congelada", n_casos_al_decidir: 1,
      casos_nuevos: ["c-002"], casos_que_ya_no_marca: [], n_casos_aplicados: 1, alcance: "caso",
    } as Partial<LimpiezaDecision>);
    const cola = COLA_TRES_CLASES.map((q) => (q.source_id === "R_REQ_EDAD" ? { ...q, n_casos_cubiertos: 1, n_casos_pendientes: 1 } : q));
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=hallazgos&foco=R_REQ_EDAD", rutas: rutasHallazgos(limpieza({ auditoria: true, cola, decisiones: [congelada] })) });
    expect(hay(".pulso-hz-aviso", "La última auditoría marca 1 caso que esta decisión no cubre")).toBe(true);
    expect(hay(".pulso-hz-fila", "1 caso nuevo")).toBe(true);
    await pulsar(".pulso-hz-aviso button", "Incluir casos nuevos");
    const guardada = cuerposEnviados().find((c) => c.startsWith("POST /api/validacion/v2/limpieza/decision "));
    expect(JSON.parse(guardada?.split("\n")[1] ?? "{}")).toMatchObject({ id: "D_003", status: "ready", incluir_casos_nuevos: true, action_type: "exclude_cases" });
    fijar("hallazgos_incluir-casos-nuevos");
  });

  escenario("hallazgos_alcance-dicho", "D-F2: la decisión sobre la regla entera dice a qué casos llega según la acción", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=hallazgos&foco=R_REQ_EDAD", rutas: rutasHallazgos(CON_HALLAZGOS) });
    expect(hay(".pulso-hz-alcance", "Cubre los casos que la regla marque, también los de una auditoría nueva.")).toBe(true);
    await pulsar(OPCION, "Excluir los casos");
    await pulsar(".pulso-hz-segmentado button", "Los 2");
    expect(hay(".pulso-hz-alcance", "Se aplica a los 2 casos que la regla marca hoy; los que marque una auditoría nueva quedan por decidir.")).toBe(true);
    expect(hay(".pulso-pie-efecto-linea", "casos dejan de contar. Quedan 118 de 120.")).toBe(true);
    fijar("hallazgos_alcance-dicho");
  });
});

/** Ctrl (Cmd en macOS) + Mayúsculas + Enter: guardar sin dejarla lista (D-F7f; antes "Guardar borrador"). Sin navegador el sistema es Windows. */
async function guardarBorrador() {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, shiftKey: true, bubbles: true }));
  });
  await asentar();
}

describe("Validación, Cierre de base: lo que se guarda", () => {
  escenario("limpieza_borrador-sin-casos", "exclusión prevista sin casos elegidos: no se guarda y dice por qué", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(CON_HALLAZGOS) });
    expect((control(".pulso-hz-guardar") as HTMLButtonElement).disabled).toBe(true);
    expect(control(".pulso-hz-guardar").getAttribute("title")).toBe("Marca al menos un caso o elige \"Los 2\".");
    await guardarBorrador();
    fijar("limpieza_borrador-sin-casos");
  });

  escenario("limpieza_guarda-borrador", "guardar sin dejarla lista una regla del formulario manda la decisión por defecto", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(CON_HALLAZGOS) });
    await pulsar(FILA, "Edad obligatoria");
    await guardarBorrador();
    fijar("limpieza_guarda-borrador");
  });

  escenario("limpieza_guarda-y-siguiente", "con motivo, guardar y seguir deja la decisión lista y avanza", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(CON_HALLAZGOS) });
    await pulsar(FILA, "Edad obligatoria");
    await escribir("textarea.pulso-hz-motivo", "Los vacíos son de una versión anterior del formulario");
    await pulsar(".pulso-hz-guardar", "Guardar y seguir");
    fijar("limpieza_guarda-y-siguiente");
  });

  escenario("limpieza_guarda-casos-elegidos", "exclusión prevista con un caso marcado: guarda los casos marcados", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(CON_HALLAZGOS) });
    // La primera pendiente con más casos (RC_001, exclusión prevista) ya está abierta.
    await pulsar('button.pulso-hz-marca[aria-label="Marcar el caso c-001"]');
    expect(hay(".pulso-hz-segmentado button.is-on", "El marcado")).toBe(true);
    await escribir("textarea.pulso-hz-motivo", "Fuera del rango del estudio");
    await pulsar(".pulso-hz-guardar", "Guardar");
    fijar("limpieza_guarda-casos-elegidos");
  });

  escenario("limpieza_asigna-valor", "asignar un valor a todos los casos guarda la pregunta, el valor y el alcance", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(CON_HALLAZGOS) });
    await pulsar(FILA, "Edad obligatoria");
    await pulsar(OPCION, "Asignar un valor");
    await pulsar(".pulso-hz-segmentado button", "Los 2");
    // La edad es numérica: el ejemplo del campo es una cifra (ronda 2, H6).
    expect(control(".pulso-hz-campos input").getAttribute("placeholder")).toBe("Ej. 99");
    await escribir(".pulso-hz-campos input", "No aplica");
    await escribir("textarea.pulso-hz-motivo", "Sin edad declarada");
    await guardarBorrador();
    fijar("limpieza_asigna-valor");
  });

  escenario("limpieza_elimina-decision", "eliminar la decisión pide confirmar y manda su id", async () => {
    await montar({ ...UNA_BASE, pestana: "hallazgos", rutas: rutasHallazgos(CON_DECISIONES) });
    await pulsar(SEGMENTO_COLA, "Decididos");
    await pulsar(FILA, "Sexo y servicio");
    await pulsar(".pulso-hz-decidida button", "Eliminar la decisión");
    await pulsar('[role="dialog"] button', "Eliminar");
    fijar("limpieza_elimina-decision");
  });

  escenario("limpieza_cierre-genera-paquete-y-cierra", "Cierre: generar el paquete metodológico y cerrar la base mandan sus pedidos", async () => {
    await montar({
      ...UNA_BASE,
      pestana: "cierre",
      rutas: rutasHallazgos(limpieza({ auditoria: true, cola: COLA_TRES_CLASES, decisiones: DECISIONES, listaParaCerrar: true })),
    });
    // Rebanada V4: el paquete se genera en su fila de "Archivos" y el cierre es la acción de la cabecera.
    await pulsar(".pulso-ci-archivo button", "Generar");
    await pulsar(".pulso-cabecera-pestana-acciones button", "Cerrar la base");
    const enviados = cuerposEnviados().map((c) => c.split("\n")[0]);
    expect(enviados).toContain("POST /api/validacion/v2/report/methodology/bundle [base=default]");
    expect(enviados).toContain("POST /api/validacion/v2/limpieza/finalize [base=default]");
    fijar("limpieza_cierre-genera-paquete-y-cierra");
  });

  escenario("limpieza_hallazgos-lista-lleva-a-cierre", "Hallazgos con la base lista para cerrar lleva a Cierre", async () => {
    await montar({
      ...UNA_BASE,
      pestana: "hallazgos",
      rutas: rutasHallazgos(limpieza({ auditoria: true, cola: COLA_TRES_CLASES, decisiones: DECISIONES, listaParaCerrar: true })),
    });
    expect(hay("button", "Cerrar la base")).toBe(false);
    await pulsar(".pulso-hz-franja-avisos button", "Ir a Cierre");
    expect(direccionActual()).toBe("/validacion?pestana=cierre");
    expect(hay("button", "Cerrar la base")).toBe(true);
    fijar("limpieza_hallazgos-lista-lleva-a-cierre");
  });

  escenario("limpieza_cierre-sin-auditoria-lleva-a-hallazgos", "Cierre sin auditoría dice dónde se corre y lleva allí", async () => {
    await montar({ ...UNA_BASE, pestana: "cierre", rutas: rutasHallazgos(limpieza({ auditoria: false })) });
    expect(hay(".pulso-panel-de-mesa--decisiones", "La base no se ha auditado")).toBe(true);
    await pulsar(".pulso-panel-de-mesa--decisiones button", "Ir a Hallazgos");
    expect(direccionActual()).toBe("/validacion?pestana=hallazgos");
    fijar("limpieza_cierre-sin-auditoria-lleva-a-hallazgos");
  });

  escenario("limpieza_revierte-promocion", "reabrir la base (revertir la promoción) pide confirmar y la revierte", async () => {
    await montar({
      ...UNA_BASE,
      pestana: "cierre",
      rutas: rutasHallazgos(limpieza({ auditoria: true, cola: COLA_TRES_CLASES, decisiones: DECISIONES, listaParaCerrar: true, promovida: true })),
    });
    await pulsar(".pulso-cabecera-pestana-acciones button", "Reabrir la base");
    await pulsar('[role="dialog"] button', "Reabrir");
    expect(cuerposEnviados().map((c) => c.split("\n")[0])).toContain("POST /api/validacion/v2/limpieza/revertir-promocion [base=default]");
    fijar("limpieza_revierte-promocion");
  });
});
