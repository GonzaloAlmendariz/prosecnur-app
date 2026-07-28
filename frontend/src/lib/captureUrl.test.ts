import { describe, expect, test } from "vitest";
import { captureUrlIssue, captureUrlMessage, captureUrlOk, captureUrlWarning } from "./captureUrl";

// Los mismos casos viven en api/tests/testthat/test-capture-url.R: si uno cambia,
// el otro tiene que cambiar con él.

describe("captureUrlIssue", () => {
  test("la landing administrativa de Kobo no es una URL de captura", () => {
    expect(captureUrlIssue("https://kf.kobotoolbox.org/#/forms/aXbYcZ/landing")).toBe("landing_kobo");
    expect(captureUrlOk("https://kobo.unhcr.org/#/forms/asset_unhcr/landing")).toBe(false);
    expect(captureUrlMessage("landing_kobo")).toContain("formulario web");
  });

  test("cualquier fragmento invalida la URL de captura", () => {
    expect(captureUrlIssue("https://ee.kobotoolbox.org/x/abc123#seccion")).toBe("fragmento");
    expect(captureUrlMessage("fragmento")).toContain("'#'");
  });

  test("acepta formularios web reales de Kobo y SurveyMonkey", () => {
    expect(captureUrlOk("https://ee.kobotoolbox.org/x/abc123")).toBe(true);
    expect(captureUrlOk("https://ee.kobotoolbox.org/single/abc123")).toBe(true);
    expect(captureUrlOk("https://kf.kobotoolbox.org/x/aXbYcZ?d[collectorID]=AULA-001")).toBe(true);
    expect(captureUrlOk("https://www.surveymonkey.com/r/ABCDEF?aula=AULA-001")).toBe(true);
  });

  test("rechaza vacío y esquemas no http", () => {
    expect(captureUrlIssue("")).toBe("vacia");
    expect(captureUrlIssue("   ")).toBe("vacia");
    expect(captureUrlIssue(null)).toBe("vacia");
    expect(captureUrlIssue(undefined)).toBe("vacia");
    expect(captureUrlIssue("kf.kobotoolbox.org/x/abc")).toBe("no_http");
    expect(captureUrlIssue("javascript:alert(1)")).toBe("no_http");
  });

  test("captureUrlWarning explica el problema y calla cuando la URL sirve", () => {
    expect(captureUrlWarning("https://kf.kobotoolbox.org/#/forms/aXbYcZ/landing")).toContain("Kobo");
    expect(captureUrlWarning("https://ee.kobotoolbox.org/x/abc123")).toBe("");
  });
});
