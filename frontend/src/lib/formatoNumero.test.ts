import { describe, expect, it } from "vitest";

import {
  SIN_CIFRA,
  formatoConteo,
  formatoConteoDe,
  formatoDecimal,
  numeroFinito,
} from "./formatoNumero";

// El Node del runner puede no traer ICU completo (memoria del repo). Lo que
// estos tests sujetan es que haya separador de millares y que la cifra sea la
// correcta; el carácter exacto lo decide el runtime, así que se normaliza.
// Con ICU completo es-PE escribe «17,124» y «1,234.5».
const sinSeparador = (texto: string) => texto.replace(/(\d)[.,  ](\d)/g, "$1|$2");

describe("formatoNumero", () => {
  it("separa millares en los conteos", () => {
    expect(sinSeparador(formatoConteo(17124))).toBe("17|124");
    expect(sinSeparador(formatoConteo(1234567))).toBe("1|234|567");
    expect(formatoConteo(3)).toBe("3");
  });

  it("redondea los conteos a entero", () => {
    expect(sinSeparador(formatoConteo(2117.6))).toBe("2|118");
  });

  it("distingue sin dato de cero", () => {
    expect(formatoConteo(0)).toBe("0");
    expect(formatoConteo(null)).toBe(SIN_CIFRA);
    expect(formatoConteo(undefined)).toBe(SIN_CIFRA);
    expect(formatoConteo("")).toBe(SIN_CIFRA);
    expect(formatoConteo(Number.NaN, "S/D")).toBe("S/D");
    expect(numeroFinito("12")).toBe(12);
    expect(numeroFinito("x")).toBeNull();
  });

  it("formatea decimales sin ceros de relleno", () => {
    expect(sinSeparador(formatoDecimal(1234.5))).toBe("1|234|5");
    expect(formatoDecimal(50)).toBe("50");
    expect(sinSeparador(formatoDecimal(0.25, 2))).toBe("0|25");
    expect(formatoDecimal(null)).toBe(SIN_CIFRA);
  });

  it("concuerda el sustantivo con la cifra", () => {
    expect(formatoConteoDe(1, "etiqueta")).toBe("1 etiqueta");
    expect(formatoConteoDe(2, "etiqueta")).toBe("2 etiquetas");
    expect(sinSeparador(formatoConteoDe(3318, "caso"))).toBe("3|318 casos");
    expect(formatoConteoDe(0, "sección", "secciones")).toBe("0 secciones");
    expect(formatoConteoDe(null, "caso")).toBe(SIN_CIFRA);
  });
});
