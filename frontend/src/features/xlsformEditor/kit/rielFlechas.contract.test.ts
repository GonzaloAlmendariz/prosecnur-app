import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

// Contrato geométrico de la fila elegida de la Estructura (Gonzalo, 2026-10-20): las flechas subir/bajar flotan, pero
// NUNCA sobre el riel; con cálculo o filtro encendidos tapaban esas casillas. Se recalcula desde las hojas: la caja del
// riel (desde el borde interior derecho de la fila) y la de las flechas no deben intersecarse en ningún ancho.
const dir = path.dirname(fileURLToPath(import.meta.url));
const riel = fs.readFileSync(path.join(dir, "riel.css"), "utf8");
const tema = fs.readFileSync(path.join(dir, "../../../app/theme.css"), "utf8");

const px = (re: RegExp, texto: string) => {
  const m = texto.match(re);
  if (!m) throw new Error(`no encontré ${re}`);
  return Number(m[1]);
};

describe("flechas de la fila elegida frente al riel", () => {
  // Riel: columnas, separación, aire y línea separadora.
  const bloqueRiel = riel.match(/\.xfk-riel \{[^}]+\}/)?.[0] ?? "";
  const columnas = bloqueRiel.match(/repeat\((\d+), (\d+)px\)/);
  const n = Number(columnas?.[1]);
  const col = Number(columnas?.[2]);
  const gap = px(/gap: (\d+)px/, bloqueRiel);
  const aire = px(/padding-left: (\d+)px/, bloqueRiel);
  const linea = px(/border-left: (\d+)px/, bloqueRiel);
  const anchoRiel = linea + aire + n * col + (n - 1) * gap;
  // Dónde termina el riel: en flujo, en el padding derecho de la fila; en angosto, en `right` absoluto.
  const paddingFila = px(/\.pulso-xlsform-frame \.pulso-outline-row \{[^}]*padding: \d+px (\d+)px/, tema);
  const rightAngosto = px(/\.pulso-outline-row > \.xfk-riel\.pulso-outline-riel \{[^}]*right: (\d+)px/, riel);
  // Flechas: dos botones de 22 px, 2 px entre ellos y 2 px de padding.
  const rightFlechas = px(/is-active:has\(> \.pulso-outline-riel\) > \.pulso-outline-actions \{ right: (\d+)px/, riel);

  test("el riel mide cinco columnas fijas de 24 px", () => {
    expect([n, col]).toEqual([5, 24]);
    expect(anchoRiel).toBe(139);
  });

  test.each([["ancho", paddingFila], ["angosto", rightAngosto]])("en %s la caja de las flechas no toca la del riel", (_, finRiel) => {
    const inicioRiel = finRiel + anchoRiel; // borde izquierdo del riel, medido desde la derecha
    expect(rightFlechas).toBeGreaterThan(inicioRiel); // las flechas empiezan a la izquierda de la línea separadora
  });
});
