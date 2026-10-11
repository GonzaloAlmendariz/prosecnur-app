import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { estadoListo } from "../lib/navegacion/runtime";
import { PageFrame } from "./PageFrame";

// `document.querySelector` devuelve el primer elemento en orden de árbol, que
// es el primer tag de apertura del HTML serializado. Este documento mínimo
// reproduce exactamente esa regla sobre el marcado del frame, sin jsdom.
function montarDocumento(markup: string) {
  vi.stubGlobal("document", {
    querySelector(selector: string) {
      if (selector !== "[data-audit-ready]") return null;
      const match = /data-audit-ready="([^"]*)"/.exec(markup);
      if (!match) return null;
      return { getAttribute: () => match[1] };
    },
  });
}

function frame(auditReady: string | false | undefined) {
  return renderToStaticMarkup(
    <PageFrame title="Carga" auditReady={auditReady}>
      <div className="pulso-recon-panel" data-audit-ready="true" />
    </PageFrame>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PageFrame y la readiness de QA", () => {
  it("un frame que todavía carga no queda tapado por la marca de un hijo", () => {
    const markup = frame(false);

    // Antes el frame omitía el atributo y el runtime tomaba la marca del
    // panel de variables extra: Carga › Revisión salía «lista» leyendo.
    expect(markup).toContain('data-audit-ready="false"');
    montarDocumento(markup);
    expect(estadoListo()).toEqual({ listo: false, motivo: "marca-en-false", marca: "false" });
  });

  it("un frame listo gana sobre las marcas descendientes", () => {
    montarDocumento(frame("carga-revision"));
    expect(estadoListo()).toEqual({ listo: true, marca: "carga-revision" });
  });

  it("sin auditReady el frame no declara nada y delega en sus hijos", () => {
    const markup = frame(undefined);

    expect(markup.match(/data-audit-ready=/g)).toHaveLength(1);
    montarDocumento(markup);
    expect(estadoListo()).toEqual({ listo: true, marca: "true" });
  });
});
