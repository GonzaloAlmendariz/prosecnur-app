// Los enlaces personalizados son lo que hace que un QR identifique su
// curso-horario sin pedirle un código al estudiante. Si el escapado o el
// separador fallan, el QR abre la encuesta sin unidad y la respuesta llega
// huérfana: no se nota al imprimir, se nota al procesar.

import { describe, expect, it } from "vitest";
import type { MonitoreoAulasPlanRow } from "../../../api/client";
import {
  KOBO_DEFAULT_BASE_URL,
  KOBO_PARAM_TEMPLATE,
  appendPersonalizedParams,
  cleanKoboBaseUrl,
  fillTemplate,
  rowTemplateContext,
} from "./plantilla";

const contexto = { curso_horario: "MAT146-0205", curso: "Cálculo 1", docente: "" };

describe("cleanKoboBaseUrl", () => {
  it("quita las barras finales y cae al servidor por defecto", () => {
    expect(cleanKoboBaseUrl("https://kf.example.org///")).toBe("https://kf.example.org");
    expect(cleanKoboBaseUrl("  ")).toBe(KOBO_DEFAULT_BASE_URL);
  });
});

describe("fillTemplate", () => {
  it("resuelve variables sin distinguir mayúsculas", () => {
    expect(fillTemplate("{CURSO_HORARIO}/x", contexto)).toBe("MAT146-0205/x");
  });

  it("una variable desconocida se va a vacío y no queda en la URL", () => {
    // Dejar `{loquesea}` produciría una URL con llaves que el proveedor
    // no entiende y que el operador no puede diagnosticar mirándola.
    expect(fillTemplate("a/{loquesea}/b", contexto)).toBe("a//b");
  });
});

describe("appendPersonalizedParams", () => {
  it("escapa los corchetes del parámetro de Kobo", () => {
    const out = appendPersonalizedParams("https://kf/x", KOBO_PARAM_TEMPLATE, contexto);
    expect(out).toBe("https://kf/x?d%5BcollectorID%5D=MAT146-0205");
  });

  it("respeta el query que la base ya trae", () => {
    expect(appendPersonalizedParams("https://kf/x?a=1", "b={curso_horario}", contexto))
      .toBe("https://kf/x?a=1&b=MAT146-0205");
    expect(appendPersonalizedParams("https://kf/x?", "b={curso_horario}", contexto))
      .toBe("https://kf/x?b=MAT146-0205");
    expect(appendPersonalizedParams("https://kf/x?a=1&", "b={curso_horario}", contexto))
      .toBe("https://kf/x?a=1&b=MAT146-0205");
  });

  it("escapa valores con espacios y acentos", () => {
    expect(appendPersonalizedParams("https://kf/x", "c={curso}", contexto))
      .toBe("https://kf/x?c=C%C3%A1lculo%201");
  });

  it("devuelve la base sola si no hay parámetros que pegar", () => {
    expect(appendPersonalizedParams("https://kf/x", "", contexto)).toBe("https://kf/x");
    // Una plantilla cuyas variables se resuelven todas a vacío no deja un `?` suelto.
    expect(appendPersonalizedParams("https://kf/x", "={docente}", contexto)).toBe("https://kf/x");
  });

  it("sin base no hay enlace", () => {
    expect(appendPersonalizedParams("", KOBO_PARAM_TEMPLATE, contexto)).toBe("");
  });
});

describe("rowTemplateContext", () => {
  it("expone la unidad con los dos nombres que han existido", () => {
    // `{aula}` es el vocabulario anterior al ADR 0046. Las plantillas escritas
    // con él siguen en proyectos guardados y deben seguir funcionando.
    const ctx = rowTemplateContext({ operational_code: "MAT146-0205" } as MonitoreoAulasPlanRow, null);
    expect(ctx.aula).toBe("MAT146-0205");
    expect(ctx.curso_horario).toBe("MAT146-0205");
  });

  it("no rompe cuando no hay formulario elegido", () => {
    const ctx = rowTemplateContext({ classroom_id: "A-1" } as MonitoreoAulasPlanRow, null);
    expect(ctx.asset_uid).toBe("");
    expect(ctx.version).toBe("");
  });
});
