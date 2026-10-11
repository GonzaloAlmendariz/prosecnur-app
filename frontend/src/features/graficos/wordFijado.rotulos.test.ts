import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../api/graficos";
import { ROTULOS_FIJADOS_WORD, rotuloDeArg } from "./wordFijado";

// C5 (QA en vivo Meta A): el grupo «Lo fija el recetario» del editor Word mostraba identificadores humanizados
// («Size Leyenda», «Size Texto Barras Peq», «Size Ejes», «Barra Extra Semaforo») para los fijados sin metadatos.

describe("rotuloDeArg: rótulos legibles para lo que fija el recetario", () => {
  it.each([
    ["size_leyenda", "Tamaño de la leyenda"],
    ["size_texto_barras_peq", "Tamaño del texto en barras pequeñas"],
    ["size_ejes", "Tamaño de los ejes"],
    ["barra_extra_semaforo", "Semáforo de la barra extra"],
  ])("%s sin metadatos → «%s»", (arg, esperado) => {
    expect(rotuloDeArg(arg, undefined)).toBe(esperado);
  });

  it("el rótulo del catálogo manda sobre la tabla; el identificador queda como último recurso", () => {
    const meta: ArgMetadata = { name: "size_ejes", label: "Tamaño texto de ejes", tipo_input: "number", grupo: "estilo" };
    expect(rotuloDeArg("size_ejes", meta)).toBe("Tamaño texto de ejes");
    expect(rotuloDeArg("size_ejes", { ...meta, label: "  " })).toBe("Tamaño de los ejes");
    expect(rotuloDeArg("ajuste_nuevo", undefined)).not.toBe("");
    // Una clave del prototipo no es un rótulo.
    expect(rotuloDeArg("toString", undefined)).not.toMatch(/function/);
  });

  // Mata: que el recetario fije un arg nuevo y vuelva a salir su identificador. Lee la fuente única del backend.
  it("cubre cada arg que fija la escala Word del recetario", () => {
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const r = fs.readFileSync(path.resolve(aqui, "../../../../api/R/reporte_word_escala_fijados.R"), "utf8");
    const cuerpo = r.slice(r.indexOf(".word_escala_fijados <- function()"), r.indexOf(".word_fijado_de_preset"));
    const args = [...cuerpo.matchAll(/\be\("([a-z0-9_]+)"/g)].map((m) => m[1]);
    expect(args.length).toBeGreaterThan(20);
    const faltan = args.filter((a) => !Object.prototype.hasOwnProperty.call(ROTULOS_FIJADOS_WORD, a));
    expect(faltan).toEqual([]);
    for (const a of args) expect(rotuloDeArg(a, undefined)).not.toMatch(/\b(Size|Semaforo|Peq)\b/);
  });
});
