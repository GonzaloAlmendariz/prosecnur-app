import { readFileSync } from "node:fs";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import type { CalcMuestraComponente, CalcMuestraResultado } from "../../../../../api/client";
import { defaultComponente } from "../../../sharedCore";
import { useMotorStore } from "../../../store";
import { UNIVERSITY_FACULTY_COMPONENT_ID, UNIVERSITY_TOTAL_COMPONENT_ID } from "../../shared/constants";
import { CalculoCursosHorarioFacultadTab } from "../CalculoCursosHorarioFacultadTab";

const sources = [
  new URL("../CalculoCursosHorarioFacultadTab.tsx", import.meta.url),
  new URL("../cursosHorarioResultadoModel.ts", import.meta.url),
].map((file) => readFileSync(file, "utf8")).join("\n");

function componentesConFrame(frameHash: string): [CalcMuestraComponente, CalcMuestraComponente] {
  const resultado = {
    aulas_por_estrato: [{
      estrato: "Derecho",
      N: 100,
      cuota: 20,
      avg_conglomerado: 5,
      tau: 1,
      aulas_base: 4,
      aulas_reemplazo: 1,
      aulas_total: 5,
      tipo_aula: "regular",
      precision_e: null,
      estadistico_usado: "media",
      alumnos_por_ch: {
        referencia: "marco_ejecutado",
        frame_hash: frameHash,
        denominador: "elegible",
        faculty_key: "derecho",
        estadistico: "media",
        valor: 5,
      },
    }],
    aulas_base_total: 4,
    aulas_extra_total: 1,
    aulas_total: 5,
    alumnos_por_ch_decision: {
      schema: "calc_muestra_alumnos_por_ch_decision_v1",
      frame_hash: frameHash,
      denominador: "elegible",
      estadistico_default: "media",
      confirmado_at: "2026-08-02T10:00:00Z",
    },
  } as unknown as CalcMuestraResultado;
  return [
    defaultComponente({ actor_id: UNIVERSITY_TOTAL_COMPONENT_ID, resultado }),
    defaultComponente({ actor_id: UNIVERSITY_FACULTY_COMPONENT_ID }),
  ];
}

function renderCourses(currentFrameHash: string): string {
  const props = {
    componentes: componentesConFrame("frame-calculado"),
    escenario: "e1",
    onEscenario: () => {},
    marcoDesactualizado: false,
    currentFrameHash,
  } as unknown as ComponentProps<typeof CalculoCursosHorarioFacultadTab>;
  return renderToStaticMarkup(createElement(CalculoCursosHorarioFacultadTab, props));
}

function confirmButton(html: string): string {
  const end = html.indexOf("Confirmar plan</button>");
  const start = html.lastIndexOf("<button", end);
  return start >= 0 && end >= 0 ? html.slice(start, end + "Confirmar plan</button>".length) : "";
}

beforeEach(() => {
  useMotorStore.getState().resetInicial();
});

describe("contrato Cálculo I18", () => {
  it("proyecta el resultado R sin selector ni aritmética estadística React", () => {
    expect(sources).not.toMatch(/MetodoEstAulaSelector|estudiantesPorAula|aula_frame|mediana\s*\(/);
    expect(sources).not.toMatch(/Math\.ceil|\.reduce\s*\(/);
    expect(sources).toMatch(/aulas_por_estrato/);
    expect(sources).toMatch(/alumnos_por_ch_decision/);
  });

  it("falla cerrado si cambia el frame aunque los criterios sigan iguales", () => {
    const stale = renderCourses("frame-nuevo-mismos-criterios");
    expect(stale).toContain('data-audit-ready="false"');
    expect(stale).toContain('data-frame-stale="true"');
    expect(confirmButton(stale)).toContain('disabled=""');

    const fresh = renderCourses("frame-calculado");
    expect(fresh).toContain('data-audit-ready="true"');
    expect(confirmButton(fresh)).not.toContain("disabled");
  });
});
