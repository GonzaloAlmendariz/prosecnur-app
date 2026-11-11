import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(path.join(__dirname, "CargaPage.tsx"), "utf8");
const mesaSource = fs.readFileSync(path.join(__dirname, "pestanas", "MesaDeCarga.tsx"), "utf8");
const modeloSource = fs.readFileSync(path.join(__dirname, "pestanas", "useModeloCarga.ts"), "utf8");
const hojaSource = fs.readFileSync(path.join(__dirname, "pestanas", "HojaBaseCarga.tsx"), "utf8");

describe("Carga workspace integration semantics", () => {
  it("mounts the dedicated five-destination navigation instead of a local tablist", () => {
    // La mesa monta el riel y el panel; la página le entrega el cambio de pestaña.
    expect(mesaSource).toContain('from "../CargaWorkspaceNavigation"');
    expect(mesaSource).toContain("<CargaWorkspaceNavigation");
    expect(mesaSource).toContain("onChange={onCambiar}");
    expect(pageSource).toContain("onCambiar={goCargaWorkspaceTab}");
    expect(pageSource).not.toContain("function CargaWorkspaceSidebar");
    expect(pageSource).not.toContain('type CargaWorkspaceTab = "insumos" | "base"');
    expect(mesaSource).toContain('role="tabpanel"');
    expect(mesaSource).toContain(
      "aria-labelledby={cargaWorkspaceTabId(activa)}",
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
    expect(modeloSource).toContain(
      "const hasXlsform = !!state?.xlsform && !!state.instrumento_parsed",
    );
    expect(modeloSource).toContain(
      "const hasData = !!state?.data && !!state.data_previewed",
    );
    expect(pageSource).toContain("if (!state?.instrumento_parsed || !state?.data_previewed)");
    expect(hojaSource).toContain('titulo="Aún no hay datos de Carga para explorar"');
  });

  it("publishes a stable QA readiness marker only after the session, bases and Revisión load", () => {
    // Revisión además espera la lectura de la base elegida, la marca se escribe
    // "false" (omitirla dejaba que una marca descendiente dijera "true") y no hay
    // marca mientras la página se hidrata (L4).
    expect(pageSource).toMatch(
      /auditReady=\{\s*\(isMultiBase && !estudio\) \|\| \(activeCargaTab === "revision" && !revisionEstado\.completa\)\s*\? "false"\s*: marcaReadinessCarga\(hidratacion, activeCargaTab\) \|\| "false"\s*\}/u,
    );
    expect(modeloSource).toContain("hayEstadoSesion: state !== null");
    expect(pageSource).toContain('(!isMultiBase && hidratacion.fase === "lista")');
  });
});
