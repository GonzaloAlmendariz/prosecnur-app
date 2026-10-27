/**
 * Los tokens `--pulso-publico-*` son la paleta de actores del estándar, en su
 * orden: si el JSON cambia, ESTANDAR_NOMINAL lo sigue (su propio test) y este
 * test obliga a que los tokens de la app lo sigan también.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ESTANDAR_NOMINAL } from "../../../../graficos/paletasSugeridas";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TOKENS = fs.readFileSync(path.resolve(AQUI, "../../../../../app/tokens.css"), "utf8");

describe("paleta de públicos", () => {
  it("los seis tokens repiten `paletas.actores` del estándar en su orden", () => {
    const tokens = [...TOKENS.matchAll(/--pulso-publico-(\d):\s*(#[0-9a-f]{6})/gi)].map((m) => m[2].toUpperCase());
    expect(tokens).toEqual([...ESTANDAR_NOMINAL.actores]);
  });
});
