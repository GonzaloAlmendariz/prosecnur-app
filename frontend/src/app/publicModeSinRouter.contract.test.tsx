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
  /\b(useDireccion|usePanelDireccionable|useFoco|useSeccion|usePestana|useIrA|useSearchParams|useNavigate|useNavigation|useLocation|useParams|useMatch|useMatches|useHref|useResolvedPath|useRoutes|useBlocker|useNavigationType|useOutletContext|useLinkClickHandler)\s*\(|<(Link|NavLink|Navigate|Outlet)\b/g;
/** Cualquier import del router, también con alias (`import { useNavigate as nav }`), que la llamada no delata. */
const IMPORTA_ROUTER = /from\s*["']react-router(?:-dom)?["']/;

/**
 * Etiquetas JSX de un overlay que se abre por dirección: `<Dialog …panel=…>` o `<Sideover …panel=…>`, y
 * `<OverlayDePanel` siempre. Lee la etiqueta siguiendo las llaves, porque un `>` de flecha dentro de una prop
 * (`onOpenChange={(v) => …}`) cortaba la lectura antes de llegar a `panel=`. Un `panel` escondido en un spread
 * (`{...props}`) no se ve estáticamente: lo atrapa el montaje, si el overlay está en el estado inicial.
 */
export function overlaysPorDireccion(fuente: string): string[] {
  const hallados: string[] = [];
  for (const m of fuente.matchAll(/<(Dialog|Sideover|OverlayDePanel)\b/g)) {
    let i = (m.index ?? 0) + m[0].length;
    let llaves = 0;
    for (; i < fuente.length; i++) {
      const c = fuente[i];
      if (c === "{") llaves++;
      else if (c === "}") llaves--;
      else if (c === ">" && llaves === 0) break;
    }
    const etiqueta = fuente.slice(m.index, i + 1);
    if (m[1] === "OverlayDePanel" || /\bpanel=/.test(etiqueta)) hallados.push(m[1]);
  }
  return hallados;
}

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
  const limpio = sinComentarios(fuente);
  const hooks = [...limpio.matchAll(HOOKS_DE_ROUTER)].map((m) => m[1] ?? m[2]);
  if (IMPORTA_ROUTER.test(limpio)) hooks.push("import de react-router");
  return [...new Set(hooks)];
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

  it("ningún overlay del cierre se abre por dirección (`panel=` u `OverlayDePanel`)", () => {
    const fallas = fuentes
      .filter((f) => !(rel(f) in GUARDADOS))
      .filter((f) => overlaysPorDireccion(sinComentarios(fs.readFileSync(f, "utf8"))).length)
      .map(rel);
    expect(fallas).toEqual([]);
  });

  it("el detector da rojo por los hooks de router y no por su mención", () => {
    expect(hooksDeRouter("const c = usePanelDireccionable(PANEL);")).toEqual(["usePanelDireccionable"]);
    expect(hooksDeRouter("const [p] = useSearchParams(); return <Link to='/'>x</Link>;")).toEqual(["useSearchParams", "Link"]);
    expect(hooksDeRouter("// usa useLocation() en DashboardRuta\nconst x = 1;")).toEqual([]);
    expect(hooksDeRouter('import { useNavigate as ir } from "react-router-dom";')).toEqual(["import de react-router"]);
    expect(hooksDeRouter("const r = useResolvedPath('x');")).toEqual(["useResolvedPath"]);
    expect(overlaysPorDireccion("<Dialog open={a} panel={PANEL_X}>")).toEqual(["Dialog"]);
    expect(overlaysPorDireccion("<Dialog onOpenChange={(v) => setX(v)} panel={P}>")).toEqual(["Dialog"]);
    expect(overlaysPorDireccion("<Sideover\n  titulo={t}\n  panel={P}\n>")).toEqual(["Sideover"]);
    expect(overlaysPorDireccion("<OverlayDePanel {...resto} />")).toEqual(["OverlayDePanel"]);
    expect(overlaysPorDireccion("<Dialog open={a} onOpenChange={(v) => b(v)}>x</Dialog> <p panel={1}>")).toEqual([]);
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
