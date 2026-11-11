import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { CargaHidratando } from "./CargaHidratando";
import {
  formatoTranscurrido,
  marcaReadinessCarga,
  resolverHidratacionCarga,
  type EstadoEstudioCarga,
} from "./cargaHidratacion";

// Sin jsdom: `renderToStaticMarkup`, como Skeleton.test.tsx.

describe("resolverHidratacionCarga — L4", () => {
  test("sin estado de sesión la página está leyendo, sea cual sea la topología", () => {
    for (const estudio of ["inactivo", "leyendo", "listo", "error"] as EstadoEstudioCarga[]) {
      expect(resolverHidratacionCarga({ hayEstadoSesion: false, esMultiBase: false, estudio }))
        .toEqual({ fase: "leyendo", motivo: "sesion" });
    }
  });

  test("multibase sin estudio todavía (inactivo o en vuelo) sigue leyendo", () => {
    expect(resolverHidratacionCarga({ hayEstadoSesion: true, esMultiBase: true, estudio: "inactivo" }))
      .toEqual({ fase: "leyendo", motivo: "estudio" });
    expect(resolverHidratacionCarga({ hayEstadoSesion: true, esMultiBase: true, estudio: "leyendo" }))
      .toEqual({ fase: "leyendo", motivo: "estudio" });
  });

  test("con las bases hidratadas, o en una base única con sesión, está lista", () => {
    expect(resolverHidratacionCarga({ hayEstadoSesion: true, esMultiBase: true, estudio: "listo" }))
      .toEqual({ fase: "lista" });
    expect(resolverHidratacionCarga({ hayEstadoSesion: true, esMultiBase: false, estudio: "inactivo" }))
      .toEqual({ fase: "lista" });
  });

  test("un fallo del estudio es un estado propio, no una espera eterna", () => {
    expect(resolverHidratacionCarga({ hayEstadoSesion: true, esMultiBase: true, estudio: "error" }))
      .toEqual({ fase: "error", motivo: "estudio" });
  });

  test("un fallo de la sesión sin estado es error con reintento, no un cronómetro infinito", () => {
    expect(resolverHidratacionCarga({ hayEstadoSesion: false, errorSesion: true, esMultiBase: false, estudio: "inactivo" }))
      .toEqual({ fase: "error", motivo: "sesion" });
    // Con el estado ya en mano, un error viejo de sesión no tapa la vista.
    expect(resolverHidratacionCarga({ hayEstadoSesion: true, errorSesion: true, esMultiBase: false, estudio: "inactivo" }))
      .toEqual({ fase: "lista" });
  });
});

describe("marcaReadinessCarga — readiness solo con bases hidratadas", () => {
  test("mientras lee, la marca nunca es verdadera", () => {
    expect(marcaReadinessCarga({ fase: "leyendo", motivo: "sesion" }, "bases")).toBe(false);
    expect(marcaReadinessCarga({ fase: "leyendo", motivo: "estudio" }, "bases")).toBe(false);
  });

  test("hidratada publica la dirección de la pestaña", () => {
    expect(marcaReadinessCarga({ fase: "lista" }, "bases")).toBe("carga-bases");
    expect(marcaReadinessCarga({ fase: "error", motivo: "estudio" }, "bases")).toBe("carga-bases");
  });
});

describe("formatoTranscurrido", () => {
  test("m:ss con ceros", () => {
    expect(formatoTranscurrido(0)).toBe("0:00");
    expect(formatoTranscurrido(3.9)).toBe("0:03");
    expect(formatoTranscurrido(75)).toBe("1:15");
    expect(formatoTranscurrido(-4)).toBe("0:00");
    expect(formatoTranscurrido(Number.NaN)).toBe("0:00");
  });
});

