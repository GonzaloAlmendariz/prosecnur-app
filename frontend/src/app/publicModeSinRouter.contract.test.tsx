// @vitest-environment happy-dom
/**
 * La publicación (HF Spaces / Fly, `isPublicMode()`) monta `PublicArtifactApp` sin `BrowserRouter`: no hay
 * shell admin ni rutas. Todo lo que esa app alcanza —el tablero y el informe público de Monitoreo, con lo que
 * importan— tiene que vivir sin Router. Un hook de router ahí (`useLocation`, `usePanelDireccionable`,
 * `useFoco`, `useSearchParams`…) lanza al montarse y la publicación queda en blanco. Pasó el 4 nov 2026: el
 * editor de personalización del tablero se hizo direccionable dentro de `DashboardPage` (f46eff579) y lo
 * atrapó el verificador antes de publicarse (7453e06dc).
 *
 * Patrón: la ruta de la app admin lee la dirección y la pasa como prop; la página pública tiene respaldo local
 * (ver `DashboardRuta` → `DashboardPage`). Un componente compartido puede usar el router sólo si antes pregunta
 * `useInRouterContext()` y tiene un camino sin él (`components/Dialog.tsx`): esos van en GUARDADOS.
 *
 * Dos pruebas: el cierre de imports de las páginas públicas, leído del árbol, no toca hooks de router fuera de
 * GUARDADOS; y cada página pública se monta sin Router sin lanzar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "../features/dashboard/DashboardPage";
import MonitoreoPublicReportPage from "../features/monitoreo/public/MonitoreoPublicReportPage";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join("/");

/** Lo que `PublicArtifactApp` monta: se lee de su fuente para que una página pública nueva entre sola. */
const APP_PUBLICA = path.join(SRC, "app/PublicArtifactApp.tsx");

/**
 * Archivos del cierre que usan el router con guarda. Cada uno debe llamar a `useInRouterContext`; el panel
 * direccionable (`lib/navegacion/paneles.ts`) sólo se alcanza por `<Dialog panel=…>`/`<Sideover panel=…>`, que
 * el cierre público tiene prohibido abajo.
 */
const GUARDADOS: Record<string, string> = {
  "components/Dialog.tsx": "OverlayBase pregunta useInRouterContext y sin Router resuelve el módulo por prop",
  "lib/navegacion/paneles.ts": "sólo lo usa OverlayDePanel, al que se llega con la prop `panel`",
};

const HOOKS_DE_ROUTER =
  /\b(useDireccion|usePanelDireccionable|useFoco|useSeccion|usePestana|useIrA|useSearchParams|useNavigate|useLocation|useParams|useMatch|useHref|useNavigationType|useOutletContext|useLinkClickHandler)\s*\(|<(Link|NavLink|Navigate|Outlet)\b/g;
const PANEL_DIRECCIONABLE = /<(Dialog|Sideover)\b[^>]*\bpanel=/;

const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function resolver(desde: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(desde), spec);
  for (const c of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/** Cierre de imports estáticos y dinámicos (`import()`, `lazyWithReload`) desde las raíces. */
export function cierreDeImports(raices: string[]): Map<string, string | null> {
  const vistos = new Map<string, string | null>();
  const pila: Array<[string, string | null]> = raices.map((r) => [r, null]);
  while (pila.length) {
    const [f, padre] = pila.pop()!;
    if (vistos.has(f)) continue;
    vistos.set(f, padre);
    if (!/\.tsx?$/.test(f)) continue;
    const src = sinComentarios(fs.readFileSync(f, "utf8"));
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
      const r = resolver(f, m[1] ?? m[2]);
      if (r && !vistos.has(r)) pila.push([r, f]);
    }
  }
  return vistos;
}

export function hooksDeRouter(fuente: string): string[] {
  return [...new Set([...sinComentarios(fuente).matchAll(HOOKS_DE_ROUTER)].map((m) => m[1] ?? m[2]))];
}

describe("modo público sin Router: el cierre de imports", () => {
  const cierre = cierreDeImports([APP_PUBLICA]);
  const fuentes = [...cierre.keys()].filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));

  it("alcanza las dos páginas públicas (si no, el barrido está ciego)", () => {
    const rutas = fuentes.map(rel);
    expect(rutas).toContain("features/dashboard/DashboardPage.tsx");
    expect(rutas).toContain("features/monitoreo/public/MonitoreoPublicReportPage.tsx");
  });

  it("no usa hooks de router fuera de los guardados", () => {
    const fallas = fuentes
      .filter((f) => !(rel(f) in GUARDADOS))
      .map((f) => ({ archivo: rel(f), hooks: hooksDeRouter(fs.readFileSync(f, "utf8")), desde: rel(cierre.get(f) ?? f) }))
      .filter((x) => x.hooks.length);
    expect(fallas, "La ruta admin lee la dirección y la pasa como prop (DashboardRuta → DashboardPage).").toEqual([]);
  });

  it("cada guardado sigue en el cierre y pregunta por el Router", () => {
    for (const archivo of Object.keys(GUARDADOS)) {
      expect(fuentes.map(rel), `${archivo} ya no está en el cierre: sácalo de GUARDADOS`).toContain(archivo);
    }
    expect(fs.readFileSync(path.join(SRC, "components/Dialog.tsx"), "utf8")).toMatch(/useInRouterContext\(\)/);
  });

  it("ningún overlay del cierre se abre por dirección (`panel=`)", () => {
    const fallas = fuentes.filter((f) => PANEL_DIRECCIONABLE.test(sinComentarios(fs.readFileSync(f, "utf8")))).map(rel);
    expect(fallas).toEqual([]);
  });

  it("el detector da rojo por los hooks de router y no por su mención", () => {
    expect(hooksDeRouter("const c = usePanelDireccionable(PANEL);")).toEqual(["usePanelDireccionable"]);
    expect(hooksDeRouter("const [p] = useSearchParams(); return <Link to='/'>x</Link>;")).toEqual(["useSearchParams", "Link"]);
    expect(hooksDeRouter("// usa useLocation() en DashboardRuta\nconst x = 1;")).toEqual([]);
    expect(PANEL_DIRECCIONABLE.test("<Dialog open={a} panel={PANEL_X}>")).toBe(true);
    expect(PANEL_DIRECCIONABLE.test("<Dialog open={a} onOpenChange={b}>")).toBe(false);
  });
});

describe("modo público sin Router: cada página se monta", () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    host = document.createElement("div");
    document.body.appendChild(host);
  });
  afterEach(() => {
    host.remove();
    vi.unstubAllGlobals();
  });

  function montar(nodo: React.ReactNode) {
    const root = createRoot(host);
    expect(() => act(() => root.render(nodo))).not.toThrow();
    act(() => root.unmount());
  }

  it("el tablero publicado", () => montar(<DashboardPage publicMode />));
  it("el informe público de Monitoreo", () =>
    montar(<MonitoreoPublicReportPage artifact={{ kind: "monitoreo", title: "Avance", module: "monitoreo", public_scope: "client" }} />));
});
