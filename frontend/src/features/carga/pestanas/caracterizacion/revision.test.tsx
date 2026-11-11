// @vitest-environment happy-dom
/** Caracterización de Carga: grupo "revision". Ver arnes.tsx. */
import { describe } from "vitest";
import {
  UNA_BASE_COMPLETA,
  VARIAS_SEPARADAS,
  base,
  escenario,
  escenariosDeMatriz,
  estado,
  fijar,
  montar,
  prepararGrupo,
  pulsar,
  revision,
  rutasDeRevision,
} from "./arnes";

prepararGrupo("revision");

escenariosDeMatriz("revision");

describe("CargaPage, una base: Revisión leída", () => {
  escenario("una-base_revision_lista", "sin pendientes: ofrece continuar", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "revision", rutas: rutasDeRevision(false) });
    fijar("una-base_revision_lista");
  });

  escenario("una-base_revision_con-pendientes", "con mapeo y variables extra pendientes", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "revision", rutas: rutasDeRevision(true) });
    fijar("una-base_revision_con-pendientes");
  });

  escenario("una-base_revision_dialogo-de-mapeo", "con pendientes: diálogo de mapeo abierto", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "revision", rutas: rutasDeRevision(true) });
    await pulsar("button.pulso-carga-review-mapping-button");
    fijar("una-base_revision_dialogo-de-mapeo");
  });

  escenario("una-base_revision_dialogo-de-extras", "con pendientes: diálogo de variables extra abierto", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "revision", rutas: rutasDeRevision(true) });
    await pulsar("button.pulso-recon-panel-button");
    fijar("una-base_revision_dialogo-de-extras");
  });
});

describe("CargaPage, varias bases: Revisión leída", () => {
  escenario("varias_separadas_revision_lista", "todas las bases listas: ofrece continuar", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "revision", rutas: rutasDeRevision(false) });
    fijar("varias_separadas_revision_lista");
  });

  escenario("varias_separadas_revision_con-pendientes", "con mapeo y variables extra pendientes en la base revisada", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "revision", rutas: rutasDeRevision(true) });
    fijar("varias_separadas_revision_con-pendientes");
  });
});
