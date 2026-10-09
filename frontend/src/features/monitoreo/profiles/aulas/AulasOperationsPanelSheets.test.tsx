import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AulasOperationsPanel } from "./AulasOperationsPanel";

/**
 * El ciclo del libro contra el Sheets: leer, publicar y el destino recordado.
 *
 * Se verifica por render y no por captura a propósito. Un botón no necesita
 * layout para probarse, y el runner visual depende de que la máquina esté
 * descargada —el día que se escribió esto no alcanzaba readiness ni con los
 * cambios fuera—. Un test de markup fija además el comportamiento, que una
 * captura no hace.
 */

type Props = Parameters<typeof AulasOperationsPanel>[0];

// `as never` en el spread no compila —«Spread types may only be created from
// object types»— y `as Props` obligaria a construir un config entero. Se tipa
// el parcial y se ensancha en la llamada, que es donde el compilador ya sabe
// que las obligatorias estan puestas.
function pintar(props: Partial<Props> = {}) {
  const base = {
    config: {} as Props["config"],
    sources: [] as Props["sources"],
    busy: false,
    onImportPlan: () => {},
    onSyncField: () => {},
    onGenerarLibro: () => {},
    onImportarLibro: () => {},
  };
  return renderToStaticMarkup(<AulasOperationsPanel {...base} {...props} />);
}

/** Un config con plan, para que los botones del libro no estén apagados. */
const conPlan = (extra: Record<string, unknown> = {}) =>
  ({ enabled: true, plan_rows: 5, ...extra }) as unknown as Props["config"];

const RECORDADO = {
  spreadsheet_id: "LIBRO123",
  url: "https://docs.google.com/spreadsheets/d/LIBRO123/edit",
  updated_at: "2026-08-27T14:03:00Z",
};

describe("AulasOperationsPanel — leer del Sheets", () => {
  it("ofrece el botón cuando hay con qué leer", () => {
    expect(pintar({ onLeerDeSheets: () => {} })).toContain("Leer del Sheets");
  });

  it("no lo ofrece si nadie sabe atenderlo", () => {
    // Un botón que no hace nada enseña a desconfiar de los botones. La prop es
    // opcional para que una superficie que no conecte el handler no lo pinte.
    expect(pintar()).not.toContain("Leer del Sheets");
  });

  it("va junto a las otras formas de mover el libro, no en un panel aparte", () => {
    // Son formas de la MISMA operación —cruzar el operativo con lo que el
    // equipo escribió— y separarlas obligaría a saber de antemano cuál toca.
    const html = pintar({ onLeerDeSheets: () => {}, onPublicarASheets: () => {} });
    const generar = html.indexOf("Generar libro");
    const archivo = html.indexOf("Leer libro llenado");
    const sheets = html.indexOf("Leer del Sheets");
    const publicar = html.indexOf("Publicar al Sheets");
    expect(generar).toBeGreaterThan(-1);
    expect(archivo).toBeGreaterThan(generar);
    expect(sheets).toBeGreaterThan(archivo);
    expect(publicar).toBeGreaterThan(sheets);
  });

  it("ya no pide el enlace con un prompt: el campo lo reemplaza", () => {
    // El prompt era un destino de un solo uso: cada lectura volvía a pedirlo y
    // nada quedaba guardado. El campo persistente es la decisión de Gonzalo
    // («recordarlo, para escribir sobre él y leer»).
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const fuente = fs.readFileSync(path.join(aqui, "AulasOperationsPanel.tsx"), "utf8");
    expect(fuente).not.toContain("window.prompt");
  });
});

