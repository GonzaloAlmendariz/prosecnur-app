// @vitest-environment happy-dom
/** Caracterización de Carga: grupo "revision". Ver arnes.tsx. */
import { describe, expect, vi } from "vitest";
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
  pedidosHechos,
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

  escenario("una-base_revision_dialogo-de-mapeo", "con pendientes: diálogo de mapeo abierto desde su comprobación", async () => {
    await montar({ estado: UNA_BASE_COMPLETA, pestana: "revision", rutas: rutasDeRevision(true) });
    await pulsar("button.pulso-revision-item", "Códigos de las opciones");
    await pulsar("button.pulso-revision-revisar-mapeo");
    fijar("una-base_revision_dialogo-de-mapeo");
  });

  // Antes las columnas fuera del formulario se decidían en un diálogo ("Revisar variables extra"); ahora en la
  // mesa. Lo que se guarda es lo mismo: el POST de la reconciliación con la lista de columnas que entran.
  escenario("una-base_revision_columnas-guardar", "con pendientes: decide en la mesa qué columnas entran y guarda", async () => {
    await montar({
      estado: UNA_BASE_COMPLETA,
      pestana: "revision",
      rutas: [...rutasDeRevision(true), ["POST", "/api/carga/review/reconciliation", revision(null, false)]],
    });
    const cuerpos: unknown[] = [];
    const delArnes = globalThis.fetch;
    vi.stubGlobal("fetch", (entrada: RequestInfo | URL, init?: RequestInit) => {
      if (String(init?.method).toUpperCase() === "POST") cuerpos.push(JSON.parse(String(init?.body)));
      return delArnes(entrada, init);
    });
    await pulsar('button[role="switch"][aria-label="Incorporar obs_campo"]');
    await pulsar("button.pulso-button--primary", "Guardar");
    expect(cuerpos).toEqual([{ base_nombre: null, incluidas: ["obs_campo"] }]);
    expect(pedidosHechos()).toContain("POST /api/carga/review/reconciliation");
    fijar("una-base_revision_columnas-guardar");
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
