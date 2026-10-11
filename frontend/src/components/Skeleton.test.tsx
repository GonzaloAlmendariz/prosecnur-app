import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";

import ModuleWarmupBoundary, { RouteLoadingFallback, perfilConRail, siluetaDePerfil } from "../app/ModuleWarmupBoundary";
import { Skeleton, SkeletonVista, etiquetaDeCarga, type SkeletonForma, type SkeletonVistaVariante } from "./Skeleton";

// Sin jsdom: se renderiza con `renderToStaticMarkup`, como TabHeading.

const FORMAS: SkeletonForma[] = ["texto", "titulo", "fila", "kpi", "card", "grafico", "circulo"];
const VARIANTES: SkeletonVistaVariante[] = ["workbench", "tabla", "tablero", "documento"];

describe("Skeleton — piezas", () => {
  test.each(FORMAS)("forma %s: clase propia y decorativa", (forma) => {
    const html = renderToStaticMarkup(<Skeleton forma={forma} />);
    expect(html).toContain(`class="pulso-skeleton pulso-skeleton--${forma}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("role=");
  });

  test("ancho y alto explícitos van como tamaño lógico", () => {
    const html = renderToStaticMarkup(<Skeleton forma="texto" ancho="40%" alto={9} />);
    expect(html).toContain("inline-size:40%");
    expect(html).toContain("block-size:9px");
  });
});

describe("SkeletonVista — silueta de la vista destino", () => {
  test.each(VARIANTES)("variante %s: cabecera de pestaña + cuerpo propio", (variante) => {
    const html = renderToStaticMarkup(<SkeletonVista variante={variante} etiqueta="Monitoreo" />);
    expect(html).toContain(`pulso-skeleton-vista--${variante}`);
    expect(html).toContain(`data-skeleton-variante="${variante}"`);
    expect(html).toContain('class="pulso-skeleton-cabecera"');
  });

  test("las siluetas son distintas entre sí", () => {
    const formas = new Set(VARIANTES.map((v) => renderToStaticMarkup(<SkeletonVista variante={v} />)
      .replace(/pulso-skeleton-vista--\w+|data-skeleton-variante="\w+"/g, "")));
    expect(formas.size).toBe(VARIANTES.length);
  });

  test("anuncia la espera: role=status, aria-busy y texto «Cargando …»", () => {
    const html = renderToStaticMarkup(<SkeletonVista etiqueta="Procesamiento" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('<span class="pulso-sr-only">Cargando Procesamiento…</span>');
    expect(html).toContain('class="pulso-skeleton-vista-silueta" aria-hidden="true"');
  });

  test("decorativo: fuera del árbol accesible y sin rol (lo anuncia su región)", () => {
    const html = renderToStaticMarkup(<SkeletonVista decorativo />);
    expect(html).toMatch(/^<div class="pulso-skeleton-vista[^"]*"[^>]*aria-hidden="true"/);
    expect(html).not.toContain("role=");
    expect(html).not.toContain("aria-busy");
  });

  test("rail: columna de tiles y columna principal con la cabecera", () => {
    const html = renderToStaticMarkup(<SkeletonVista rail="estrecho" />);
    expect(html).toContain("pulso-skeleton-vista--con-rail");
    expect(html).toMatch(/data-skeleton-rail="estrecho".*class="pulso-skeleton-vista-principal"><div class="pulso-skeleton-cabecera"/);
    expect(renderToStaticMarkup(<SkeletonVista rail />)).toContain('data-skeleton-rail="ancho"');
    expect(renderToStaticMarkup(<SkeletonVista />)).not.toContain("pulso-skeleton-rail");
  });

  test("banda del módulo antes de la superficie; sin cabecera si se pide", () => {
    const html = renderToStaticMarkup(<SkeletonVista banda="seccion" cabecera={false} />);
    expect(html).toMatch(/data-skeleton-banda="seccion".*class="pulso-skeleton-superficie"/);
    expect(html).not.toContain("pulso-skeleton-cabecera");
    const comandos = renderToStaticMarkup(<SkeletonVista banda="comandos" />);
    expect((comandos.match(/pulso-skeleton-banda-fila/g) ?? []).length).toBe(2);
  });

  test("etiquetaDeCarga", () => {
    expect(etiquetaDeCarga()).toBe("Cargando…");
    expect(etiquetaDeCarga("  ")).toBe("Cargando…");
    expect(etiquetaDeCarga("Monitoreo")).toBe("Cargando Monitoreo…");
  });

  test.each([...VARIANTES.map((v) => [v, false] as const), ["workbench", true] as const])(
    "NUNCA publica data-audit-ready (%s, decorativo=%s)",
    (variante, decorativo) => {
      const html = renderToStaticMarkup(<SkeletonVista variante={variante} decorativo={decorativo} />);
      expect(html).not.toContain("data-audit-ready");
    },
  );
});

describe("RouteLoadingFallback — silueta del módulo, no un 8 % fijo", () => {
  function fallback(ruta: string) {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={[ruta]}>
        <RouteLoadingFallback />
      </MemoryRouter>,
    );
  }

  test("Monitoreo: workbench con banda y rail de 56, y ningún porcentaje", () => {
    const html = fallback("/monitoreo?modo=territorial&seccion=avance");
    expect(html).toContain('data-skeleton-destino="monitoreo"');
    expect(html).toContain("pulso-skeleton-vista--workbench");
    expect(html).toContain('data-skeleton-banda="seccion"');
    expect(html).toContain('data-skeleton-rail="ancho"');
    expect(html).toContain("Cargando Monitoreo…");
    expect(html).not.toContain("progressbar");
    expect(html).not.toMatch(/>\s*\d+\s*%\s*</);
  });

  test("conserva .pulso-module-warmup para que estadoListo() responda warm-start", () => {
    // lib/navegacion/runtime.ts: SELECTOR_WARMUP = ".pulso-module-warmup". Sin
    // la clase, el runner leería `sin-marca-de-readiness` y dejaría de esperar.
    const html = fallback("/analitica");
    expect(html).toMatch(/^<section class="pulso-module-warmup pulso-route-skeleton"/);
    expect(html).toContain('data-skeleton-rail="estrecho"');
    expect(html).toContain('data-skeleton-destino="procesamiento"');
    expect(html).not.toContain("data-audit-ready");
  });

  test("ruta sin perfil (Home) no pinta nada", () => {
    expect(fallback("/")).toBe("");
  });

  test("siluetaDePerfil: forma de cada destino y genérica workbench", () => {
    expect(siluetaDePerfil("dashboard").variante).toBe("tablero");
    expect(siluetaDePerfil("editor-xlsform")).toMatchObject({ variante: "workbench", banda: "comandos", cabecera: false });
    expect(siluetaDePerfil("recopiladores")).toMatchObject({ banda: "seccion", cabecera: false });
    expect(siluetaDePerfil("desconocido")).toEqual({ variante: "workbench", destino: "simple" });
    expect(siluetaDePerfil(null).variante).toBe("workbench");
  });

  test("perfilConRail cubre los módulos con rail real", () => {
    for (const k of ["carga", "validacion", "codificacion", "analitica", "graficos", "monitoreo", "calc-muestra"]) {
      expect(perfilConRail(k), k).toBe(true);
    }
    for (const k of ["recopiladores", "editor-xlsform", "dashboard", "bitacora", "hojas-ruta"]) {
      expect(perfilConRail(k), k).toBe(false);
    }
  });
});

describe("Pantalla de warm start — anuncia la espera", () => {
  test("role=status con aria-busy y la silueta destino decorativa", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/monitoreo"]}>
        <ModuleWarmupBoundary>
          <p>vista</p>
        </ModuleWarmupBoundary>
      </MemoryRouter>,
    );
    expect(html).toMatch(/<section class="pulso-module-warmup"[^>]*role="status"[^>]*aria-busy="true"/);
    expect(html).toContain('class="pulso-skeleton-vista pulso-skeleton-vista--workbench pulso-skeleton-vista--con-rail pulso-skeleton-vista--destino"');
    expect(html).not.toContain("data-audit-ready");
    expect(html).not.toContain("<p>vista</p>");
  });
});