describe("AulasOperationsPanel — el campo del Sheets del operativo", () => {
  it("muestra el enlace recordado y desde cuándo está guardado", () => {
    const html = pintar({
      config: conPlan({ libro_sheets: RECORDADO }),
      onLeerDeSheets: () => {},
      onPublicarASheets: () => {},
    });
    expect(html).toContain('value="https://docs.google.com/spreadsheets/d/LIBRO123/edit"');
    expect(html).toContain("Guardado");
  });

  it("sin recordado, invita a pegarlo una vez", () => {
    const html = pintar({ config: conPlan(), onLeerDeSheets: () => {}, onPublicarASheets: () => {} });
    expect(html).toContain('value=""');
    expect(html).toMatch(/P[ée]galo una vez/);
  });

  it("el campo tiene nombre accesible", () => {
    const html = pintar({ config: conPlan(), onLeerDeSheets: () => {} });
    expect(html).toMatch(/<label[^>]*for="aulas-libro-destino-enlace"/);
    expect(html).toMatch(/<input[^>]*id="aulas-libro-destino-enlace"/);
  });
});

describe("AulasOperationsPanel — publicar al Sheets", () => {
  it("con destino recordado y plan, el botón está activo", () => {
    const html = pintar({
      config: conPlan({ libro_sheets: RECORDADO }),
      onPublicarASheets: () => {},
    });
    // La etiqueta de apertura del botón que contiene el rótulo: desde el
    // `<button` inmediatamente anterior —un regex desde el inicio adoptaba los
    // botones de al lado y sus `disabled`—.
    const fin = html.indexOf("Publicar al Sheets");
    expect(fin).toBeGreaterThan(-1);
    const boton = html.slice(html.lastIndexOf("<button", fin), fin);
    expect(boton).not.toContain("disabled");
  });

  it("sin destino recordado y campo vacío, explica qué falta en vez de dejar caer un 400", () => {
    const html = pintar({ config: conPlan(), onPublicarASheets: () => {} });
    expect(html).toContain("sin él no hay dónde publicar");
  });

  it("el título del botón cuenta las dos mitades: lee lo del equipo y no lo toca", () => {
    // La regla de dueño seguía contada —«las hojas del equipo no se tocan»—
    // pero desde el 2026-09-08 publicar hace algo MÁS que no decía: lee primero
    // lo que el equipo escribió. Se cambió porque publicar sin leer dejaba
    // invisible su trabajo, y el botón que no lo dice hace que alguien busque
    // un «Leer del Sheets» que ya no hace falta pulsar antes.
    const html = pintar({
      config: conPlan({ libro_sheets: RECORDADO }),
      onPublicarASheets: () => {},
    });
    expect(html).toContain("Lee primero lo que el equipo escribió");
    expect(html).toContain("no se tocan");
  });
});

/**
 * **Releer el cruce con el otro estudio**, a petición (Gonzalo, 2026-09-18).
 *
 * El botón existe SÓLO con fuente declarada. Un botón que únicamente puede
 * fallar ocupa sitio para no hacer nada, y su causa —que el estudio no declara
 * contra quién se cruza— no se arregla pulsándolo.
 */
describe("AulasOperationsPanel: releer el cruce", () => {
  it("sin fuente declarada el botón NO se pinta", () => {
    const html = pintar({ config: conPlan(), onRecalcularTraslape: undefined });
    expect(html).not.toContain("Releer");
  });

  it("con fuente declarada dice contra quién relee", () => {
    // El nombre del otro estudio en el rótulo: «Releer el cruce» a secas
    // obligaría a recordar contra qué se cruza este proyecto.
    const html = pintar({
      config: conPlan(), onRecalcularTraslape: () => {}, traslapeDe: "HSVG",
    });
    expect(html).toContain("Releer cruce con HSVG");
    // Y el título declara el alcance, que es lo que quita el miedo a pulsarlo:
    // esto no escribe nada en las hojas del otro operativo.
    expect(html).toContain("Sólo lee: no escribe nada en sus hojas");
  });

  it("sin plan importado queda apagado, con su motivo", () => {
    const html = pintar({
      config: { enabled: true } as unknown as Props["config"],
      onRecalcularTraslape: () => {}, traslapeDe: "HSVG",
    });
    expect(html).toContain("Primero importa el plan de cursos-horario");
  });
});
