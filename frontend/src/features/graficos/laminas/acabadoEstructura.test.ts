// Acabado de Láminas, oleada W2-A (2026-11-08): la ESTRUCTURA de la superficie. Guardas de fuente para que no vuelvan
// los botones hechos a mano (F1/F2), la X en tres dialectos, «Previsualizar» lleno ni el «Ajustar» nativo sin chevron.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));
const leer = (rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const listar = (sub: string, ext: RegExp) => fs.readdirSync(path.join(dir, sub))
  .filter((f) => ext.test(f) && !/\.test\./.test(f))
  .map((f) => path.join(sub, f));

/** Los TSX de la estructura de la superficie (los de W2-A). Las tarjetas (W2-B) quedan fuera a propósito. */
const PROPIOS = [
  "VisorLamina.tsx",
  "BarraLaminas.tsx",
  "InspectorLamina.tsx",
  "PanelAvisos.tsx",
  "AvisosLamina.tsx",
  "EditorAmplio.tsx",
  "LaminasWorkbench.tsx",
  "EstructuraInforme.tsx",
  "TiraMiniaturas.tsx",
  ...listar("guias", /\.tsx$/),
  ...listar("selectores", /\.tsx$/),
];

describe("W2-A: sin botones F1/F2 en la estructura de Láminas", () => {
  it.each(PROPIOS)("%s no usa .pulso-f6-boton, .pulso-f6-icono-boton ni .pulso-f6-texto-boton", (archivo) => {
    const src = sinComentarios(leer(archivo));
    expect(src).not.toMatch(/pulso-f6-(boton|icono-boton|texto-boton)\b/);
    expect(src).not.toMatch(/\bis-primario\b/);
  });
});

describe("W2-A: jerarquía de la barra del visor", () => {
  const visor = sinComentarios(leer("VisorLamina.tsx"));
  const barra = visor.slice(visor.indexOf('<header className="pulso-f6-visor-barra">'), visor.indexOf("</header>"));

  it("«+ Lámina» es el único primario de la barra", () => {
    expect(barra.match(/variant="primary"/g)).toHaveLength(1);
    expect(barra).toMatch(/variant="primary" className="pulso-f6-visor-insertar"/);
  });

  it("Estructura, Previsualizar y Ajustes son secundarios con aria-pressed", () => {
    for (const nombre of ['aria-label="Estructura"', 'className="pulso-f6-previsualizar"', 'aria-label="Ajustes"']) {
      const i = barra.indexOf(nombre);
      expect(i).toBeGreaterThan(-1);
      const boton = barra.slice(barra.lastIndexOf("<PulsoButton", i), barra.indexOf(">", i));
      expect(boton).toContain('variant="secondary"');
      expect(boton).toContain("aria-pressed=");
    }
  });

  it("‹ › y miniaturas son íconos quietos; «Ajustar» es PulsoSelect, no un select nativo", () => {
    for (const nombre of ["Lámina anterior", "Lámina siguiente", "Miniaturas"]) {
      const i = barra.indexOf(`aria-label="${nombre}"`);
      const boton = barra.slice(barra.lastIndexOf("<PulsoButton", i), i);
      expect(boton).toContain('variant="icon"');
      expect(boton).toContain('tone="quiet"');
    }
    expect(barra).toMatch(/<PulsoSelect[\s\S]*ariaLabel="Zoom de la lámina"/);
    expect(visor).not.toMatch(/<select\b/);
  });

  it("«Previsualizar» ya no se pinta lleno con el acento", () => {
    expect(sinComentarios(leer("visorLamina.css"))).not.toMatch(/pulso-f6-previsualizar\[aria-pressed="true"\]/);
  });
});

describe("W2-A: una sola gramática de cierre", () => {
  it.each(["InspectorLamina.tsx", "PanelAvisos.tsx", "EstructuraInforme.tsx", "EditorAmplio.tsx", "guias/BotonGuias.tsx"])(
    "%s usa CabeceraPanel y no pinta una X propia",
    (archivo) => {
      const src = sinComentarios(leer(archivo));
      expect(src).toMatch(/<CabeceraPanel\b/);
      expect(src).not.toMatch(/<X\b/);
    },
  );

  it("el selector cierra con BotonCerrar dentro de Dialog.Close, alineado a la línea del título", () => {
    const src = sinComentarios(leer("selectores/DialogoSelector.tsx"));
    expect(src).toMatch(/<Dialog\.Close asChild>\s*<BotonCerrar className="pulso-f6-selector-cerrar"/);
    const css = sinComentarios(leer("selectores/selectores.css"));
    expect(css).toMatch(/\.pulso-f6-selector-cabecera > \.pulso-f6-selector-cerrar \{[^}]*margin-top: calc\(var\(--pulso-f6-selector-antetitulo-lh\)/);
  });

  it("«Listo» y la X no conviven en el editor amplio: queda la X", () => {
    const src = sinComentarios(leer("EditorAmplio.tsx"));
    expect(src).not.toMatch(/>Listo</);
    expect(src).toMatch(/onCerrar=\{cerrar\}/);
  });

  it("«Cambiar lámina» se distingue del «Cambiar» del gráfico", () => {
    expect(leer("InspectorLamina.tsx")).toMatch(/>\s*Cambiar lámina\s*</);
  });
});

describe("W2-A: acabado común de controles", () => {
  const css = sinComentarios(leer("laminasWorkbench.css"));

  it("un solo lenguaje de pulsado: tinte del acento con su borde", () => {
    const i = css.indexOf('.pulso-button.pulso-button--secondary:is([aria-pressed="true"]');
    expect(i).toBeGreaterThan(-1);
    const cuerpo = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
    expect(cuerpo).toContain("var(--module-accent-border)");
    expect(cuerpo).toContain("var(--module-accent-soft)");
  });

  it("deshabilitado honesto: surface-3, text-faint y borde, sin opacidad", () => {
    const i = css.indexOf(":is(:disabled, [aria-disabled=\"true\"])");
    expect(i).toBeGreaterThan(-1);
    const cuerpo = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
    expect(cuerpo).toContain("opacity: 1");
    expect(cuerpo).toContain("var(--pulso-surface-3)");
    expect(cuerpo).toContain("var(--pulso-text-faint)");
    expect(cuerpo).toContain("var(--pulso-border)");
  });

  it("un solo anillo de foco y sin halo", () => {
    const i = css.indexOf(".pulso-button--link):focus-visible");
    const cuerpo = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
    expect(cuerpo).toContain("outline: var(--mov-foco)");
    expect(cuerpo).toContain("box-shadow: none");
  });
});
