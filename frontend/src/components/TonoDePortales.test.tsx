import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { MODULE_TONES } from "../lib/modules";
import {
  ATRIBUTO_TONO_PORTAL,
  aplicarTonoDePortales,
  type CuerpoConTono,
} from "./TonoDePortales";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** `<body>` de mentira: el entorno de Vitest no trae DOM. */
function cuerpoFalso() {
  const atributos = new Map<string, string>();
  const props = new Map<string, string>();
  const cuerpo: CuerpoConTono = {
    setAttribute: (n: string, v: string) => { atributos.set(n, v); },
    removeAttribute: (n: string) => { atributos.delete(n); },
    style: {
      setProperty: (n: string, v: string | null) => { props.set(n, v ?? ""); },
      removeProperty: (n: string) => { const v = props.get(n) ?? ""; props.delete(n); return v; },
    },
  };
  return { cuerpo, atributos, props };
}

const procesamiento = { slug: "procesamiento" as const, tone: MODULE_TONES.procesamiento };

describe("aplicarTonoDePortales", () => {
  test("publica el slug y las tres variables del tono en <body>", () => {
    const { cuerpo, atributos, props } = cuerpoFalso();
    aplicarTonoDePortales(cuerpo, procesamiento);
    expect(atributos.get(ATRIBUTO_TONO_PORTAL)).toBe("procesamiento");
    expect(props.get("--pulso-portal-accent")).toBe("var(--pulso-module-processing)");
    expect(props.get("--pulso-portal-accent-soft")).toBe("var(--pulso-module-processing-soft)");
    expect(props.get("--pulso-portal-accent-border")).toBe("var(--pulso-module-processing-border)");
  });

  test("cambiar de módulo reemplaza el tono", () => {
    const { cuerpo, atributos, props } = cuerpoFalso();
    aplicarTonoDePortales(cuerpo, procesamiento);
    aplicarTonoDePortales(cuerpo, { slug: "monitoreo", tone: MODULE_TONES.monitoreo });
    expect(atributos.get(ATRIBUTO_TONO_PORTAL)).toBe("monitoreo");
    expect(props.get("--pulso-portal-accent")).toBe("var(--pulso-module-monitoring)");
  });

  test("deshacerlo deja <body> como estaba", () => {
    const { cuerpo, atributos, props } = cuerpoFalso();
    const deshacer = aplicarTonoDePortales(cuerpo, procesamiento);
    deshacer();
    expect(atributos.size).toBe(0);
    expect(props.size).toBe(0);
  });

  test("sin módulo (inicio) no publica tono: los portales quedan con la identidad global", () => {
    const { cuerpo, atributos, props } = cuerpoFalso();
    aplicarTonoDePortales(cuerpo, procesamiento);
    aplicarTonoDePortales(cuerpo, null);
    expect(atributos.has(ATRIBUTO_TONO_PORTAL)).toBe(false);
    expect(props.size).toBe(0);
  });
});

describe("el shell lo monta con el módulo activo", () => {
  test("Layout pasa el mismo módulo que pinta <main>", () => {
    const layout = readFileSync(path.resolve(aqui, "../app/Layout.tsx"), "utf8");
    expect(layout).toMatch(/<TonoDePortales modulo=\{activeModule\} \/>/);
    expect(layout).toMatch(/moduleChromeVars\(activeModule\)/);
  });
});

describe("tonoDePortales.css", () => {
  const css = readFileSync(path.join(aqui, "tonoDePortales.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const html = readFileSync(path.resolve(aqui, "../../index.html"), "utf8");

  test("apunta a los hijos de <body> que no son la raíz de la app", () => {
    const raiz = html.match(/<div id="([^"]+)"><\/div>/)?.[1];
    expect(raiz).toBe("root");
    expect(css).toContain(`body[${ATRIBUTO_TONO_PORTAL}] > :not(#${raiz})`);
  });

  test("reinyecta el kit compartido y el primario, sin especificidad propia", () => {
    for (const token of [
      "--module-accent", "--module-accent-soft", "--module-accent-border",
      "--pulso-primary", "--pulso-primary-soft", "--pulso-primary-border",
    ]) {
      expect(css).toMatch(new RegExp(`${token}:\\s*var\\(--pulso-portal-`));
    }
    // Cada regla va dentro de :where(): un overlay que declara su acento gana.
    const selectores = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim());
    expect(selectores.length).toBeGreaterThan(0);
    for (const sel of selectores) expect(sel.startsWith(":where(")).toBe(true);
  });
});
