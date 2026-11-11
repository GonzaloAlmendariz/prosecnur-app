// @vitest-environment happy-dom
/**
 * Caracterización de Validación: grupo "limpieza" (pestaña "Cierre de base").
 * Ver arnes.tsx.
 *
 * Fija la banda de cierre, la cola de hallazgos de las tres clases, el editor
 * de decisión y, en claro, el cuerpo de cada decisión que se guarda o se
 * borra: es la huella que el editor nuevo de Hallazgos tendrá que reproducir.
 */
import { act } from "react";
import { describe, expect } from "vitest";
import {
  Fallo,
  asentar,
  control,
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
  limpieza,
  rutasLimpieza,
} from "./escenarios";

prepararGrupo("limpieza");

const CON_HALLAZGOS = limpieza({ auditoria: true, cola: COLA_TRES_CLASES });
const CON_DECISIONES = limpieza({ auditoria: true, cola: COLA_TRES_CLASES, decisiones: DECISIONES, preservadas: true });
const TARJETA = "article.pulso-vv2-rule-card[role=button]";

describe("Validación, Cierre de base: estados", () => {
  escenario("limpieza_sin-insumos", "sin formulario ni respuestas: vacío con enlace a Carga", async () => {
    await montar({ estado: SIN_INSUMOS, estudio: UNA_BASE.estudio, pestana: "limpieza", rutas: rutasLimpieza(CON_HALLAZGOS) });
    fijar("limpieza_sin-insumos");
  });

  escenario("limpieza_sin-auditoria", "sin auditoría: banda en ámbar, cola y editor vacíos", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(limpieza({ auditoria: false })) });
    fijar("limpieza_sin-auditoria");
  });

  escenario("limpieza_cola-vacia", "auditoría sin hallazgos: cola vacía", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(limpieza({ auditoria: true, cola: [] })) });
    fijar("limpieza_cola-vacia");
  });

  escenario("limpieza_tres-clases", "hallazgos de las tres clases: la primera pendiente queda abierta con sus casos", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(CON_HALLAZGOS) });
    expect(hay("button", "Guardar borrador")).toBe(true);
    fijar("limpieza_tres-clases");
  });

  escenario("limpieza_decisiones-listas-y-borrador", "decisiones listas y en borrador, con decisiones preservadas", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(CON_DECISIONES) });
    fijar("limpieza_decisiones-listas-y-borrador");
  });

  escenario("limpieza_base-promovida", "base promovida y lista para cerrar", async () => {
    await montar({
      ...UNA_BASE,
      pestana: "limpieza",
      rutas: rutasLimpieza(limpieza({ auditoria: true, cola: COLA_TRES_CLASES, decisiones: DECISIONES, listaParaCerrar: true, promovida: true })),
    });
    fijar("limpieza_base-promovida");
  });

  escenario("limpieza_error", "la pestaña no carga: vacío con la causa", async () => {
    await montar({
      ...UNA_BASE,
      pestana: "limpieza",
      rutas: [["GET", "/api/validacion/v2/limpieza", new Fallo("E_PRUEBA", "No se pudo leer la limpieza")]],
    });
    fijar("limpieza_error");
  });

  escenario("limpieza_dos-bases", "dos bases: la base activa viaja en cada pedido", async () => {
    await montar({ ...DOS_BASES, pestana: "limpieza", rutas: rutasLimpieza(CON_DECISIONES) });
    fijar("limpieza_dos-bases");
  });

  escenario("limpieza_madre-e-hija", "madre con hija de un grupo repetido", async () => {
    await montar({ ...MADRE_E_HIJA, pestana: "limpieza", rutas: rutasLimpieza(CON_HALLAZGOS) });
    fijar("limpieza_madre-e-hija");
  });
});

