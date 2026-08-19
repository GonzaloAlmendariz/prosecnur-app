import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// «UMP pendientes» pintaba `items.length` **después** de `.slice(0, 5)`: el
// rótulo decía 5 y había 21. Un tope de presentación presentado como dato, dos
// dedos debajo de un panel que declara «Cuota pendiente 3».
//
// Y las dos cifras que quedaban —3 y 21— no son del mismo hecho: una cuenta las
// UMP de la CUOTA OPERATIVA y la otra las de la HOJA DE RUTA. Ninguna estaba mal;
// lo que faltaba era que cada rótulo dijera de cuáles habla.

const fuente = fs.readFileSync(
  path.resolve(__dirname, "TerritorialAdvanceWorkbench.tsx"),
  "utf8",
);
const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("un tope de presentación no se presenta como dato", () => {
  it("los grupos llevan el total aparte de los items", () => {
    expect(codigo).toMatch(/total: districtsConBrecha\.length/);
    expect(codigo).toMatch(/total: blocksPendientes\.length/);
  });

  it("la cabecera del grupo pinta el total, no el largo de la lista", () => {
    expect(codigo).toContain("formatMetric(group.total)");
    // Sólo en la cabecera: el aviso de corte SÍ usa el largo de la lista, y ahí
    // es lo correcto —«los 5 de mayor brecha, de 21»—.
    // La línea del `<em>` que va justo detrás del rótulo del grupo. Una ventana
    // de caracteres no sirve: a 200 ya entra el `{group.items.length ? …}` que
    // decide si pintar la lista, y ahí el largo es lo correcto.
    const lineas = codigo.split("\n");
    const i = lineas.findIndex((l) => l.includes("<strong>{group.label}</strong>"));
    expect(i).toBeGreaterThan(-1);
    expect(lineas[i + 1]).toContain("group.total");
    expect(lineas[i + 1]).not.toContain("group.items.length");
  });

  it("el corte se declara cuando lo hay", () => {
    expect(codigo).toContain("group.total > group.items.length");
    expect(codigo).toMatch(/Los \{formatMetric\(group\.items\.length\)\} de mayor brecha, de/);
  });

  it("el tope es una constante y no un 5 suelto en dos sitios", () => {
    expect(codigo).toContain("const PRIORIDADES_VISIBLES = 5;");
    expect((codigo.match(/slice\(0, PRIORIDADES_VISIBLES\)/g) ?? []).length).toBe(2);
  });
});

describe("cada UMP dice de qué fuente es", () => {
  it("el estado nombra la cuota operativa", () => {
    expect(codigo).toContain('Estado UMP {operational ? "· cuota operativa" : ""}');
  });

  it("las prioridades nombran la hoja de ruta", () => {
    expect(codigo).toContain("UMP de la hoja de ruta y distritos, ordenados por brecha");
  });
});
