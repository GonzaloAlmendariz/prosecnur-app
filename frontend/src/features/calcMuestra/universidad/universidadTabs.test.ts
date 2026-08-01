import { describe, expect, it } from "vitest";
import type {
  CalcMuestraEstudio,
  CalcMuestraWorkspace,
} from "../../../api/client";
import {
  resolveUniversityClassroomTab,
  universitySidebarTabs,
} from "./universidadTabs";

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

describe("universitySidebarTabs — Selección", () => {
  it("cae en Objetivo cuando la pestaña se omite o ya no existe", () => {
    expect(resolveUniversityClassroomTab(null)).toBe("objetivo");
    expect(resolveUniversityClassroomTab(undefined)).toBe("objetivo");
    expect(resolveUniversityClassroomTab("marco")).toBe("objetivo");
    expect(resolveUniversityClassroomTab("fuera-del-catalogo")).toBe("objetivo");
    expect(resolveUniversityClassroomTab("auditoria")).toBe("auditoria");
  });

  it("expone solo las seis pestañas vivas y conserva sus gates", () => {
    const tabs = universitySidebarTabs({
      activeSection: "aulas",
      estudio: estudioConResultado,
      workspace: workspaceSinPublicacion,
      aulasState: null,
    });

    expect(tabs?.map(({ id, status }) => `${id}:${status}`)).toEqual([
      "objetivo:ready",
      "metodo:working",
      "laboratorio:working",
      "seleccion:pending",
      "reemplazos:pending",
      "auditoria:working",
    ]);
  });
});
