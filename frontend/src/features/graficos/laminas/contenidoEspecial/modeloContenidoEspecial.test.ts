import { describe, expect, it } from "vitest";
import type { ArgMetadata, Slide, VarInfo } from "../../../../api/graficos";
import { contenidoEspecialDe, esArgEspecial, esArgFilas, iconoElegido, tituloPorDefecto } from "./modeloContenidoEspecial";

const arg = (name: string, tipo_input: ArgMetadata["tipo_input"]): ArgMetadata => ({ name, label: name, tipo_input, grupo: "textos" });
const variables = [{ name: "q1", label: "Satisfacción con el servicio (Recodificada)", source: "base" }] as unknown as (VarInfo & { source: string })[];
const unGrafico = (titulo: string, args: Record<string, unknown> | null): Slide => ({
  id: "s1", tipo: "p_slide_1_grafico",
  payload: { titulo, grafico: args ? { graficador: "p_barras_apiladas", args } : null },
});

describe("contenido especial (C38)", () => {
  it("las filas de la ficha técnica y el ícono tienen editor propio; los textos no", () => {
    expect(esArgFilas(arg("filas", "technical_rows"))).toBe(true);
    // La forma vieja: `filas` como texto, como la leía el editor anterior.
    expect(esArgFilas(arg("filas", "textarea"))).toBe(true);
    expect(esArgFilas(arg("texto", "textarea"))).toBe(false);
    expect(esArgEspecial(arg("icono", "icono"))).toBe(true);
    expect(esArgEspecial(arg("titulo", "string"))).toBe(false);
    const e = contenidoEspecialDe([arg("titulo", "string"), arg("icono", "icono"), arg("filas", "technical_rows")]);
    expect(e.filas.map((a) => a.name)).toEqual(["filas"]);
    expect(e.iconos.map((a) => a.name)).toEqual(["icono"]);
  });

  it("una lámina de población no ofrece ícono aunque el registro declare el campo", () => {
    const args = [arg("titulo", "string"), arg("icono", "icono")];
    expect(contenidoEspecialDe(args, "p_slide_1_poblacion").iconos).toEqual([]);
    expect(contenidoEspecialDe(args, "p_slide_3_poblacion_mapa").iconos).toEqual([]);
    expect(contenidoEspecialDe(args, "p_slide_objetivo_icono").iconos.map((a) => a.name)).toEqual(["icono"]);
  });

  it("el ícono guardado se resuelve contra los subidos y uno que ya no está se conserva", () => {
    const iconos = [{ id: "a", nombre: "Persona", file_id: "f1" }];
    expect(iconoElegido(null, iconos)).toEqual({ estado: "ninguno" });
    expect(iconoElegido("  ", iconos)).toEqual({ estado: "ninguno" });
    expect(iconoElegido("a", iconos)).toEqual({ estado: "subido", icono: iconos[0] });
    expect(iconoElegido("z", iconos)).toEqual({ estado: "desconocido", id: "z" });
  });
});

describe("título por defecto (C35)", () => {
  it("toma el nombre de la pregunta del gráfico con inferSlideVariableTitle", () => {
    const t = tituloPorDefecto(unGrafico("", { var: "base$q1" }), variables, "1 gráfico");
    expect(t.placeholder).toBe("Satisfacción con el servicio");
    expect(t.ayuda).toContain("«Satisfacción con el servicio»");
  });

  it("sin gráfico ni pregunta vuelve al nombre del tipo, sin ayuda", () => {
    expect(tituloPorDefecto(unGrafico("", null), variables, "1 gráfico")).toEqual({ placeholder: "1 gráfico", ayuda: null });
    const dos: Slide = { id: "s2", tipo: "p_slide_2_graficos", payload: { izquierda: { graficador: "p_barras_apiladas", args: { var: "base$q1" } } } };
    expect(tituloPorDefecto(dos, variables, "2 gráficos").placeholder).toBe("2 gráficos");
  });

  it("no depende del título escrito: es lo que sale cuando el campo queda vacío", () => {
    expect(tituloPorDefecto(unGrafico("Mi título", { var: "base$q1" }), variables, "1 gráfico").placeholder)
      .toBe("Satisfacción con el servicio");
  });
});
