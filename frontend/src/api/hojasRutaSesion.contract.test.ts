import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

// Todo endpoint de Hojas de ruta que lee la sesión exige X-Pulso-Session: una
// llamada sin `headers()` responde E_NO_SESSION y la superficie muestra su error
// o, peor, un vacío que parece real (la biblioteca de ICC «vacía» de U12 y la
// bitácora de U17 lo eran). Sólo la cartografía pública se pide sin sesión.
const SIN_SESION = /\/api\/hojas-ruta\/(block-map|zone-map|street-map|context-map|geometria)\?/;

test("cada apiFetch de Hojas de ruta que usa la sesión manda headers()", () => {
  const src = readFileSync(resolve(__dirname, "hojasRuta.ts"), "utf8");
  const llamadas = [...src.matchAll(/apiFetch\(\s*(["`])(\/api\/hojas-ruta[^"`]*)\1\s*(\)|,[\s\S]{0,200}?\))/g)];
  expect(llamadas.length).toBeGreaterThan(20);
  const sinHeaders = llamadas.filter((m) => !SIN_SESION.test(m[2]) && !/headers\(/.test(m[3])).map((m) => m[2]);
  expect(sinHeaders).toEqual([]);
});
