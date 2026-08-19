import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Buscando por qué los cuatro recortes que se acababan de declarar no aparecían
// en pantalla salió algo mayor: media cola de este page-file no se dibuja.
//
//   `RouteView`   — definida y nunca referenciada, en todo `src`.
//   `AdvanceView` — igual.
//   la rama final de `ValidationView` — se llega sólo si `pestanaActiva` no es
//   ninguna de las cinco que el catálogo declara para `territorial/calidad`.
//
// Con eso, «Mapa general de Lima», «Manzanas seleccionadas», «Mapa operativo
// único», «Registros auditados», «Manzanas consideradas por el mapa» y «Avance
// por distrito» no tienen dirección que los abra.
//
// NO se borra: borrar una vista es decisión con doble confirmación, y en este
// repo ya se borró y restauró más de una. Este test fija el hecho para que
// nadie lo redescubra, y **cae si alguien las monta** —que es justo cuando hay
// que volver a mirar los avisos de recorte que llevan dentro—.

const raiz = path.resolve(__dirname, "../../../..");
const page = fs.readFileSync(
  path.join(__dirname, "TerritorialMonitoreoPage.tsx"),
  "utf8",
);
const catalogo = fs.readFileSync(
  path.join(raiz, "lib/navegacion/catalogos/monitoreo.ts"),
  "utf8",
);

// Sin comentarios: las marcas ⚠ que se acaban de poner nombran las funciones, y
// contarlas daría 3 donde hay 1 referencia real. Misma trampa que en el guard de
// la cola de contacto.
const codigo = page
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");
const referencias = (nombre: string) =>
  (codigo.match(new RegExp(`\\b${nombre}\\b`, "g")) ?? []).length;

describe("las superficies sin montar siguen sin montarse", () => {
  it.each(["RouteView", "AdvanceView"])("%s sólo aparece en su definición", (nombre) => {
    // Una sola aparición = la propia `function X(`. Dos o más = alguien la usa.
    expect(referencias(nombre)).toBe(1);
  });

  it("el catálogo declara exactamente las cinco pestañas de calidad", () => {
    const declaradas = [...catalogo.matchAll(/pestana\("territorial", "calidad", "(\w+)"/g)]
      .map((m) => m[1]);
    expect(declaradas.sort()).toEqual(
      ["anulacion", "cuotas", "duracion", "geolocalizacion", "reconciliacion"].sort(),
    );
  });

  it("ValidationView ramifica por esas cinco y la cola queda sin dirección", () => {
    const vista = codigo.slice(codigo.indexOf("function ValidationView"));
    // La primera rama es la de por defecto y se escribe con el `??`.
    expect(vista).toContain('(pestanaActiva ?? "geolocalizacion") === "geolocalizacion"');
    for (const clave of ["reconciliacion", "duracion", "cuotas", "anulacion"]) {
      expect(vista).toContain(`pestanaActiva === "${clave}"`);
    }
  });

  it("las tres zonas llevan su marca", () => {
    expect(page).toContain("⚠ SIN MONTAR. `RouteView`");
    expect(page).toContain("⚠ SIN MONTAR. Igual que `RouteView`");
    expect(page).toContain("⚠ RAMA SIN ALCANZAR");
  });
});
