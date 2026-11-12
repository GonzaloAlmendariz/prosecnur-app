// @vitest-environment happy-dom
/**
 * Codificación usa el selector de base de la banda (`components/ChromeBaseSelector`),
 * el mismo de Analítica y Gráficos (etapa P2 del ADR 0142). Antes tenía uno propio
 * que cambiaba la base con `useCodifSource().setActive`.
 *
 * Lo que no puede perderse con el cambio: al elegir otra base la página recarga su
 * estado. El selector común no conoce Codificación; avisa con el evento
 * `pulso:active-base-changed`. Estas pruebas fijan los dos eslabones: que el hook
 * de la página vuelva a leer la base al oír ese evento, y que la página use esa
 * base en la `key` que remonta a sus hijos.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const api = vi.hoisted(() => ({
  apiCodifSourceGet: vi.fn(),
  apiCodifSourceSet: vi.fn(),
  apiEstudioGet: vi.fn(),
}));
vi.mock("../../api/client", () => api);

const { useCodifSource } = await import("./useCodifSource");

const aqui = path.dirname(fileURLToPath(import.meta.url));
const pagina = fs.readFileSync(path.join(aqui, "CodificacionPage.tsx"), "utf8");
const sinComentarios = pagina.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

function Sonda() {
  const fuente = useCodifSource();
  // La misma composición de `codifActive` en CodificacionPage, sin la revisión de importación.
  return <output data-activa={fuente.active ?? ""} data-cargando={String(fuente.loading)} />;
}

describe("Codificación recarga su estado cuando el selector común cambia la base", () => {
  let contenedor: HTMLDivElement;
  let raiz: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    api.apiCodifSourceGet.mockReset();
    api.apiCodifSourceSet.mockReset();
    api.apiEstudioGet.mockReset().mockResolvedValue({ nombre: null, n_bases: 2, bases: {}, max_bases: 16 });
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });
  afterEach(() => {
    act(() => raiz.unmount());
    contenedor.remove();
  });

  const activa = () => contenedor.querySelector("output")?.getAttribute("data-activa");

  test("al oír `pulso:active-base-changed` el hook vuelve a leer la base activa", async () => {
    api.apiCodifSourceGet
      .mockResolvedValueOnce({ active: "docentes", options: ["docentes", "egresados"] })
      .mockResolvedValue({ active: "egresados", options: ["docentes", "egresados"] });
    await act(async () => {
      raiz.render(<Sonda />);
    });
    expect(activa()).toBe("docentes");

    // Lo que emite ChromeBaseSelector después de cambiar la base por la API del estudio.
    await act(async () => {
      window.dispatchEvent(new CustomEvent("pulso:active-base-changed", { detail: { active: "egresados" } }));
    });
    expect(api.apiCodifSourceGet).toHaveBeenCalledTimes(2);
    expect(activa()).toBe("egresados");
    // El selector común cambia la base por su cuenta: el hook no vuelve a escribirla.
    expect(api.apiCodifSourceSet).not.toHaveBeenCalled();
  });

  test("sin el evento, la base activa de la página no cambia", async () => {
    api.apiCodifSourceGet.mockResolvedValue({ active: "docentes", options: ["docentes", "egresados"] });
    await act(async () => {
      raiz.render(<Sonda />);
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent("pulso:otra-cosa"));
    });
    expect(api.apiCodifSourceGet).toHaveBeenCalledTimes(1);
    expect(activa()).toBe("docentes");
  });
});

describe("CodificacionPage monta el selector común y conserva el remontaje por base", () => {
  test("publica ChromeBaseSelector en la zona de contexto de la banda", () => {
    expect(pagina).toMatch(/import \{ ChromeBaseSelector \} from "\.\.\/\.\.\/components\/ChromeBaseSelector";/);
    expect(sinComentarios).toMatch(/<ChromeSlotPortal zona="contexto">[\s\S]*?<ChromeBaseSelector \/>[\s\S]*?<\/ChromeSlotPortal>/);
  });

  test("la cabecera no repite el nombre de la base cuando la banda ya trae el selector", () => {
    expect(sinComentarios).toMatch(
      /const selectorEnBanda = prereqOk && state\?\.estudio_processing_mode !== "independent_siblings";/,
    );
    expect(sinComentarios).toMatch(/\{selectorEnBanda && <ChromeBaseSelector \/>\}/);
    expect(sinComentarios).toMatch(
      /const baseActual = codifSource\.active && !\(selectorEnBanda && codifSource\.options\.length > 1\) \? \(/,
    );
  });

  test("ya no escribe un selector propio", () => {
    expect(sinComentarios).not.toMatch(/BasesInspectorMenu|BaseSelectorTrigger/);
    expect(sinComentarios).not.toMatch(/function BaseSelector\b/);
    expect(sinComentarios).not.toMatch(/setActive/);
  });

  test("la base activa sigue en la `key` de cada pestaña", () => {
    expect(sinComentarios).toMatch(/const codifActive = `\$\{codifSource\.active \?\? "default"\}:\$\{importRevision\}`;/);
    expect(sinComentarios.match(/key=\{codifActive\}/g)?.length).toBe(4);
    expect(sinComentarios).toMatch(/key=\{`\$\{step\}:\$\{codifActive\}`\}/);
  });
});