function render(pestana: "bases" | "respuestas", motivo: "sesion" | "estudio") {
  return renderToStaticMarkup(
    <CargaHidratando
      pestana={pestana}
      hidratacion={{ fase: "leyendo", motivo }}
      onCambiarPestana={() => undefined}
      onReintentar={() => undefined}
    />,
  );
}

describe("CargaHidratando — sin estado falso", () => {
  test.each([["sesion"], ["estudio"]] as const)('Bases leyendo (%s): silueta, sin cifras ni "Pendiente"', (motivo) => {
    const html = render("bases", motivo);
    expect(html).toContain('data-carga-silueta="bases"');
    expect(html).toContain("pulso-skeleton");
    expect(html).toContain("<h2>Bases</h2>");
    expect(html).not.toMatch(/Pendiente/u);
    expect(html).not.toMatch(/\b0\/1\b/u);
    expect(html).not.toMatch(/\d+\s*base/u);
    expect(html).not.toContain("Listo");
    expect(html).not.toContain("Sin configurar");
  });

  test("nunca escribe data-audit-ready", () => {
    expect(render("bases", "estudio")).not.toContain("data-audit-ready");
    expect(render("respuestas", "sesion")).not.toContain("data-audit-ready");
  });

  test("anuncia la espera y mantiene la relación tab/tabpanel", () => {
    const html = render("bases", "estudio");
    expect(html).toContain('role="status"');
    expect(html).toContain("Leyendo las bases del estudio");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-labelledby="carga-workspace-tab-bases"');
    expect(html).toContain('id="carga-workspace-tab-bases"');
    expect(html).toContain("0:00");
  });

  test("otras pestañas usan la silueta genérica del kit", () => {
    const html = render("respuestas", "sesion");
    expect(html).toContain('data-skeleton-variante="tabla"');
    expect(html).toContain("Abriendo el estudio");
    expect(html).not.toMatch(/Pendiente/u);
  });

  test("el fallo del estudio se dice y ofrece releer", () => {
    const html = renderToStaticMarkup(
      <CargaHidratando
        pestana="bases"
        hidratacion={{ fase: "error", motivo: "estudio" }}
        onCambiarPestana={() => undefined}
        onReintentar={() => undefined}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Volver a leer las bases");
    expect(html).not.toContain("data-audit-ready");
    // En error la cabecera no finge carga con una pastilla de shimmer.
    expect(html).not.toContain("pulso-skeleton--pastilla");
  });

  test("el fallo de la sesión ofrece volver a abrir el estudio", () => {
    const html = renderToStaticMarkup(
      <CargaHidratando
        pestana="bases"
        hidratacion={{ fase: "error", motivo: "sesion" }}
        onCambiarPestana={() => undefined}
        onReintentar={() => undefined}
      />,
    );
    expect(html).toContain("No se pudo abrir el estudio");
    expect(html).toContain("Volver a abrir el estudio");
  });
});

describe("Fuentes — Contrato de Superficie", () => {
  test("C1: Fuentes declara el grupo intrínseco una sola vez y C4 trae su CSS de scroll único", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const page = fs.readFileSync(path.join(__dirname, "CargaPage.tsx"), "utf8");
    const fuentes = fs.readFileSync(path.join(__dirname, "pestanas", "PestanaFuentes.tsx"), "utf8");
    const css = fs.readFileSync(path.join(__dirname, "carga-scroll-corto.css"), "utf8");
    // Una sola pestaña Fuentes para una base y para varias: el grupo se declara en ella.
    expect(fuentes.match(/data-qa-geometry-group="carga\/fuentes" data-qa-geometry-contract="intrinsic"/g)).toHaveLength(1);
    expect(page.match(/data-qa-geometry-group="carga\/fuentes"/g) ?? []).toHaveLength(0);
    expect(page).toContain('import "./carga-scroll-corto.css";');
    expect(css).toMatch(/\.pulso-page-frame-body > \.pulso-carga-workbench--multibase \{\s*flex: 0 0 auto;\s*height: auto;/u);
  });
});
