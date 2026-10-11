import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PulsoButton,
  type PulsoButtonProps,
} from "./PulsoButton";

const moduleAccentTokens = [
  "editor",
  "processing",
  "dashboard",
  "routes",
  "sample",
  "encyclopedia",
  "collectors",
  "monitoring",
] as const;

function hexChannels(hex: string) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

function mixChannels(foreground: string, background: string, foregroundWeight: number) {
  const foregroundChannels = hexChannels(foreground);
  const backgroundChannels = hexChannels(background);
  return foregroundChannels.map((channel, index) => (
    Math.round(channel * foregroundWeight + backgroundChannels[index] * (1 - foregroundWeight))
  ));
}

function relativeLuminance(channels: number[]) {
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

describe("PulsoButton", () => {
  it("renders the shared variants with a safe native button contract", () => {
    const html = renderToStaticMarkup(
      <>
        <PulsoButton variant="primary" data-action="save">
          Guardar
        </PulsoButton>
        <PulsoButton variant="secondary" size="sm">
          Revisar
        </PulsoButton>
        <PulsoButton variant="ghost" size="lg" type="submit">
          Continuar
        </PulsoButton>
        <PulsoButton variant="danger" disabled>
          Eliminar
        </PulsoButton>
        <PulsoButton variant="icon" aria-label="Más opciones" className="local-action">
          <span aria-hidden="true">⋯</span>
        </PulsoButton>
      </>,
    );

    expect(html).toContain('type="button"');
    expect(html).toContain('data-action="save"');
    expect(html).toContain("pulso-button--primary");
    expect(html).toContain("pulso-button--secondary");
    expect(html).toContain("pulso-button--ghost");
    expect(html).toContain("pulso-button--danger");
    expect(html).toContain("pulso-button--icon");
    expect(html).toContain("pulso-button--sm");
    expect(html).toContain("pulso-button--md");
    expect(html).toContain("pulso-button--lg");
    expect(html).toContain('type="submit"');
    expect(html).toContain('aria-label="Más opciones"');
    expect(html).toContain("local-action");
    expect(html).toContain("disabled");
  });

  it("requires an accessible name for the icon variant at compile time", () => {
    // @ts-expect-error Los controles icon-only siempre requieren nombre accesible.
    const invalidIconProps: PulsoButtonProps = { variant: "icon" };
    expect(invalidIconProps.variant).toBe("icon");
  });

  it("uses contextual module color, tokenized sizes and Pulso press physics", () => {
    const theme = fs.readFileSync(
      path.resolve(__dirname, "..", "app", "theme.css"),
      "utf8",
    );
    const styles = theme.slice(
      theme.indexOf("/* PulsoButton —"),
      theme.indexOf("/* /PulsoButton */"),
    );

    expect(styles).toContain(
      "--pulso-button-accent: color-mix(in srgb, var(--module-accent, var(--pulso-primary)) 82%, #001b33 18%);",
    );
    expect(styles).toContain("--pulso-control-height-sm");
    expect(styles).toContain("--pulso-control-height-md");
    expect(styles).toContain("--pulso-control-height-lg");
    expect(styles).toContain(".pulso-button--primary");
    expect(styles).toContain(".pulso-button--secondary");
    expect(styles).toContain(".pulso-button--ghost");
    expect(styles).toContain(".pulso-button--danger");
    expect(styles).toContain(".pulso-button--icon");
    expect(styles).toContain("var(--pulso-danger-bg)");
    expect(styles).toContain("var(--pulso-danger-fg)");
    expect(styles).toContain("transform: scale(0.98);");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transform: none;/,
    );
  });

  it("keeps every module accent distinct and readable on the primary variant", () => {
    const theme = fs.readFileSync(
      path.resolve(__dirname, "..", "app", "tokens.css"),
      "utf8",
    );
    const primaryColors = moduleAccentTokens.map((token) => {
      const match = theme.match(new RegExp(`--pulso-module-${token}: (#[0-9a-f]{6});`, "i"));
      expect(match, token).not.toBeNull();
      return mixChannels(match![1], "#001b33", 0.82);
    });
    const serializedColors = primaryColors.map((channels) => channels.join(","));

    expect(new Set(serializedColors).size).toBe(moduleAccentTokens.length);
    // Ancla al acento de Hojas de ruta, que ademas esta COPIADO en la paleta
    // cartografica de HojasRutaPage (el mapa pinta en <canvas>, donde las CSS
    // vars no resuelven). Si este valor cambia, esa copia tiene que moverse con
    // el o el mapa queda mas encendido que el chrome que lo rodea.
    expect(theme).toContain("--pulso-module-routes: #ac563b;");
    for (const channels of primaryColors) {
      const contrastWithWhite = 1.05 / (relativeLuminance(channels) + 0.05);
      expect(contrastWithWhite).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("K2–K4: ícono con intent remove, botón de texto y navegación con flecha", () => {
    const html = renderToStaticMarkup(
      <>
        <PulsoButton variant="icon" size="sm" intent="remove" aria-label="Quitar excepción">
          <span aria-hidden="true">x</span>
        </PulsoButton>
        <PulsoButton variant="link" size="sm">Ninguna</PulsoButton>
        <PulsoButton variant="secondary" nav>Abrir Cuotas</PulsoButton>
      </>,
    );
    expect(html).toContain('data-intent="remove"');
    expect(html).toContain("pulso-button--link");
    expect(html).toContain("pulso-button--secondary pulso-button--md pulso-button--nav");
    expect(html).toContain("lucide-arrow-right");
    expect(html).toContain("pulso-button-nav-arrow");
    // Las props de intención no se filtran al DOM como atributos sueltos.
    expect(html).not.toMatch(/ nav=| intent=| confirm=/);
  });

  it("D13: danger es contorno; confirm lo vuelve relleno sólido", () => {
    const html = renderToStaticMarkup(
      <>
        <PulsoButton variant="danger">Eliminar bloque</PulsoButton>
        <PulsoButton variant="danger" confirm>Eliminar definitivamente</PulsoButton>
      </>,
    );
    expect(html).toContain('class="pulso-button pulso-button--danger pulso-button--md"');
    expect(html).toContain("pulso-button--danger pulso-button--md pulso-button--danger-confirm");
    // @ts-expect-error confirm solo existe en la variante danger.
    const invalid: PulsoButtonProps = { variant: "primary", confirm: true };
    expect(invalid.variant).toBe("primary");
  });

  it("D13: el rojo de danger es AA sobre blanco y no es el carmesí de Monitoreo", () => {
    const tokens = fs.readFileSync(path.resolve(__dirname, "..", "app", "tokens.css"), "utf8");
    const strong = tokens.match(/--pulso-danger-solid: (#[0-9a-f]{6});/i)?.[1];
    const monitoring = tokens.match(/--pulso-module-monitoring: (#[0-9a-f]{6});/i)?.[1];
    expect(strong).toBeDefined();
    expect(monitoring).toBe("#a0464e");
    const contrast = 1.05 / (relativeLuminance(hexChannels(strong!)) + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    // A simple vista: más claro y más saturado que el carmesí.
    const [r1, g1, b1] = hexChannels(strong!);
    const [r2, g2, b2] = hexChannels(monitoring!);
    const distancia = Math.hypot(r1 - r2, g1 - g2, b1 - b2);
    expect(distancia).toBeGreaterThan(60);

    const kit = fs.readFileSync(path.join(__dirname, "kit-buttons.css"), "utf8");
    expect(kit).toMatch(/\.pulso-button\.pulso-button--danger \{[^}]*border-color: var\(--pulso-danger-solid\);[^}]*background: var\(--pulso-surface\);/);
    expect(kit).toMatch(/\.pulso-button--danger-confirm \{[^}]*background: var\(--pulso-danger-solid\);/);
    expect(kit).toMatch(/\.pulso-button--icon\[data-intent="remove"\]:hover/);
    expect(kit).toMatch(/\.pulso-button--link \{[^}]*text-decoration: none;/);
    expect(kit).toMatch(/\.pulso-button--link \+ \.pulso-button\.pulso-button--link::before/);
    expect(kit).toMatch(/\.pulso-button--nav:hover:not\(:disabled\) \.pulso-button-nav-arrow \{\s*transform: translateX\(2px\);/);
  });

  it("D13: el token del kit no repinta consumidores previos (danger-solid solo en el kit; danger-strong sigue sin definirse)", () => {
    const srcRoot = path.resolve(__dirname, "..");
    const kitFiles = new Set(["kit-buttons.css", "PulsoButton.tsx", "PulsoButton.test.tsx"]);
    const consumidoresAjenos: string[] = [];
    const definicionesStrong: string[] = [];
    const visitar = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          visitar(full);
          continue;
        }
        if (!/\.(css|tsx?)$/.test(entry.name)) continue;
        const text = fs.readFileSync(full, "utf8");
        const rel = path.relative(srcRoot, full);
        if (/--pulso-danger-strong\s*:/.test(text)) definicionesStrong.push(rel);
        if (rel === path.join("app", "tokens.css") || kitFiles.has(entry.name)) continue;
        if (text.includes("--pulso-danger-solid")) consumidoresAjenos.push(rel);
      }
    };
    visitar(srcRoot);
    // outputsWorkbench.css (Monitoreo › Salidas) consume --pulso-danger-strong con
    // fallback #9f1239: definirlo cambiaría su rojo sin que nadie lo pidiera.
    expect(definicionesStrong).toEqual([]);
    expect(consumidoresAjenos).toEqual([]);
  });
});
