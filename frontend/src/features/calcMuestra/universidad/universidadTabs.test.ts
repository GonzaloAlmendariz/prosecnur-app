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
      actor_id: "estudiantes_universidad",
      marco: {
        marco_validado: 0,
        estratos: [],
      },
      resultado: {
        n_objetivo: 120,
        aulas_base_total: 13,
      },
    },
    {
      actor_id: "estudiantes_facultad",
      marco: { marco_validado: 0, estratos: [] },
      resultado: { n_objetivo: 180, aulas_base_total: 20 },
    },
  ],
} as unknown as CalcMuestraEstudio;

const workspaceSinPublicacion = {
  version: 2,
  aulas_config: { n_aulas: 13 },
  motor_recorrido: {
    schema: "calc_muestra_workspace_motor_v1",
    fuente: "proyecto",
    perfil: null,
    decisiones: { escenario: "e1" },
    tocado: true,
  },
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
