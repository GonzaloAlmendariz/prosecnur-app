import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { eslabonQueCorta, estadoDeLaCadena, type EslabonDeFuente } from "./modeloDeCadena";

// Un estudio telefónico necesita las mismas tres piezas y en ese orden: el
// barrido sin universo no tiene a quién registrar, y la encuesta sin barrido no
// tiene contra qué cruzar. El orden es una dependencia real, y esto lo vigila.

const eslabon = (titulo: string, lista: boolean): EslabonDeFuente => ({
  clave: "universo",
  titulo,
  aporta: "",
  cifra: "",
  origen: null,
  actualizada: "",
  lista,
  accion: "",
});

const TRES = (universo: boolean, barrido: boolean, encuesta: boolean) => [
  eslabon("Universo", universo),
  eslabon("Barrido", barrido),
  eslabon("Encuesta", encuesta),
];

describe("eslabonQueCorta", () => {
  it("con nada conectado la cadena se corta en el universo", () => {
    expect(eslabonQueCorta(TRES(false, false, false))?.titulo).toBe("Universo");
  });

  it("con el universo listo se corta en el barrido", () => {
    expect(eslabonQueCorta(TRES(true, false, false))?.titulo).toBe("Barrido");
  });

  it("respeta el orden aunque se conecte primero un eslabón posterior", () => {
    // Se puede vincular Kobo antes que el barrido; el corte sigue estando en el
    // barrido, porque es de lo que dependen los estados.
    expect(eslabonQueCorta(TRES(true, false, true))?.titulo).toBe("Barrido");
  });

  it("con las tres conectadas no hay corte", () => {
    expect(eslabonQueCorta(TRES(true, true, true))).toBeNull();
  });
});

describe("estadoDeLaCadena", () => {
  it("completa dice qué habilita, no felicita", () => {
    expect(estadoDeLaCadena(TRES(true, true, true))).toEqual({ completa: true, resumen: "Listo para monitoreo" });
  });

  it("con una sola pieza suelta la nombra", () => {
    expect(estadoDeLaCadena(TRES(true, true, false)).resumen).toBe("Falta encuesta");
  });

  it("con varias sueltas cuenta en vez de enumerar", () => {
    // Enumerar dos o tres nombres en un mismo renglón produce la frase larga que
    // el rótulo no puede sostener; la lista de abajo ya dice cuáles son.
    expect(estadoDeLaCadena(TRES(false, false, true)).resumen).toBe("Faltan 2 de 3 piezas");
    expect(estadoDeLaCadena(TRES(false, false, false)).resumen).toBe("Faltan 3 de 3 piezas");
  });
});

describe("la cadena reemplazó a las tres piezas que decían lo mismo", () => {
  it("el page-file ya no monta la tira de pasos ni el mapa del paquete", () => {
    const page = readFileSync(resolve(__dirname, "..", "TelefonicoMonitoreoPage.tsx"), "utf8");
    expect(page).toContain("<CadenaDeFuentes");
    expect(page).not.toContain("<LlenadoDeFuentes");
    expect(page).not.toContain("mon-phone-source-package-map");
  });
});
