import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

// El perfil renderiza las mismas fuentes en DOS ramas —vista telefónica y vista
// general— y cada rama las había bautizado a su manera:
//
//   activeRows      → «Fuentes activas»  ·  «Fuentes configuradas»
//   reportSources   → «Fuentes del corte» ·  «Fuentes del reporte»
//
// «Fuentes configuradas» era además el nombre de OTRA superficie que se dibuja
// tres líneas más abajo en la misma vista —la lista con el contador
// `activas/total`, que es la que sí trae todas las configuradas—. Así que una
// tabla del subconjunto habilitado se llamaba igual que la lista del conjunto
// completo, y quien las leyera de corrido veía dos veces el mismo rótulo con
// dos poblaciones distintas.
//
// La invariante general, que es lo que este test fija: un mismo dato se llama
// igual en todas las ramas donde se dibuja.

const fuente = fs.readFileSync(
  path.resolve(__dirname, "AcreditacionMonitoreoPage.tsx"),
  "utf8",
);

/**
 * Título del panel que envuelve cada `<DataTable rows={X}`, agrupado por
 * (componente, variable).
 *
 * La clave lleva el componente porque el archivo reusa nombres: `sourceRows`
 * es la lista de fuentes configuradas en una vista y una distribución de casos
 * agrupada por fuente en otra. Son datos distintos y DEBEN llamarse distinto;
 * compararlos sólo por nombre de variable daba un falso positivo.
 */
function titulosPorDato(): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  const tabla = /<DataTable\s+rows=\{(\w+)\}/g;
  for (let m = tabla.exec(fuente); m; m = tabla.exec(fuente)) {
    // El h3 más cercano hacia atrás: es la cabecera de su `mon-profile-panel`.
    const previo = fuente.slice(0, m.index);
    const h3 = previo.lastIndexOf("<h3>");
    if (h3 < 0) continue;
    const cierre = previo.indexOf("</h3>", h3);
    if (cierre < 0) continue;
    const titulo = previo.slice(h3 + 4, cierre);
    // Sólo los rótulos literales; uno interpolado no se puede comparar así.
    if (/[{<]/.test(titulo)) continue;
    const componente = [...previo.matchAll(/^function (\w+)/gm)].at(-1)?.[1] ?? "?";
    const clave = `${componente}.${m[1]}`;
    if (!mapa.has(clave)) mapa.set(clave, new Set());
    mapa.get(clave)!.add(titulo);
  }
  return mapa;
}

describe("un mismo dato se llama igual en todas las ramas", () => {
  test("ninguna variable de tabla aparece bajo dos títulos distintos", () => {
    const conflictos = [...titulosPorDato()]
      .filter(([, titulos]) => titulos.size > 1)
      .map(([dato, titulos]) => `${dato}: ${[...titulos].join(" / ")}`);
    expect(conflictos).toEqual([]);
  });

  test("las fuentes conservan los nombres acordados", () => {
    const de = (variable: string) => {
      const titulos = new Set<string>();
      for (const [clave, valores] of titulosPorDato()) {
        if (clave.endsWith(`.${variable}`)) valores.forEach((v) => titulos.add(v));
      }
      return [...titulos];
    };
    expect(de("activeRows")).toEqual(["Fuentes activas"]);
    expect(de("reportSources")).toEqual(["Fuentes del reporte"]);
  });

  test("«Fuentes configuradas» queda para la lista que sí las trae todas", () => {
    // La que lleva el contador activas/total. Si alguien vuelve a titular así
    // una tabla del subconjunto, este conteo sube y el test cae.
    const usos = fuente.match(/Fuentes configuradas/g) ?? [];
    expect(usos.length).toBe(2); // el aria-label del aside y su encabezado
  });
});

describe("una cabecera de columna no pierde la tilde que su gemela sí lleva", () => {
  // Las filas que arma el frontend usan la CLAVE como encabezado visible
  // (`columnLabel` sólo remapea unas pocas). Así, la pestaña de seguimiento
  // mostraba «Teléfono» y la de enlaces «Telefono» para el mismo canal, y
  // «Tecnica» junto a «Estado» y «Meta» bien escritos.
  //
  // La reparación va en `columnLabel` y no en la clave: la clave también puede
  // llegar del payload, y renombrarla sólo arregla las filas locales.
  const mapa = fuente.slice(
    fuente.indexOf("function columnLabel"),
    fuente.indexOf("\n}", fuente.indexOf("function columnLabel")),
  );

  test.each([
    ["Tecnica", "Técnica"],
    ["Telefono", "Teléfono"],
    ["Validas", "Válidas"],
  ])("%s se muestra como %s", (clave, rotulo) => {
    expect(mapa).toContain(`${clave}: "${rotulo}"`);
  });

  test("ningún contador de panel escribe «dias» sin tilde", () => {
    expect(fuente).not.toMatch(/\}\s*dias</);
  });
});
