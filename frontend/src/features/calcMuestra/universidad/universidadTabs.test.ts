import { describe, expect, it } from "vitest";
import type {
  CalcMuestraEstudio,
  CalcMuestraWorkspace,
} from "../../../api/client";
import { universitySidebarTabs } from "./universidadTabs";

const estudioConResultado = {
  titulo: "Estudio mínimo",
  componentes: [
    {
      actor_id: "universidad_total",
      marco: {
        marco_validado: 0,
        estratos: [],
      },
      resultado: {
        n_objetivo: 120,
      },
    },
  ],
} as unknown as CalcMuestraEstudio;

const workspaceSinPublicacion = {
  version: 2,
} as unknown as CalcMuestraWorkspace;

describe("universitySidebarTabs — Salida", () => {
  it("mantiene el estado unido a la identidad al ordenar Tablas antes de Entregables", () => {
    const tabs = universitySidebarTabs({
      activeSection: "salidas",
      estudio: estudioConResultado,
      workspace: workspaceSinPublicacion,
      aulasState: null,
    });

    expect(tabs?.map(({ id, status }) => `${id}:${status}`)).toEqual([
      "salidas-guia:pending",
      "salidas-resultados:ready",
      "salidas-entregables:pending",
      "salidas-monitoreo:pending",
    ]);
  });
});
