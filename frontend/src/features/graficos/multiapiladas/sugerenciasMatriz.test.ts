import { describe, expect, it } from "vitest";
import type { VarWithSource } from "../useVariables";
import { aplicablesEnLote, filaMinima, fuentesDeMatriz, sugerenciasDeTema, SIN_MATRIZ } from "./sugerenciasMatriz";
import type { TemaPublicos } from "./temasPublicos";

const pubs = ["docentes", "administrativos", "estudiantes"];
const v = (source: string, name: string, scale_signature: string) =>
  ({ source, name, label: `Etiqueta ${name}`, tipo: "select_one", seccion: "", scale_signature }) as VarWithSource;
const vars = [
  v("docentes", "p12_1", "sat5"),
  v("administrativos", "p10_1", "sat5"),
  v("estudiantes", "p11_1", "sat4"),
  v("estudiantes", "p11_9", "sat5"),
];
const tema: TemaPublicos = { key: "tema_1", title: "", vars: ["docentes$p12_1"] };

describe("la matriz sugiere, la lámina decide (P20)", () => {
  it("una fila confirmada sugiere y marca la escala distinta", () => {
    const fuentes = fuentesDeMatriz(
      [{ seccion: "S", etiqueta_estandar: "Servicio de salud", variables: { docentes: "p12_1", administrativos: "p10_1", estudiantes: "p11_1" } }],
    );
    const s = sugerenciasDeTema(tema, pubs, vars, fuentes);
    expect(s.docentes).toBeUndefined();
    expect(s.administrativos).toEqual({ ref: "administrativos$p10_1", etiquetaEstandar: "Servicio de salud", otraEscala: false });
    expect(s.estudiantes).toMatchObject({ ref: "estudiantes$p11_1", otraEscala: true });
    // Sólo la de la misma escala entra en lote.
    expect(aplicablesEnLote(s).map((x) => x.ref)).toEqual(["administrativos$p10_1"]);
  });

  it("ADR 0104: una fila `sugerida` que nadie confirmó no sugiere nada; sólo la confirmada", () => {
    const fuentes = fuentesDeMatriz([
      { etiqueta_estandar: "Propuesta", variables: { docentes: "p12_1", administrativos: "p10_1" }, sugerida: true },
      { etiqueta_estandar: "Confirmada", variables: { docentes: "p12_1", estudiantes: "p11_9" } },
    ]);
    expect(fuentes.confirmadas.map((f) => f.etiqueta_estandar)).toEqual(["Confirmada"]);
    const s = sugerenciasDeTema(tema, pubs, vars, fuentes);
    expect(s.administrativos).toBeUndefined();
    expect(s.estudiantes).toEqual({ ref: "estudiantes$p11_9", etiquetaEstandar: "Confirmada", otraEscala: false });
    expect(aplicablesEnLote(s).map((x) => x.ref)).toEqual(["estudiantes$p11_9"]);
    // Sin ninguna confirmada, ninguna sugerencia.
    expect(sugerenciasDeTema(tema, pubs, vars, fuentesDeMatriz([
      { etiqueta_estandar: "Propuesta", variables: { docentes: "p12_1", administrativos: "p10_1" }, sugerida: true },
    ]))).toEqual({});
  });

  it("nunca sugiere una variable que el builder no tiene, ni rellena una línea ocupada, ni inventa sin ancla", () => {
    const fuentes = fuentesDeMatriz([{ etiqueta_estandar: "X", variables: { docentes: "p12_1", administrativos: "no_existe", estudiantes: "p11_1" } }]);
    const ocupado: TemaPublicos = { ...tema, vars: ["docentes$p12_1", "estudiantes$p11_9"] };
    const s = sugerenciasDeTema(ocupado, pubs, vars, fuentes);
    expect(s).toEqual({});
    expect(sugerenciasDeTema({ ...tema, vars: [] }, pubs, vars, fuentes)).toEqual({});
    expect(sugerenciasDeTema(tema, pubs, vars, SIN_MATRIZ)).toEqual({});
  });

  it("la fila cruda se normaliza: textos de R como arreglos, filas de un solo público fuera", () => {
    expect(filaMinima({ etiqueta_estandar: ["Salud"], variables: { docentes: ["p12_1"], estudiantes: "p11_1" }, sugerida: [true] }))
      .toMatchObject({ etiqueta_estandar: "Salud", variables: { docentes: "p12_1", estudiantes: "p11_1" }, sugerida: true });
    expect(filaMinima({ variables: { docentes: "p12_1" } })).toBeNull();
    expect(filaMinima("basura")).toBeNull();
  });
});