describe("Validación, Cierre de base: cola y editor", () => {
  escenario("limpieza_filtra-por-categoria", "el chip de categoría filtra la cola", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(CON_HALLAZGOS) });
    await pulsar("button", "Rango");
    fijar("limpieza_filtra-por-categoria");
  });

  escenario("limpieza_elige-decidido-con-historial", "elegir un hallazgo decidido abre su decisión y el historial", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(CON_DECISIONES) });
    await pulsar(TARJETA, "4 casos (3.3%)");
    await pulsar("details > summary");
    fijar("limpieza_elige-decidido-con-historial");
  });

  escenario("limpieza_navega-siguiente", "Siguiente pasa al hallazgo de abajo en la cola", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(CON_HALLAZGOS) });
    await pulsar("button[title=Siguiente]");
    fijar("limpieza_navega-siguiente");
  });
});

describe("Validación, Cierre de base: lo que se guarda", () => {
  escenario("limpieza_borrador-sin-casos", "exclusión prevista sin casos elegidos: el borrador no se guarda y dice por qué", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(CON_HALLAZGOS) });
    await pulsar("button", "Guardar borrador");
    fijar("limpieza_borrador-sin-casos");
  });

  escenario("limpieza_guarda-borrador", "guardar borrador de una regla del formulario manda la decisión por defecto", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(CON_HALLAZGOS) });
    await pulsar(TARJETA, "2 casos (1.7%)");
    await pulsar("button", "Guardar borrador");
    fijar("limpieza_guarda-borrador");
  });

  escenario("limpieza_guarda-y-siguiente", "con justificación, guardar y siguiente deja la decisión lista y avanza", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(CON_HALLAZGOS) });
    await pulsar(TARJETA, "2 casos (1.7%)");
    await escribir("textarea", "Los vacíos son de una versión anterior del formulario");
    await pulsar("button.pulso-primary", "Guardar y siguiente");
    fijar("limpieza_guarda-y-siguiente");
  });

  escenario("limpieza_guarda-casos-elegidos", "exclusión prevista con selección: guarda los casos marcados", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(CON_HALLAZGOS) });
    // La primera pendiente con más casos (RC_001, exclusión prevista con selección) ya está abierta.
    await pulsar('input[name="limpieza-case-selection"]');
    await escribir("textarea", "Fuera del rango del estudio");
    await pulsar("button.pulso-primary", "Guardar");
    fijar("limpieza_guarda-casos-elegidos");
  });

  escenario("limpieza_asigna-valor", "asignar un valor a todos los casos guarda la variable, el valor y el alcance", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(CON_HALLAZGOS) });
    await pulsar(TARJETA, "2 casos (1.7%)");
    const accion = control("select") as HTMLSelectElement;
    await act(async () => {
      accion.value = "set_value";
      accion.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await asentar();
    await pulsar('[role="radio"]', "Todos");
    await escribir('input[placeholder="Ej. No aplica"]', "No aplica");
    await escribir("textarea", "Sin edad declarada");
    await pulsar("button", "Guardar borrador");
    fijar("limpieza_asigna-valor");
  });

  escenario("limpieza_elimina-decision", "eliminar la decisión abierta manda su id", async () => {
    await montar({ ...UNA_BASE, pestana: "limpieza", rutas: rutasLimpieza(CON_DECISIONES) });
    await pulsar(TARJETA, "4 casos (3.3%)");
    // Elegir el hallazgo abre una decisión nueva: la guardada se toma del historial.
    await pulsar("details > summary");
    await pulsar("details div > div > button");
    await pulsar("button", "Eliminar");
    fijar("limpieza_elimina-decision");
  });

  escenario("limpieza_revierte-promocion", "revertir la promoción pide confirmar y la revierte", async () => {
    await montar({
      ...UNA_BASE,
      pestana: "limpieza",
      rutas: rutasLimpieza(limpieza({ auditoria: true, cola: COLA_TRES_CLASES, decisiones: DECISIONES, listaParaCerrar: true, promovida: true })),
    });
    await pulsar("button", "Revertir");
    await pulsar("button", "Revertir");
    fijar("limpieza_revierte-promocion");
  });
});
