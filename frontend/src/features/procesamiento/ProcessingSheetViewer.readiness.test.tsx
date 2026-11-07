import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProcessingSheetViewer } from "./ProcessingSheetViewer";

/**
 * Readiness ≠ render (L29, 2026-11-01): Analítica › Base final publicaba su
 * marca mientras el visor mostraba «Armando vista previa». Sin datos ni error,
 * el visor dice «todavía no» (false) y bloquea a la marca de la pestaña.
 */
describe("ProcessingSheetViewer · readiness", () => {
  test("sin datos todavía, el visor publica data-audit-ready=false", () => {
    const html = renderToStaticMarkup(
      <ProcessingSheetViewer title="Base final" sourceLabel="Resultados" load={() => new Promise(() => {})} />,
    );
    expect(html).toMatch(/<section[^>]*aria-label="Base final"[^>]*data-audit-ready="false"/);
  });

  test("deshabilitado no es una espera: no publica false", () => {
    const html = renderToStaticMarkup(
      <ProcessingSheetViewer title="Base final" sourceLabel="Resultados" enabled={false} load={() => new Promise(() => {})} />,
    );
    expect(html).not.toContain('data-audit-ready="false"');
  });
});
