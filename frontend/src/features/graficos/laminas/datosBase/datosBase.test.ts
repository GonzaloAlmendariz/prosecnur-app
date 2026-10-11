import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../../../api/graficos";
import { camposDeDatos } from "../argsDatosGrafico";
import { NOTA_BASE_COMPARTIDO, faltaBaseEnCompartido } from "./baseEnCompartido";
import { patchNombreDeBase } from "./nombresPorBaseModel";

// Firma de p_radar en el registro (graficos_metadata.R): `tabla_encabezados` es `base_labels` y sólo aplica al modo
// «Los públicos del estudio».
const publicos = { arg: "modo", valores: ["publicos"] };
const radar: ArgMetadata[] = [
  { name: "modo", label: "modo", tipo_input: "choice", grupo: "datos", choices: [{ value: "sm", label: "sm" }, { value: "publicos", label: "p" }] },
  { name: "var", label: "var", tipo_input: "variable_opt", grupo: "datos", depende: { arg: "modo", valores: ["sm"] } },
  { name: "corte", label: "corte", tipo_input: "codigos_list", grupo: "datos", depende: publicos },
  { name: "tabla_encabezados", label: "Nombres de las columnas", tipo_input: "base_labels", grupo: "datos", depende: publicos },
];

describe("nombres por base (C44)", () => {
  it("aparece en el radar entre públicos, con su rótulo", () => {
    const campo = camposDeDatos(radar, { modo: "publicos" }).find((c) => c.arg.name === "tabla_encabezados");
    expect(campo?.control).toBe("nombres_base");
    expect(campo?.rotulo).toBe("Nombre de cada público");
  });
  it("no aparece en un gráfico que no es multibase: otro modo, modo sin elegir u otro graficador", () => {
    const nombres = (args: ArgMetadata[], v: Record<string, unknown>) => camposDeDatos(args, v).map((c) => c.arg.name);
    expect(nombres(radar, { modo: "sm" })).not.toContain("tabla_encabezados");
    expect(nombres(radar, {})).not.toContain("tabla_encabezados");
    expect(nombres(radar.filter((a) => a.name !== "tabla_encabezados"), { modo: "publicos" })).not.toContain("tabla_encabezados");
  });
  it("los campos de otro modo se esconden, como en el Editor anterior", () => {
    expect(camposDeDatos(radar, { modo: "publicos" }).map((c) => c.arg.name)).toEqual(["modo", "corte", "tabla_encabezados"]);
    expect(camposDeDatos(radar, { modo: "sm" }).map((c) => c.arg.name)).toEqual(["var", "modo"]);
  });
  it("«Base del gráfico» (base_config) no se dibuja: el catálogo no la sirve a la UI", () => {
    const base: ArgMetadata = { name: "base", label: "Base del gráfico", tipo_input: "base_config", grupo: "textos" };
    expect(camposDeDatos([...radar, base], { modo: "publicos" }).map((c) => c.arg.name)).not.toContain("base");
  });
  it("el nombre de una base se escribe en los args, en el formato `clave=Título` del Editor anterior", () => {
    const bases = ["docentes", "egresados"];
    expect(patchNombreDeBase("tabla_encabezados", "", bases, "egresados", " Egresados ")).toEqual({ tabla_encabezados: "egresados=Egresados" });
    expect(patchNombreDeBase("tabla_encabezados", "egresados=Egresados", bases, "docentes", "Docentes"))
      .toEqual({ tabla_encabezados: "docentes=Docentes\negresados=Egresados" });
    expect(patchNombreDeBase("tabla_encabezados", "docentes=Docentes", bases, "docentes", "")).toEqual({ tabla_encabezados: "" });
  });
});

describe("variable sin base en el informe compartido (H9)", () => {
  it("avisa sólo en el compartido y sólo si la ref no trae base", () => {
    expect(faltaBaseEnCompartido("p7", "consolidated")).toBe(true);
    expect(faltaBaseEnCompartido("docentes$p7", "consolidated")).toBe(false);
    expect(faltaBaseEnCompartido("p7", "active")).toBe(false);
    expect(faltaBaseEnCompartido("  ", "consolidated")).toBe(false);
    expect(NOTA_BASE_COMPARTIDO).toBe("En el informe compartido elige la base de esta variable.");
  });
});
