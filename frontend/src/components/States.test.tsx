import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { Inbox } from "../vendor/lucide-react";
import { EmptyState, emptyStateClasses } from "./States";

describe("EmptyState — D4: el marco es de la superficie", () => {
  test("por defecto es `en-superficie` y emite el alias viejo de transición", () => {
    const html = renderToStaticMarkup(<EmptyState icon={<Inbox size={20} />} title="Sin datos" />);
    expect(html).toContain(
      'class="pulso-empty-state pulso-empty-state--en-superficie pulso-empty-state--panel"',
    );
  });

  test("`panel` (deprecado) resuelve igual que `en-superficie`", () => {
    expect(emptyStateClasses("panel")).toBe(emptyStateClasses("en-superficie"));
  });

  test("`inline` no arrastra el alias", () => {
    expect(emptyStateClasses("inline")).toBe("pulso-empty-state pulso-empty-state--inline");
  });

  test("título, pista y cta; sin readiness propia", () => {
    const html = renderToStaticMarkup(
      <EmptyState icon={<Inbox size={20} />} title="Sin bases" hint="Sube una base" cta={<button>Subir</button>} />,
    );
    expect(html).toContain('<h4 class="pulso-empty-state-title">Sin bases</h4>');
    expect(html).toContain('<p class="pulso-empty-state-hint">Sube una base</p>');
    expect(html).toContain('<div class="pulso-empty-state-cta"><button>Subir</button></div>');
    expect(html).not.toContain("data-audit-ready");
  });
});
