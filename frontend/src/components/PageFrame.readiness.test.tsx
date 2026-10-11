import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { estadoListo } from "../lib/navegacion/runtime";
import { PageFrame } from "./PageFrame";

// El runtime lee TODAS las marcas en orden de árbol (`querySelectorAll`), que es
// el orden de los tags de apertura del HTML serializado. Este documento mínimo
// reproduce esa regla sobre el marcado del frame, sin jsdom.
function montarDocumento(markup: string) {
  const valores = Array.from(markup.matchAll(/data-audit-ready="([^"]*)"/g), (m) => m[1]);
  vi.stubGlobal("document", {
    querySelector: () => null,
    querySelectorAll(selector: string) {
      if (selector !== "[data-audit-ready]") return [];
      return valores.map((valor) => ({
        getAttribute: (nombre: string) => (nombre === "data-audit-ready" ? valor : null),
        parentElement: null,
        classList: { item: () => null },
        tagName: "DIV",
        id: "",
      }));
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
    expect(estadoListo()).toMatchObject({ listo: false, motivo: "marca-en-false", marca: "false" });
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
