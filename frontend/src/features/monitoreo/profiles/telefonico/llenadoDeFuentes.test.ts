import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { siguientePasoDeLlenado, type PasoDeLlenado } from "./LlenadoDeFuentes";

// Un estudio telefónico siempre necesita las mismas tres piezas y en ese orden:
// el barrido sin base no tiene a quién registrar, y la encuesta sin barrido no
// tiene contra qué cruzar. Antes eso se explicaba en un párrafo que cambiaba
// según cuál faltara; ahora se muestra, y esto vigila la regla del orden.

const paso = (titulo: string, lista: boolean): PasoDeLlenado => ({ titulo, aporta: "", lista });

const TRES = (base: boolean, barrido: boolean, encuesta: boolean) => [
  paso("Base telefónica", base),
  paso("Barrido telefónico", barrido),
  paso("Encuesta en Kobo", encuesta),
];

describe("siguientePasoDeLlenado", () => {
  it("con nada configurado empieza por la base", () => {
    expect(siguientePasoDeLlenado(TRES(false, false, false))?.titulo).toBe("Base telefónica");
  });

  it("con la base lista sigue por el barrido", () => {
    expect(siguientePasoDeLlenado(TRES(true, false, false))?.titulo).toBe("Barrido telefónico");
  });

  it("con base y barrido listos sigue por la encuesta", () => {
    expect(siguientePasoDeLlenado(TRES(true, true, false))?.titulo).toBe("Encuesta en Kobo");
  });

  it("respeta el orden aunque se complete uno de más adelante", () => {
    // Alguien puede vincular la encuesta antes que el barrido; el siguiente
    // sigue siendo el barrido, porque es de lo que dependen los estados.
    expect(siguientePasoDeLlenado(TRES(true, false, true))?.titulo).toBe("Barrido telefónico");
  });

  it("con las tres listas no hay nada que seguir", () => {
    // Y entonces el bloque no se dibuja: el estado ya lo dicen las tarjetas de
    // cada fuente, y repetirlo aquí sería el mismo dato en dos sitios.
    expect(siguientePasoDeLlenado(TRES(true, true, true))).toBeNull();
  });
});

describe("la vista ya no narra la secuencia", () => {
  it("el párrafo que describía el orden quedó sustituido por los pasos", () => {
    const page = readFileSync(resolve(__dirname, "TelefonicoMonitoreoPage.tsx"), "utf8");
    expect(page).not.toContain("Primero vincula la base de universo");
    expect(page).toContain("<LlenadoDeFuentes");
  });
});
