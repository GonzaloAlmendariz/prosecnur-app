import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P3 de la pasada de formato — los datos se unen en una frase, no con «·».**
 *
 * El punto medio como separador es la marca de una interfaz que pega datos en vez de
 * decirlos («Campo real · enviada el 02/11»). Se reemplaza con comas, «y» o
 * `enumerar` (lib/enumerar.ts). Ratchet por archivo: el conteo sólo BAJA y un
 * archivo nuevo con «·» falla. Al limpiar uno, se baja su número aquí (o se borra).
 *
 * No cuentan los comentarios ni la expresión que limpia el código de error de
 * `ApiError` («… · E_CODIGO»): no se pintan.
 *
 * Foto del 3 nov 2026: 61 en 34 archivos, casi todos del correo.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

const SNAPSHOT: Record<string, number> = {
  "aulas/plantilla.ts": 1,
  "campanas/CampanaCorreoShell.tsx": 1,
  "correos/BarraDelCorreo.tsx": 1,
  "correos/BibliotecaDeBloques.tsx": 2,
  "correos/CapaDeEdicion.tsx": 1,
  "correos/DialogoImportarHtml.tsx": 3,
  "correos/EstiloDelBloque.tsx": 1,
  "correos/EstiloDelCorreo.tsx": 1,
  "correos/GuardarSeccion.tsx": 1,
  "correos/ImportarSecciones.tsx": 2,
  "correos/PanelDeBloque.tsx": 1,
  "correos/PanelDestinatarios.tsx": 4,
  "correos/PanelEnvios.tsx": 2,
  "correos/PanelMailchimp.tsx": 4,
  "correos/PanelRevision.tsx": 2,
  "correos/PanelSurveyMonkey.tsx": 5,
  "correos/PreguntaLogosDelBanner.tsx": 1,
  "correos/SelectorDeEnvio.tsx": 1,
  "correos/contactos/CruceDeVariables.tsx": 2,
  "correos/contactos/DistribucionDeVariable.tsx": 1,
  "correos/contactos/SelectorDeVariables.tsx": 1,
  "correos/contactos/modeloContactos.ts": 1,
  "correos/mailchimpPorApiModel.ts": 1,
  "correos/modeloCampanas.ts": 1,
  "correos/modeloCorreo.ts": 6,
  "correos/modeloEnvios.ts": 1,
  "correos/modeloTrato.ts": 1,
  "correos/nombresDeImagen.ts": 1,
  "editor/EditorDeMaterial.tsx": 1,
  "editor/modeloEditor.ts": 2,
  "supervision/SeccionesSupervision.tsx": 1,
  "supervision/SupervisionEnSheets.tsx": 1,
  "territorial/DialogoHojaUmp.tsx": 2,
  "territorial/ExcelDeAsignacion.tsx": 4,
};

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

/** Sin comentarios ni la limpieza del código de error: sólo lo que puede pintarse. */
export function puntosMedios(fuente: string): number {
  const sinComentarios = fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, ""))
    .join("\n")
    .replace(/\/ · E_\[A-Z_\]\+\$\//g, "")
    .replace(/\/\\s·\\s\[A-Z0-9_\]\+\$\//g, "");
  return (sinComentarios.match(/·/g) ?? []).length;
}

describe("los datos se unen en una frase, no con «·» (P3)", () => {
  const conteo = archivos(aqui).map((f) => [path.relative(aqui, f).split(path.sep).join("/"), puntosMedios(readFileSync(f, "utf8"))] as const);

  it("el barrido ve el feature (centinela)", () => {
    expect(conteo.length).toBeGreaterThan(250);
  });

  it("ningún archivo suma «·» ni aparece uno nuevo con «·»", () => {
    const regresiones = conteo
      .filter(([archivo, n]) => n > (SNAPSHOT[archivo] ?? 0))
      .map(([archivo, n]) => `${archivo}: ${SNAPSHOT[archivo] ?? 0} → ${n}`);
    expect(regresiones).toEqual([]);
  });

  it("el detector cuenta lo que se pinta y no la limpieza del código de error", () => {
    expect(puntosMedios("const a = `${x} · ${y}`;")).toBe(1);
    expect(puntosMedios("// «a · b»\nconst b = 1;")).toBe(0);
    expect(puntosMedios('m.replace(/ · E_[A-Z_]+$/, "")')).toBe(0);
  });
});
