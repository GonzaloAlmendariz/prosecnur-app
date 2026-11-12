import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RouteLoadingFallback } from "./ModuleWarmupBoundary";
import { WarmupReloj } from "./WarmupReloj";
import { SIN_ESTIMACION, normalizarEstimacionWarmup } from "./warmupTiempo";

function fallback(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <RouteLoadingFallback />
    </MemoryRouter>,
  );
}

describe("warm start de módulo (L23)", () => {
  it("es la carga corta de la app: isotipo, módulo en su tono, rótulo y barra; sin reloj ni fases", () => {
    const html = fallback("/monitoreo?modo=territorial&seccion=avance");
    // 6 nov 2026 (Gonzalo): abrir un módulo dura segundos; la lámina con fases y reloj queda para el proyecto.
    expect(html).toContain('class="pulso-module-warmup"');
    expect(html).toContain('data-module-warmup="monitoreo"');
    expect(html).toContain('class="pulso-carga-modulo"');
    expect(html).toContain('class="pulso-isotipo-carga"');
    expect(html).toContain("pulso-barra-avance pulso-barra-avance--indeterminada");
    expect(html).toContain('style="--module-accent:');
    expect(html).not.toContain("Transcurrido");
    expect(html).not.toContain("pulso-carga-fases");
    expect(html).not.toMatch(/\d+%/);
  });

  it("la carga no es la vista: sin marca de readiness", () => {
    expect(fallback("/monitoreo")).not.toContain("data-audit-ready");
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
