import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { COLOR_RESULTADO } from "./coloresDeResultado";

/**
 * El trío de desenlaces se dice en DOS idiomas y tiene que decir lo mismo.
 *
 * `COLOR_RESULTADO` centralizó el lado TypeScript —«26 literales del mismo trío
 * verde / ámbar / granate escritos a mano en nueve archivos»— y el lado CSS
 * nunca se tocó: medido, **224 literales** de esos mismos tres colores en seis
 * hojas. Un token CSS y una constante TS con el mismo papel no se pueden
 * verificar el uno al otro solos; esto es lo único que impide que vuelvan a
 * separarse, y el fallo sería invisible —dos superficies del mismo color
 * ligeramente distinto, sin que nada se rompa—.
 */

const tokens = readFileSync(
  fileURLToPath(new URL("../../app/tokens.css", import.meta.url)),
  "utf-8",
);

function valorDelToken(nombre: string): string | null {
  const m = tokens.match(new RegExp(`--pulso-resultado-${nombre}:\\s*([^;]+);`));
  return m ? m[1].trim().toLowerCase() : null;
}

describe("los desenlaces dicen lo mismo en CSS y en TypeScript", () => {
  it("cada color de `COLOR_RESULTADO` tiene su token con el mismo valor", () => {
    const desajustes = Object.entries(COLOR_RESULTADO)
      .map(([clave, valor]) => ({ clave, ts: valor.toLowerCase(), css: valorDelToken(clave) }))
      .filter((x) => x.ts !== x.css);
    expect(desajustes).toEqual([]);
  });

  it("y no hay tokens de desenlace que TypeScript no conozca", () => {
    // Un token de más es tan malo como uno de menos: una hoja lo usaría y no
    // habría nada en TS que lo mantuviera vivo.
    const enCss = [...tokens.matchAll(/--pulso-resultado-([a-z]+):/g)].map((m) => m[1]);
    expect(enCss.sort()).toEqual(Object.keys(COLOR_RESULTADO).sort());
  });

  it("el perfil de aulas ya no escribe esos hex a mano", () => {
    // Migrado y verificado por huella: 44 colores distintos y 21 129
    // propiedades pintadas ANTES y DESPUÉS, idénticas. Centraliza, no
    // recolorea.
    const css = readFileSync(
      fileURLToPath(new URL("./profiles/aulas/aulasMonitoreo.css", import.meta.url)),
      "utf-8",
    );
    const literales = [...css.matchAll(/#(168a55|b97611|a61d4f|7a8796)/gi)].map((m) => m[0]);
    expect(literales).toEqual([]);
  });

  it("y deja DECLARADO lo que queda fuera, en vez de darlo por hecho", () => {
    // Las otras cinco hojas siguen con literales —**187 medidos**—, y dos de ellas
    // están congeladas a crecimiento. Migrarlas es otra unidad de trabajo y una
    // decisión de Gonzalo, no un efecto colateral de tocar aulas. Este aserto
    // no exige que bajen: exige que si alguien las migra, actualice la cifra, y
    // que si crecen mucho se note.
    const dir = fileURLToPath(new URL("./", import.meta.url));
    const otras = ["monitoreo.css", "public/monitoreoPublic.css", "profiles/profilePage.css",
                   "profiles/telefonico/telefonicoProfile.css", "profiles/territorial/territorialProfile.css"];
    const total = otras.reduce((n, f) => {
      const txt = readFileSync(dir + f, "utf-8");
      return n + [...txt.matchAll(/#(168a55|b97611|a61d4f)/gi)].length;
    }, 0);
    expect(total).toBeLessThanOrEqual(187);
  });
});
