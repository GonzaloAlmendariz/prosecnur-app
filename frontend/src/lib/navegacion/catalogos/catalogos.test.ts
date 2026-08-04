import { describe, expect, it } from "vitest";
import { CLASSROOM_LAB_TABS } from "../../../features/calcMuestra/universidad/shared/constants";
import { CARGA_WORKSPACE_TABS } from "../../../features/carga/CargaWorkspaceModel";
import {
  DEFAULT_TABS_ENABLED,
} from "../../../features/dashboard/store";
import { PROSECNUR_MODULES } from "../../modules";
import {
  CALC_MUESTRA_UNIVERSIDAD_PESTANAS,
  TOTAL_PESTANAS_CALC_MUESTRA_UNIVERSIDAD,
} from "./calcMuestra";
import { DASHBOARD_PESTANAS } from "./dashboard";
import {
  PROCESAMIENTO_PESTANAS,
  TOTAL_PESTANAS_PROCESAMIENTO,
  pestanasAnaliticaDisponibles,
} from "./procesamiento";

function firma(pestanas: readonly { id: string; label: string }[]) {
  return pestanas.map(({ id, label }) => `${id}:${label}`);
}

describe("catálogos canónicos de pestañas", () => {
  it("fija las 26 pestañas vivas de Muestra universitaria con su orden y copy", () => {
    expect(TOTAL_PESTANAS_CALC_MUESTRA_UNIVERSIDAD).toBe(26);
    expect(firma(CALC_MUESTRA_UNIVERSIDAD_PESTANAS.definicion)).toEqual([
      "def-estudio:Estudio",
      "def-bases:Fuentes",
      // D10: Consistencia inmediatamente después de Fuentes.
      "def-consistencia:Consistencia",
      "def-variables:Variables",
      // G42 · Mirar la base es parte de Datos, no de Marco: Marco decide qué
      // entra, Datos enseña lo que hay.
      "def-explorador:Explorador",
      // La base de un estudio anterior no construye el marco; se declara aparte
      // y al final, para no leerse como una fuente más.
      "def-historico:Histórico",
    ]);
    expect(firma(CALC_MUESTRA_UNIVERSIDAD_PESTANAS.marco)).toEqual([
      "marco-criterios-alumno:Criterios del estudiante",
      "marco-alumnos-ch:Alumnos por CH",
      "marco-ch-radiografia:Cursos-horario: criterios + radiografía",
      "marco-poblacion:Población",
      "marco-aulas:Cursos-horario",
      "marco-cobertura:Cobertura",
    ]);
    expect(firma(CALC_MUESTRA_UNIVERSIDAD_PESTANAS.calculo)).toEqual([
      "calculo-diseno:Diseño",
      "calculo-propuestas:Propuestas",
      "calculo-ch-facultad:Cursos-horario requeridos",
      "calculo-distribucion:Distribución",
    ]);
    expect(CALC_MUESTRA_UNIVERSIDAD_PESTANAS.calculo[2]).toMatchObject({
      id: "calculo-ch-facultad",
      label: "Cursos-horario requeridos",
      targetId: "cmv2-local-calculo-ch-facultad",
    });
    expect(firma(CALC_MUESTRA_UNIVERSIDAD_PESTANAS.aulas)).toEqual([
      "objetivo:Objetivo de muestra",
      "metodo:Comparar métodos",
      "laboratorio:Simulación",
      "seleccion:Cursos-horario titulares",
      "reemplazos:Reemplazos por curso-horario",
      "auditoria:Sustento técnico",
    ]);
    expect(firma(CALC_MUESTRA_UNIVERSIDAD_PESTANAS.salidas)).toEqual([
      "salidas-guia:Cierre",
      "salidas-resultados:Tablas",
      "salidas-entregables:Entregables",
      "salidas-monitoreo:Pase a Monitoreo",
    ]);
  });

  it("fija las 25 pestañas de Procesamiento con su orden y copy", () => {
    expect(TOTAL_PESTANAS_PROCESAMIENTO).toBe(25);
    expect(firma(PROCESAMIENTO_PESTANAS.carga)).toEqual([
      "plan:Plan",
      "fuentes:Fuentes",
      "revision:Revisión",
      "estructura:Estructura",
      "datos:Datos",
    ]);
    expect(firma(PROCESAMIENTO_PESTANAS.validacion)).toEqual([
      "explorar:Explorar respuestas",
      "instrumento:Reglas del formulario",
      "reglas_custom:Criterios de revisión",
      "limpieza:Cierre de base",
    ]);
    expect(firma(PROCESAMIENTO_PESTANAS.codificacion)).toEqual([
      "organizar:Preparar",
      "codificar:Codificar",
      "matrices:Matrices",
      "adaptar:Adaptación",
    ]);
    expect(firma(PROCESAMIENTO_PESTANAS.analitica)).toEqual([
      "datos:Datos",
      "base_final:Base final",
      "codebook:Libro de códigos",
      "bases:Bases e instrumentos",
      "ponderacion:Ponderación",
      "frecuencias:Frecuencias",
      "multibase:Tablas multibase",
      "panel:Base panel",
      "ficha:Ficha técnica",
      "cruces:Cruces",
      "orden:Orden de categorías",
      "dimensiones:Dimensiones",
    ]);
  });

  it("fija las cuatro pestañas de Dashboard sin fabricar rutas por pestaña", () => {
    expect(firma(DASHBOARD_PESTANAS)).toEqual([
      "resumen:Resumen",
      "relaciones:Relaciones",
      "base_datos:Base de datos",
      "dimensiones:Dimensiones",
    ]);
    expect(DASHBOARD_PESTANAS.every((tab) => tab.to === "/tablero")).toBe(true);
    expect(DASHBOARD_PESTANAS.every((tab) => !tab.direccionPublicada)).toBe(true);
  });

  it("mantiene ids, claves y direcciones públicas coherentes", () => {
    const auditables: Array<{
      seccion: string;
      id: string;
      key: string;
      to: string;
      direccionPublicada: boolean;
    }> = [];

    for (const [seccion, pestanas] of Object.entries(
      CALC_MUESTRA_UNIVERSIDAD_PESTANAS,
    )) {
      for (const tab of pestanas) {
        expect(tab.id).toBe(tab.key);
        expect(tab.to).toBe(
          `/calc-muestra?modo=opinion-universitaria&seccion=${seccion}&pestana=${tab.id}`,
        );
        expect(tab.direccionPublicada).toBe(true);
      }
    }
    // D10 ejecutada: Consistencia dejó de ser una subpágina sin dirección y es
    // una pestaña con la suya, inmediatamente después de Fuentes.
    const consistencia = Object.values(CALC_MUESTRA_UNIVERSIDAD_PESTANAS)
      .flat()
      .find((tab) => String(tab.id) === "def-consistencia");
    expect(consistencia).toBeDefined();
    expect(consistencia?.to).toBe(
      "/calc-muestra?modo=opinion-universitaria&seccion=definicion&pestana=def-consistencia",
    );
    expect(CALC_MUESTRA_UNIVERSIDAD_PESTANAS.definicion[1].to).toBe(
      "/calc-muestra?modo=opinion-universitaria&seccion=definicion&pestana=def-bases",
    );
    expect(CALC_MUESTRA_UNIVERSIDAD_PESTANAS.definicion[2].id).toBe("def-consistencia");

    for (const [seccion, pestanas] of Object.entries(PROCESAMIENTO_PESTANAS)) {
      for (const tab of pestanas) {
        expect(tab.id).toBe(tab.key);
        auditables.push({ seccion, ...tab });
        if (tab.direccionPublicada) {
          expect(tab.to).toBe(`/${seccion}?pestana=${tab.id}`);
        }
      }
    }
    for (const tab of DASHBOARD_PESTANAS) {
      expect(tab.id).toBe(tab.key);
      auditables.push({ seccion: "dashboard", ...tab });
    }

    expect(
      auditables
        .filter((tab) => !tab.direccionPublicada)
        .map((tab) => `${tab.seccion}/${tab.id}`),
    ).toEqual([
      "validacion/explorar",
      "validacion/instrumento",
      "validacion/reglas_custom",
      "validacion/limpieza",
      "dashboard/resumen",
      "dashboard/relaciones",
      "dashboard/base_datos",
      "dashboard/dimensiones",
    ]);
  });

  it("declara multibase como posibilidad estática y la filtra solo en runtime", () => {
    expect(
      PROCESAMIENTO_PESTANAS.analitica
        .filter((tab) => tab.disponibilidad === "condicional")
        .map((tab) => tab.id),
    ).toEqual(["multibase"]);
    expect(
      pestanasAnaliticaDisponibles({
        multibaseDisponible: true,
        basesHermanasIndependientes: false,
      }),
    ).toHaveLength(12);
    expect(
      pestanasAnaliticaDisponibles({
        multibaseDisponible: false,
        basesHermanasIndependientes: false,
      }).some((tab) => tab.id === "multibase"),
    ).toBe(false);
    expect(
      pestanasAnaliticaDisponibles({
        multibaseDisponible: true,
        basesHermanasIndependientes: true,
      }).some((tab) => tab.id === "multibase"),
    ).toBe(false);
  });

  it("comparte por referencia el catálogo con módulos y modelos de página", () => {
    const muestra = PROSECNUR_MODULES.find((module) => module.slug === "calc-muestra");
    const universidad = muestra?.modos?.find(
      (modo) => modo.id === "opinion-universitaria",
    );
    const procesamiento = PROSECNUR_MODULES.find(
      (module) => module.slug === "procesamiento",
    );
    const dashboard = PROSECNUR_MODULES.find((module) => module.slug === "dashboard");

    for (const [seccion, pestanas] of Object.entries(
      CALC_MUESTRA_UNIVERSIDAD_PESTANAS,
    )) {
      expect(universidad?.sections.find((item) => item.id === seccion)?.tabs).toBe(
        pestanas,
      );
    }
    for (const [seccion, pestanas] of Object.entries(PROCESAMIENTO_PESTANAS)) {
      expect(procesamiento?.sections.find((item) => item.id === seccion)?.tabs).toBe(
        pestanas,
      );
    }
    expect(dashboard?.sections[0]?.tabs).toBe(DASHBOARD_PESTANAS);
    expect(CARGA_WORKSPACE_TABS).toBe(PROCESAMIENTO_PESTANAS.carga);
    expect(CLASSROOM_LAB_TABS).toBe(CALC_MUESTRA_UNIVERSIDAD_PESTANAS.aulas);
    expect(DEFAULT_TABS_ENABLED).toEqual({
      resumen: true,
      relaciones: true,
      base_datos: true,
      dimensiones: true,
    });
  });
});
