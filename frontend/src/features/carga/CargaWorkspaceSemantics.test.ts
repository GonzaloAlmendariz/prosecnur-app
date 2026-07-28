import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(path.join(__dirname, "CargaPage.tsx"), "utf8");

describe("Carga workspace integration semantics", () => {
  it("mounts the dedicated five-destination navigation instead of a local tablist", () => {
    expect(pageSource).toContain('from "./CargaWorkspaceNavigation"');
    expect(pageSource).toContain("<CargaWorkspaceNavigation");
    expect(pageSource).toContain("onChange={goCargaWorkspaceTab}");
    expect(pageSource).not.toContain("function CargaWorkspaceSidebar");
    expect(pageSource).not.toContain('type CargaWorkspaceTab = "insumos" | "base"');
    expect(pageSource).toContain('role="tabpanel"');
    expect(pageSource).toContain(
      "aria-labelledby={cargaWorkspaceTabId(activeCargaTab)}",
    );
  });

  it("reads and writes pestana through the canonical direction API", () => {
    expect(pageSource).toContain(
      'import { useSeccion } from "../../lib/navegacion/useDireccion"',
    );
    expect(pageSource).toContain('useSeccion("procesamiento")');
    expect(pageSource).toContain(
      "resolveCargaWorkspaceTab(cargaDireccion.pestana, workspaceContext)",
    );
    expect(pageSource).toContain(
      'cargaDireccion.irA("pestana", next === "plan" ? null : next, { replace })',
    );
  });

  it("does not keep legacy insumos/base ids as navigation destinations", () => {
    expect(pageSource).not.toMatch(/\bactiveCargaTab\s*===\s*["'](?:insumos|base)["']/);
    expect(pageSource).not.toMatch(/\bsetActiveCargaTab\s*\(\s*["'](?:insumos|base)["']/);
  });

  it("does not claim readiness from files owned by another module", () => {
    expect(pageSource).toContain(
      "const hasXlsform = !!state?.xlsform && !!state.instrumento_parsed",
    );
    expect(pageSource).toContain(
      "const hasData = !!state?.data && !!state.data_previewed",
    );
    expect(pageSource).toContain("if (!state?.instrumento_parsed || !state?.data_previewed)");
    expect(pageSource).toContain('title="Aún no hay datos de Carga para explorar"');
  });

  it("publishes a stable QA readiness marker after the active topology loads", () => {
    expect(pageSource).toContain(
      'auditReady={isMultiBase && !estudio ? false : `carga-${activeCargaTab}`}',
    );
  });
});
