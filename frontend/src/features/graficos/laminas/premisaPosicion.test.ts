// «Enunciado de cada barra» (`premisa_posicion` de p_barras_multiapiladas, v7.25 ítem 4) en la tarjeta del gráfico.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../../api/graficos";
import { camposDeDatos } from "./argsDatosGrafico";
import { grupoDeCampo } from "./gruposTarjeta";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const registro = fs.readFileSync(path.join(RAIZ, "api/R/graficos_metadata.R"), "utf8");

// Copia del registro (graficos_metadata.R, p_barras_multiapiladas); el último test comprueba que siga así.
const premisa: ArgMetadata = {
  name: "premisa_posicion", label: "Enunciado de cada barra", tipo_input: "choice", grupo: "valores", default: "auto",
  descripcion: "Dónde va el enunciado de cada barra en la lámina.",
  choices: [
    { value: "auto", label: "Automático" },
    { value: "arriba", label: "Encima de la barra" },
    { value: "izquierda", label: "A la izquierda" },
  ],
};
const nombres = (valores: Record<string, unknown>, g = "p_barras_multiapiladas") => camposDeDatos([premisa], valores, g).map((c) => c.arg.name);

describe("«Enunciado de cada barra» en la multiapilada", () => {
  it("sale como selector de tres opciones, en «Categorías y orden», sin palabras técnicas", () => {
    const [c] = camposDeDatos([premisa], { modo: "var", vars: ["e$p1", "e$p2"] }, "p_barras_multiapiladas");
    expect(c).toMatchObject({ rotulo: "Enunciado de cada barra", control: "opciones" });
    expect(c.opciones.map((o) => o.value)).toEqual(["auto", "arriba", "izquierda"]);
    expect(grupoDeCampo("premisa_posicion")).toBe("orden");
    expect(`${c.rotulo} ${c.ayuda}`).not.toMatch(/premisa|canvas|[;·—]/i);
  });
  it("en una batería y en una pregunta por grupos, sí; con públicos o grupos dentro del tema, no (la lámina no lo aplica)", () => {
    expect(nombres({ modo: "var", vars: ["e$p1", "e$p2"] })).toEqual(["premisa_posicion"]);
    expect(nombres({ modo: "cruce", var: "e$p1", cruces: "e$sexo" })).toEqual(["premisa_posicion"]);
    expect(nombres({ modo: "var_cruce", vars: ["e$p1"], cruces: "e$sexo" })).toEqual([]);
    expect(nombres({ modo: "var", vars: { t1: ["docentes$p1", "estudiantes$p1"] } })).toEqual([]);
  });
  it("sólo en la multiapilada", () => {
    expect(nombres({}, "p_barras_apiladas")).toEqual([]);
    expect(nombres({}, "p_barras_agrupadas")).toEqual([]);
  });
  it("el registro R lo declara en la multiapilada con las mismas opciones y el constructor lo acepta", () => {
    const bloque = registro.slice(registro.indexOf("p_barras_multiapiladas = list("), registro.indexOf("p_nube_palabras = list("));
    expect(bloque).toMatch(/name = "premisa_posicion", label = "Enunciado de cada barra", tipo_input = "choice"[^\n]*default = "auto"/);
    for (const v of ["auto", "arriba", "izquierda"]) expect(bloque).toContain(`value = "${v}"`);
    const constructor = fs.readFileSync(path.join(RAIZ, "api/R/reporte_plan_slides.R"), "utf8");
    expect(constructor).toMatch(/\.ppt_slot_override\(overrides, "premisa_posicion", premisa_posicion, "opcion", opciones = c\("auto", "arriba", "izquierda"\)\)/);
  });
});
