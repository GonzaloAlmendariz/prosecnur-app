// I9 del rediseño (2026-10-14). Mata: una lámina de texto que vuelve a salir en blanco en el Informe, o que muestra el
// texto aunque tenga viñetas (las viñetas son lo que la lámina enseña).
import { describe, expect, it } from "vitest";
import { textoDeLamina } from "./MaquetaTarjeta";

describe("maqueta de la lámina de texto", () => {
  it("las viñetas mandan, hasta cuatro", () => {
    const r = textoDeLamina({ titulo: " Texto corrido ", texto: "x", bullets: ["Uno.", "", "Dos.", "Tres.", "Cuatro.", "Cinco."] });
    expect(r.titulo).toBe("Texto corrido");
    expect(r.lineas.map((l) => l.texto)).toEqual(["Uno.", "Dos.", "Tres.", "Cuatro."]);
    expect(r.lineas.every((l) => l.vineta)).toBe(true);
  });

  it("sin viñetas, el texto; sin nada, ninguna línea (el CSS pinta líneas grises)", () => {
    expect(textoDeLamina({ texto: "Conclusión." }).lineas).toEqual([{ texto: "Conclusión.", vineta: false }]);
    expect(textoDeLamina({}).lineas).toEqual([]);
  });
});
