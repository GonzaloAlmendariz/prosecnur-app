import { describe, expect, it } from "vitest";
import type {
  CalcMuestraEstudio,
  CalcMuestraWorkspace,
} from "../../../api/client";
import {
  resolveUniversityClassroomTab,
  universitySidebarTabs,
} from "./universidadTabs";
import { CALC_MUESTRA_UNIVERSIDAD_PESTANAS } from "../../../lib/navegacion/catalogos/calcMuestra";

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
      "salidas-coincidencia:ready",
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

  it("expone solo las diez pestañas vivas y conserva sus gates", () => {
    // ADR 0067: «Relato» (aulas-relato) entra junto a Sustento con el mismo
    // gate que Perfil — narra la selección persistida, así que existe en
    // cuanto ella existe.
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
      "solidez:pending",
      "perfil:pending",
      "reemplazos:pending",
      "aulas-relato:pending",
      "auditoria:working",
      // ADR 0082: la última. Se habilita con el cálculo por facultad y sólo se
      // acredita cuando una corrida rerandomizó de verdad — darla por lista con
      // sólo tener selección la pintaría verde sin que nadie aceptara ni
      // rechazara nada.
      "aulas-rerandomizacion:working",
    ]);
  });
});

describe("universitySidebarTabs — el strip no puede quedarse corto", () => {
  // Las pestañas se declaran en el catálogo de navegación y el strip las
  // consume desestructurando por posición: `const [a, b, c, d] = …`. Esa forma
  // DESCARTA EN SILENCIO todo lo que venga después, así que declarar una
  // pestaña nueva en el catálogo la deja enrutable —la URL responde, el panel
  // monta— pero invisible: no hay botón para llegar. Pasó al añadir
  // «¿Alcanza?» (2026-08-27), y ningún test lo vio porque los de contrato
  // cuentan el catálogo, que sí tenía las cinco.
  const secciones = ["definicion", "marco", "calculo", "salidas"] as const;

  it.each(secciones)("%s publica todas las pestañas que declara el catálogo", (seccion) => {
    const tabs = universitySidebarTabs({
      activeSection: seccion,
      estudio: estudioConResultado,
      workspace: workspaceSinPublicacion,
      aulasState: null,
    });

    expect(tabs?.map((tab) => tab.id)).toEqual(
      CALC_MUESTRA_UNIVERSIDAD_PESTANAS[seccion].map((tab) => tab.id),
    );
  });
});
