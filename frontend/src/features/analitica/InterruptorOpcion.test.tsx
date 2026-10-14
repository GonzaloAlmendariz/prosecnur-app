import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { InterruptorOpcion } from "./InterruptorOpcion";

describe("InterruptorOpcion", () => {
  it("una opción que queda puesta es un interruptor, no una casilla", () => {
    const html = renderToStaticMarkup(
      <InterruptorOpcion checked onToggle={vi.fn()} titulo="Mostrar catálogo completo" descripcion="Incluye opciones sin respuestas." />,
    );
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-label="Mostrar catálogo completo"');
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("analitica-control-icon");
    expect(html).toContain("is-active");
  });

  it("la variante en línea y el estado deshabilitado", () => {
    const html = renderToStaticMarkup(
      <InterruptorOpcion variante="linea" disabled checked={false} onToggle={vi.fn()} titulo="Incluir respaldo" />,
    );
    expect(html).toContain("analitica-interruptor-linea is-disabled");
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("disabled");
  });
});

// Guard: ninguna tarjeta de opción de Analítica vuelve a la casilla. La casilla
// queda para elegir elementos de una lista (preguntas, códigos, categorías).
describe("tarjetas de opción de Analítica", () => {
  it("no llevan casilla", () => {
    const raiz = __dirname;
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) archivos.push(p);
      }
    };
    recorrer(raiz);
    // Centinela: si el recorrido o el filtro dejan de casar, el guard no puede
    // pasar en verde sin haber mirado nada.
    expect(archivos.length).toBeGreaterThan(20);
    const conInterruptor = archivos.filter((f) => fs.readFileSync(f, "utf8").includes("<InterruptorOpcion"));
    expect(conInterruptor.length).toBeGreaterThanOrEqual(7);
    const conCasilla = archivos.filter((f) =>
      /analitica-control-card[^>]*>\s*<input\s+type="checkbox"/.test(fs.readFileSync(f, "utf8")),
    );
    expect(conCasilla.map((f) => path.relative(raiz, f))).toEqual([]);
  });

  it("«Incluir» de cada variable en Datos es un interruptor", () => {
    const fuente = fs.readFileSync(path.join(__dirname, "panes", "DataReviewPane.tsx"), "utf8");
    const bloque = fuente.slice(fuente.indexOf('className="pulso-data-review-include"'));
    expect(bloque.length).toBeLessThan(fuente.length);
    expect(bloque.slice(0, 600)).toContain("<Switch");
    expect(bloque.slice(0, 600)).not.toContain('type="checkbox"');
  });
});
