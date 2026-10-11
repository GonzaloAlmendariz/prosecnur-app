// Los espejos generados del backend no se desvían de su fuente (F6.2):
// - catalogoTipos.generated.ts ← api/inst/catalogos/graficos_tipos.json (familia, salida y `en_selector` por tipo);
// - estandarLaminas.generated.ts ← api/inst/estandar/estandar_pulso.json (`ppt.tipos_lamina`: uso, layout y familia).
// Si falla, el JSON cambió: regenera el espejo con el valor que imprime el diff.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATALOGO_GRAFICOS, CATALOGO_LAMINAS } from "./catalogoTipos.generated";
import { ESTANDAR_LAMINAS } from "./estandarLaminas.generated";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const leer = <T,>(rel: string): T => JSON.parse(fs.readFileSync(path.join(RAIZ, rel), "utf8")) as T;

type Catalogo = {
  slides: Array<{ name: string; categoria: string; estandar: string | null; en_selector: boolean }>;
  graficadores: Array<{ name: string; familia_editor: string; salida: string; en_selector: boolean }>;
};
type Estandar = {
  ppt: {
    tipos_lamina: Array<{
      id: string; uso: string; layout: string;
      familia?: { escala: number; cifra_pt: number; rotulo_pt: number; barra_in: number };
      cifras?: { valor_pt?: number };
    }>;
  };
};

describe("espejo del catálogo de tipos", () => {
  const catalogo = leer<Catalogo>("api/inst/catalogos/graficos_tipos.json");

  it("las láminas son las del catálogo, en su orden", () => {
    expect(CATALOGO_LAMINAS).toEqual(catalogo.slides);
  });

  it("los graficadores son los del catálogo, en su orden", () => {
    expect(CATALOGO_GRAFICOS).toEqual(catalogo.graficadores);
  });
});

describe("espejo del estándar de láminas", () => {
  const estandar = leer<Estandar>("api/inst/estandar/estandar_pulso.json");

  it("uso, layout, familia y cifra de cada tipo del estándar", () => {
    const esperado = Object.fromEntries(estandar.ppt.tipos_lamina.map((t) => [t.id, {
      uso: t.uso,
      layout: t.layout,
      familia: t.familia ? { escala: t.familia.escala, cifra_pt: t.familia.cifra_pt, rotulo_pt: t.familia.rotulo_pt, barra_in: t.familia.barra_in } : null,
      cifra_valor_pt: t.cifras?.valor_pt ?? null,
    }]));
    expect(ESTANDAR_LAMINAS).toEqual(esperado);
  });
});
