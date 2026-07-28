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
  it("shows the active workspace name, status and contextual description", async () => {
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
    expect(html).toContain("Hay incidencias de carga que requieren una decisión.");
  });
});
