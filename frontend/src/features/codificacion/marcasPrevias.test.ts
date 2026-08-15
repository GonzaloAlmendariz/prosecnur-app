import { describe, expect, it } from "vitest";

import { avisoMarcaPrevia } from "./marcasPrevias";

const MARCAS = [
  { codigo: "1", n: 2 },
  { codigo: "3", n: 1 },
];

describe("avisoMarcaPrevia", () => {
  it("no avisa nada para un código que nadie marcó", () => {
    // El control: si el aviso apareciera siempre, este caso también lo
    // pintaría y el chip dejaría de significar algo.
    expect(avisoMarcaPrevia("7", MARCAS, 3)).toBeNull();
    expect(avisoMarcaPrevia("1", [], 3)).toBeNull();
    expect(avisoMarcaPrevia("1", undefined, 3)).toBeNull();
    expect(avisoMarcaPrevia("", MARCAS, 3)).toBeNull();
  });

  it("va en proporción cuando sólo algunas filas lo tenían", () => {
    const aviso = avisoMarcaPrevia("1", MARCAS, 3);
    expect(aviso?.todas).toBe(false);
    expect(aviso?.etiqueta).toBe("ya marcada · 2 de 3");
    expect(aviso?.detalle).toContain("2 de 3");
  });

  it("con una sola persona lo dice en singular y sin fracción", () => {
    const aviso = avisoMarcaPrevia("3", [{ codigo: "3", n: 1 }], 1);
    expect(aviso?.todas).toBe(true);
    expect(aviso?.etiqueta).toBe("ya marcada");
    expect(aviso?.detalle).toBe(
      "Esta persona ya marcó esta opción: mandarla acá no suma una mención.",
    );
  });

  it("cuando todas la tenían no muestra una fracción redundante", () => {
    const aviso = avisoMarcaPrevia("1", [{ codigo: "1", n: 4 }], 4);
    expect(aviso?.todas).toBe(true);
    expect(aviso?.etiqueta).toBe("ya marcada");
    expect(aviso?.detalle).toContain("Las 4 ya marcaron");
  });

  it("un n mayor que la frecuencia no produce '5 de 3'", () => {
    // Defensivo: el backend cuenta marcas sobre las mismas filas, así que no
    // debería pasar; si pasara, la fracción imposible es peor que el genérico.
    const aviso = avisoMarcaPrevia("1", [{ codigo: "1", n: 5 }], 3);
    expect(aviso?.todas).toBe(true);
    expect(aviso?.etiqueta).toBe("ya marcada");
  });

  it("ignora un conteo en cero o no numérico", () => {
    expect(avisoMarcaPrevia("1", [{ codigo: "1", n: 0 }], 3)).toBeNull();
    expect(
      avisoMarcaPrevia("1", [{ codigo: "1", n: Number.NaN }], 3),
    ).toBeNull();
  });

  it("compara el código sin espacios de sobra", () => {
    expect(avisoMarcaPrevia(" 1 ", MARCAS, 3)?.etiqueta).toBe("ya marcada · 2 de 3");
    expect(avisoMarcaPrevia("1", [{ codigo: " 1", n: 2 }], 3)?.todas).toBe(false);
  });
});
