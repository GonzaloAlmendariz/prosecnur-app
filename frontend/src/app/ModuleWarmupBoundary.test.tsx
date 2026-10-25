import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RouteLoadingFallback } from "./ModuleWarmupBoundary";
import { WarmupReloj } from "./WarmupReloj";
import { VistaSkeleton } from "../components/VistaSkeleton";
import { SIN_ESTIMACION, normalizarEstimacionWarmup } from "./warmupTiempo";

function fallback(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <RouteLoadingFallback />
    </MemoryRouter>,
  );
}

describe("warm start de módulo (L23)", () => {
  it("muestra tiempo y la silueta de la vista destino, no un porcentaje", () => {
    const html = fallback("/monitoreo?modo=territorial&seccion=avance");
    expect(html).toContain('class="pulso-module-warmup"');
    expect(html).toContain("Transcurrido");
    expect(html).toContain("0:00");
    expect(html).toContain('data-vista-skeleton="modulo"');
    expect(html).not.toMatch(/\d+%/);
    expect(html).not.toContain('role="progressbar"');
  });

  it("la silueta no es la vista: oculta a lectores y sin marca de readiness", () => {
    const html = fallback("/monitoreo");
    expect(html).toMatch(/class="pulso-module-warmup-destino" aria-hidden="true"/);
    expect(html).not.toContain("data-audit-ready");
  });

  it("una ruta sin módulo no pinta warm start", () => {
    expect(fallback("/")).toBe("");
  });
});

describe("WarmupReloj", () => {
  it("sin apertura anterior no inventa restante", () => {
    const html = renderToStaticMarkup(<WarmupReloj transcurridoMs={42_000} estimacion={SIN_ESTIMACION} />);
    expect(html).toContain("0:42");
    expect(html).not.toContain("Restante");
    expect(html).toContain('aria-live="off"');
  });

  it("con apertura anterior muestra lo que falta", () => {
    const est = normalizarEstimacionWarmup({ ultima_apertura: { elapsed_ms: 230_000 } });
    const html = renderToStaticMarkup(<WarmupReloj transcurridoMs={160_000} estimacion={est} />);
    expect(html).toContain("2:40");
    expect(html).toContain("Restante");
    expect(html).toContain("~1:10");
  });

  it("superada la estimación muestra la apertura anterior y deja de prometer", () => {
    const est = normalizarEstimacionWarmup({ ultima_apertura: { elapsed_ms: 60_000 } });
    const html = renderToStaticMarkup(<WarmupReloj transcurridoMs={90_000} estimacion={est} />);
    expect(html).not.toContain("Restante");
    expect(html).toContain("Apertura anterior");
    expect(html).toContain("1:00");
  });
});

describe("VistaSkeleton", () => {
  it("dibuja tantas secciones como el módulo declara, acotadas", () => {
    const html = renderToStaticMarkup(<VistaSkeleton secciones={6} />);
    expect(html.match(/is-pill/g)).toHaveLength(6);
    expect(renderToStaticMarkup(<VistaSkeleton secciones={40} />).match(/is-pill/g)).toHaveLength(8);
  });

  it("la variante de inicio es la grilla de tarjetas", () => {
    const html = renderToStaticMarkup(<VistaSkeleton variante="inicio" />);
    expect(html).toContain('data-vista-skeleton="inicio"');
    expect(html.match(/pulso-vista-skeleton-card"/g)).toHaveLength(8);
  });
});
