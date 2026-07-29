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
});
