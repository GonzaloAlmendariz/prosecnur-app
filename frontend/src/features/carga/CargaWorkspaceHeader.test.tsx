import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  CargaWorkspaceContext,
  CargaWorkspaceTab,
} from "./CargaWorkspaceModel";

type HeaderProps = {
  active: CargaWorkspaceTab;
  context: CargaWorkspaceContext;
};

const ATTENTION_CONTEXT: CargaWorkspaceContext = {
  hasInstrument: true,
  hasData: true,
  hasBase: true,
  hasReviewIssues: true,
  isMultiBase: true,
  baseCount: 3,
};

describe("CargaWorkspaceHeader", () => {
  it("muestra el nombre de la pestaña, su estado y el detalle del catálogo", async () => {
    const module = await vi.importActual("./CargaWorkspaceHeader") as {
      CargaWorkspaceHeader: ComponentType<HeaderProps>;
    };
    const html = renderToStaticMarkup(
      <module.CargaWorkspaceHeader
        active="revision"
        context={ATTENTION_CONTEXT}
      />,
    );

    expect(html).toContain("Revisión");
    expect(html).toContain("Requiere atención");
    // El detalle es el del catálogo (ADR 0142), el mismo que se ve mientras hidrata.
    expect(html).toContain("Decisiones pendientes de la carga");
    // El rótulo superior es solo "Carga": sin "pestaña n de m".
    expect(html).not.toMatch(/pestaña\s+\d+\s+de\s+\d+/i);
  });

  it("Variables no declara estado: no sabe cuál es sin leer cada base", async () => {
    const module = await vi.importActual("./CargaWorkspaceHeader") as {
      CargaWorkspaceHeader: ComponentType<HeaderProps>;
    };
    const html = renderToStaticMarkup(
      <module.CargaWorkspaceHeader active="variables" context={ATTENTION_CONTEXT} />,
    );
    expect(html).toContain("Variables");
    expect(html).toContain("Columnas fuera del formulario y variables calculadas");
    for (const palabra of ["Listo", "Pendiente", "Requiere atención", "Por definir"]) {
      expect(html).not.toContain(palabra);
    }
  });
});
