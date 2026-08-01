import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { coberturaDelCorte } from "./coberturaDelCorte";

describe("coberturaDelCorte", () => {
  it("sin corte no hay cobertura que juzgar", () => {
    expect(coberturaDelCorte(undefined, "advance_summary")).toBe("sin-corte");
    expect(coberturaDelCorte(null, "advance_summary")).toBe("sin-corte");
    expect(coberturaDelCorte("", "advance_summary")).toBe("sin-corte");
  });

  it("el corte de la sección la cubre", () => {
    expect(coberturaDelCorte("advance_summary", "advance_summary")).toBe("cubre");
    expect(coberturaDelCorte("phone_summary", "phone_summary")).toBe("cubre");
  });

  // El backend sirve el corte completo cuando lo tiene cacheado y válido,
  // aunque se le pida uno más estrecho.
  it("un corte completo cubre cualquier sección", () => {
    expect(coberturaDelCorte("full", "queries_summary")).toBe("cubre");
    expect(coberturaDelCorte("full", "source")).toBe("cubre");
  });

  // El caso que se quedaba callado: una mutación devuelve el estado con SU
  // scope, no con el de la sección que se está mirando.
  it("el corte de otra sección se nombra, no se da por bueno", () => {
    expect(coberturaDelCorte("source", "advance_summary")).toBe("otra-seccion");
    expect(coberturaDelCorte("validation_summary", "phone_summary")).toBe("otra-seccion");
  });
});

describe("un corte de otra sección deja la vista trabajando, no lista", () => {
  const PERFILES = [
    ["telefonico", resolve(__dirname, "..", "profiles", "telefonico", "TelefonicoMonitoreoPage.tsx")],
    ["acreditacion", resolve(__dirname, "..", "profiles", "acreditacion", "AcreditacionMonitoreoPage.tsx")],
  ] as const;

  it.each(PERFILES)("%s no publica readiness con el corte de otra sección", (label, ruta) => {
    const fuente = readFileSync(ruta, "utf8");

    expect(fuente, `${label}: el desajuste debe contar como carga en curso`)
      .toContain('const seccionCargando = loading || Boolean(state && !error && cobertura === "otra-seccion");');
    expect(fuente, `${label}: la readiness cuelga de la carga de la sección, no de \`loading\` a secas`)
      .toContain("const auditReady = !seccionCargando && !error && Boolean(state);");
    expect(fuente, `${label}: la pantalla no puede verse terminada mientras falta su corte`)
      .toContain('data-audit-loading={seccionCargando ? "true" : "false"}');
    expect(fuente, `${label}: y el corte que falta se pide`)
      .toContain("void loadView(seccionActiva, true);");
    // Sin esto el desajuste dejaba de ser transitorio: el payload ajeno quedaba
    // archivado bajo el scope de la sección y se servía desde caché.
    expect(fuente, `${label}: el estado se archiva bajo el scope que trae`)
      .toContain("const reportScope = nextState.dashboard?.acreditacion_reports?.report_scope");
  });
});
