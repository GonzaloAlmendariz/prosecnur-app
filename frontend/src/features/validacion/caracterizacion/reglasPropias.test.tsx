// @vitest-environment happy-dom
/**
 * Caracterización de Validación: grupo "reglasPropias" (lo que era la pestaña
 * "Criterios de revisión"; desde la rebanada V2 de P6, debajo del plan en
 * Reglas). Ver arnes.tsx.
 *
 * Fija la lista, las sugerencias y el editor, y en claro lo que se guarda al
 * editar, adoptar, omitir y eliminar una regla propia. El cuerpo de cada tipo
 * de regla, armado por el editor, lo fija `reglas/payloadDeRegla.test.tsx`.
 *
 * Plan de fidelidad, rebanada V1: las propias son familias de la mesa de
 * Reglas. "Nuevo criterio" pasa a "Nueva regla" (cabecera), "Omitir" al
 * interruptor de la fila, "Editar" al pie de la ficha y "Eliminar" al pie del
 * panel de la regla (con diálogo), con los mismos cuerpos. "Adoptar" pasa a
 * "Añadir" en las sugeridas, que abre el panel armado con la sugerida y guarda
 * desde ahí: el cuerpo es el que arma el panel (el mismo de "Usar"), no la
 * sugerida tal cual (cambio deliberado, encargo del coordinador).
 * "Ejecutar" pasa a "Auditar": manda `POST /auditoria` en lugar de
 * `POST /reglas_custom/ejecutar` (cambio deliberado: la auditoría corre el
 * plan del formulario y las propias juntas).
 */
import { afterAll, beforeAll, describe, expect } from "vitest";
import { ESPERA_DEL_CONTEO_MS, fijarEsperaDelConteoParaPruebas } from "../reglas/panel/conteoPrevio";
import { act } from "react";
import { asentar, control, direccionActual, escenario, fijar, hay, montar, pulsar, prepararGrupo } from "./arnes";
import {
  DOS_BASES,
  REGLAS_PROPIAS,
  UNA_BASE,
  rutasReglasPropias,
} from "./escenarios";

prepararGrupo("reglasPropias");

// El conteo previo del panel de regla no es lo que se mide aquí: se aleja, para
// que la huella no dependa de lo cargada que esté la máquina (lo mide reglasPanel).
beforeAll(() => {
  fijarEsperaDelConteoParaPruebas(60_000);
});
afterAll(() => {
  fijarEsperaDelConteoParaPruebas(ESPERA_DEL_CONTEO_MS);
});

describe("Validación, Criterios de revisión: estados", () => {
  escenario("reglas-propias_sin-reglas", "sin reglas propias: vacío y una sugerencia", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias([]) });
    fijar("reglas-propias_sin-reglas");
  });

  escenario("reglas-propias_con-reglas", "dos reglas, una omitida y sembrada", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    // Las propias se reparten por tipo; la primera familia con reglas se abre sola.
    expect(hay(".pulso-rl-familia", "Valor fuera de rango")).toBe(true);
    expect(hay(".pulso-rl-familia", "Dos respuestas que deben cuadrar")).toBe(true);
    expect(hay(".pulso-panel-de-mesa--ficha .pulso-panel-de-mesa-titulo", "Edad entre 16 y 25")).toBe(true);
    fijar("reglas-propias_con-reglas");
  });

  escenario("reglas-propias_dos-bases", "dos bases: la base activa viaja en cada pedido", async () => {
    await montar({ ...DOS_BASES, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    fijar("reglas-propias_dos-bases");
  });

  // Rebanada V2 del plan de fidelidad: el editor es el panel de regla, por la
  // dirección; una nueva abre en "Tipo de regla".
  escenario("reglas-propias_nueva", "Nueva regla abre el panel de regla en Tipo de regla", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    await pulsar(".pulso-cabecera-pestana-acciones button", "Nueva regla");
    expect(direccionActual()).toBe("/validacion?pestana=reglas&panel=regla&foco=nueva");
    expect(hay(".pulso-panel-regla .pulso-cabecera-panel__titulo", "Tipo de regla")).toBe(true);
    fijar("reglas-propias_nueva");
  });
});

describe("Validación, Criterios de revisión: lo que se guarda", () => {
  escenario("reglas-propias_edita-y-guarda", "editar una regla y guardarla sin cambios manda el PUT completo", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    await pulsar(".pulso-panel-de-mesa--ficha button", "Editar");
    await pulsar(".pulso-dialog__actions button", "Guardar");
    expect(direccionActual()).toBe("/validacion?pestana=reglas");
    fijar("reglas-propias_edita-y-guarda");
  });

  escenario("reglas-propias_omite", "desactivar en la lista manda solo activa", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    await pulsar('button[role="switch"][aria-label="Desactivar la regla Edad entre 16 y 25"]');
    fijar("reglas-propias_omite");
  });

  escenario("reglas-propias_elimina", "eliminar pide confirmar y manda el DELETE", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    await pulsar(".pulso-panel-de-mesa--ficha button", "Editar");
    await pulsar(".pulso-panel-regla button", "Eliminar la regla");
    expect(hay('[role="dialog"]', "No se puede deshacer")).toBe(true);
    // El botón del diálogo de confirmación es el último con ese texto.
    const confirmar = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter((b) => (b.textContent ?? "").includes("Eliminar la regla")).at(-1);
    await act(async () => {
      confirmar?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await asentar();
    expect(direccionActual()).toBe("/validacion?pestana=reglas");
    fijar("reglas-propias_elimina");
  });

  escenario("reglas-propias_adopta-sugerencia", "Añadir una sugerida abre el panel armado y guarda desde ahí", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    await pulsar('button[aria-label="Añadir la sugerida Duplicados por documento"]');
    expect(direccionActual()).toBe("/validacion?pestana=reglas&panel=regla&foco=nueva");
    await pulsar(".pulso-dialog__actions button", "Guardar");
    fijar("reglas-propias_adopta-sugerencia");
  });

  escenario("reglas-propias_ejecuta", "Auditar lanza la auditoría completa", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    expect((control(".pulso-cabecera-pestana-acciones button", "Auditar") as HTMLButtonElement).disabled).toBe(false);
    await pulsar(".pulso-cabecera-pestana-acciones button", "Auditar");
    fijar("reglas-propias_ejecuta");
  });
});
