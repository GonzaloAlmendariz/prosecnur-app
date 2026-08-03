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
  /*
   * G33 · Estos dos casos fijaban el plegado, y Gonzalo lo retiró: «quedamos en
   * que ya ninguno se colapsa».
   *
   * El argumento que sostenían —«apagada queda contenida sin ocupar la
   * superficie»— es la racionalización que la regla prohíbe: quien no la abre no
   * sabe que existe, y una métrica que puede cambiar un denominador no puede
   * depender de que alguien la descubra.
   *
   * Un test puede fijar un defecto con la misma firmeza con que fija una
   * reparación; éstos fijaban uno.
   */
  it("se muestra siempre, activa o apagada", () => {
    for (const activa of [true, false]) {
      const html = renderToStaticMarkup(
        <CriterioComposicionCard config={config(activa)} onPatch={vi.fn()} />,
      );
      expect(html, String(activa)).toContain("cmv2-crit-legacy-body");
    }
  });

  it("apagada se declara apagada, no se esconde", () => {
    const html = renderToStaticMarkup(<CriterioComposicionCard config={config(false)} onPatch={vi.fn()} />);
    expect(html).toContain("Prevalencia de elegibles (referencial)");
    expect(html).not.toContain("· activa");
  });

  it("no queda un botón que no controle nada", () => {
    // Un control que no controla invita a un click que no hace nada.
    const html = renderToStaticMarkup(<CriterioComposicionCard config={config(false)} onPatch={vi.fn()} />);
    expect(html).not.toContain("cmv2-crit-exc-toggle");
  });
});
