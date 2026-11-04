// @vitest-environment happy-dom
/**
 * La publicación (HF Spaces / Fly) monta `DashboardPage` directo desde `PublicArtifactApp`, FUERA del Router.
 * Un hook de router dentro de la página la tumba al montarse: pasó el 4 nov 2026, cuando el editor de
 * personalización se hizo direccionable con `usePanelDireccionable` dentro de la página (f46eff579). La URL se
 * lee en `DashboardRuta`, que sí está dentro del Router, y llega como prop.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import DashboardPage from "./DashboardPage";

const aqui = path.dirname(fileURLToPath(import.meta.url));

describe("DashboardPage en la publicación, sin Router", () => {
  it("se monta sin lanzar", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    expect(() => act(() => root.render(<DashboardPage publicMode />))).not.toThrow();
    act(() => root.unmount());
    host.remove();
  });

  it("la página no usa hooks de router: la URL la lee DashboardRuta", () => {
    const fuente = readFileSync(path.join(aqui, "DashboardPage.tsx"), "utf8").replace(/\/\/.*$/gm, "");
    expect(fuente).not.toMatch(/from "react-router-dom"|usePanelDireccionable|useDireccion\b|useSeccion\b|useLocation|useNavigate/);
  });
});
