import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CriterioComposicionCard } from "../CriterioComposicionCard";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../../api/client";

/**
 * ADR 0057 · Una regla activa no puede estar plegada.
 *
 * «Prevalencia de elegibles» es una métrica heredada que normalmente está
 * apagada, y por eso vivía tras un control cerrado. Encendida **recorta el
 * marco**: dejarla detrás de un plegado no la hace difícil de encontrar, la hace
 * invisible mientras opera. Apagada sigue contenida —una opción inactiva no es
 * contenido oculto—.
 */
function config(activa: boolean): CalcMuestraWorkspaceAulasConfig {
  return { require_min_prevalence: activa, min_prevalence: 0.5 } as unknown as CalcMuestraWorkspaceAulasConfig;
}

describe("CriterioComposicionCard · prevalencia heredada", () => {
  it("activa, se muestra abierta", () => {
    const html = renderToStaticMarkup(<CriterioComposicionCard config={config(true)} onPatch={vi.fn()} />);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("cmv2-crit-legacy-body");
  });

  it("apagada, queda contenida sin ocupar la superficie", () => {
    const html = renderToStaticMarkup(<CriterioComposicionCard config={config(false)} onPatch={vi.fn()} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("cmv2-crit-legacy-body");
  });
});
