// @vitest-environment happy-dom
/**
 * Caracterización de Validación: grupo "reglasPropias" (lo que era la pestaña
 * "Criterios de revisión"; desde la rebanada V2 de P6, debajo del plan en
 * Reglas). Ver arnes.tsx.
 *
 * Fija la lista, las sugerencias y el editor, y en claro lo que se guarda al
 * editar, adoptar, omitir y eliminar una regla propia. El cuerpo de cada tipo
 * de regla, armado por el editor, lo fija `reglas/payloadDeRegla.test.tsx`.
 */
import { describe, expect } from "vitest";
import { escenario, fijar, hay, montar, pulsar, prepararGrupo } from "./arnes";
import {
  DOS_BASES,
  REGLAS_PROPIAS,
  UNA_BASE,
  rutasReglasPropias,
} from "./escenarios";

prepararGrupo("reglasPropias");

describe("Validación, Criterios de revisión: estados", () => {
  escenario("reglas-propias_sin-reglas", "sin reglas propias: vacío y una sugerencia", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias([]) });
    fijar("reglas-propias_sin-reglas");
  });

  escenario("reglas-propias_con-reglas", "dos reglas, una omitida y sembrada", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    fijar("reglas-propias_con-reglas");
  });

  escenario("reglas-propias_dos-bases", "dos bases: la base activa viaja en cada pedido", async () => {
    await montar({ ...DOS_BASES, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    fijar("reglas-propias_dos-bases");
  });

  escenario("reglas-propias_nueva", "Nuevo criterio abre el editor en el paso 1", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    await pulsar("button", "Nuevo criterio");
    expect(hay(".pulso-regla-editor")).toBe(true);
    fijar("reglas-propias_nueva");
  });
});

describe("Validación, Criterios de revisión: lo que se guarda", () => {
  escenario("reglas-propias_edita-y-guarda", "editar una regla y guardarla sin cambios manda el PUT completo", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    await pulsar('button[aria-label="Editar criterio"]');
    await pulsar("button.pulso-primary", "Siguiente");
    await pulsar("button.pulso-primary", "Siguiente");
    await pulsar("button.pulso-primary", "Guardar criterio");
    fijar("reglas-propias_edita-y-guarda");
  });

  escenario("reglas-propias_omite", "omitir de la ejecución manda solo activa", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    await pulsar('button[aria-label="No ejecutar este criterio"]');
    fijar("reglas-propias_omite");
  });

  escenario("reglas-propias_elimina", "eliminar pide confirmar y manda el DELETE", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    await pulsar('button[aria-label="Eliminar criterio"]');
    fijar("reglas-propias_elimina");
  });

  escenario("reglas-propias_adopta-sugerencia", "adoptar una sugerencia la guarda tal cual", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    await pulsar('button[aria-label="Adoptar el criterio Duplicados por documento"]');
    fijar("reglas-propias_adopta-sugerencia");
  });

  escenario("reglas-propias_ejecuta", "ejecutar lanza el trabajo con las activas", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas", rutas: rutasReglasPropias(REGLAS_PROPIAS) });
    await pulsar("button", "Ejecutar");
    fijar("reglas-propias_ejecuta");
  });
});
