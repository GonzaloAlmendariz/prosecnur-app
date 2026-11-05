import { describe, expect, it } from "vitest";
import { textoPlano } from "./textoPlano";

describe("textoPlano (H12)", () => {
  it("quita el encabezado de markdown de una sección del formulario", () => {
    expect(textoPlano("### MÓDULO B. EXPERIENCIA LABORAL")).toBe("MÓDULO B. EXPERIENCIA LABORAL");
    expect(textoPlano("#### Bloque 2")).toBe("Bloque 2");
  });
  it("quita negrita, cursiva, enlaces y colores sin tocar el texto", () => {
    expect(textoPlano("¿**Trabajas** de forma _remunerada_?")).toBe("¿Trabajas de forma remunerada?");
    expect(textoPlano('<span style="color:#c00">Atención</span> [ver](https://x.y)')).toBe("Atención ver");
  });
  it("deja intactos los guiones bajos de los nombres de variable y los asteriscos sueltos", () => {
    expect(textoPlano("nivel_curricular")).toBe("nivel_curricular");
    expect(textoPlano("3 * 4")).toBe("3 * 4");
  });
  it("vacío queda vacío", () => {
    expect(textoPlano(undefined)).toBe("");
    expect(textoPlano("")).toBe("");
  });
});
