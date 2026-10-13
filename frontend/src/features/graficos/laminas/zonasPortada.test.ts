import { describe, expect, test } from "vitest";
import { zonasPortada } from "./ZonasTextoLamina";

// G1 (Gonzalo, 2026-10-13): en la portada la fecha no se podía tocar sobre la lámina. Cada texto de la portada tiene su
// zona, en la caja donde `.lam_laminas_portada` (api/R/lamina_identidad.R) lo dibuja en cada composición.
const FECHA_Y_EN_PULGADAS = { centrada: 5.12, izquierda: 4.85, banda: 7.5 - 0.58 } as const;

describe("zonas de la portada", () => {
  test.each(Object.entries(FECHA_Y_EN_PULGADAS))("composición %s: la fecha tiene zona donde el motor la escribe", (variante, y) => {
    const zonas = zonasPortada("p_slide_portada", variante) ?? [];
    expect(zonas.map((z) => z.campo)).toEqual(["subtitulo", "titulo", "subtexto", "fecha"]);
    const fecha = zonas.find((z) => z.campo === "fecha")!;
    const centro = (y + 0.15) / 7.5;
    expect(fecha.y).toBeLessThan(centro);
    expect(fecha.y + fecha.h).toBeGreaterThan(centro);
  });

  test("sin composición declarada va la centrada; otro tipo de lámina no tiene zonas de portada", () => {
    expect(zonasPortada("p_slide_portada", undefined)).toEqual(zonasPortada("p_slide_portada", "centrada"));
    expect(zonasPortada("p_slide_1_grafico", "centrada")).toBeNull();
  });
});
