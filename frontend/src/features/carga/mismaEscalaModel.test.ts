// F5: las filas «Misma escala» se confirman de una vez.
import { describe, expect, test } from "vitest";
import type { EquivalenciaFila, VariableDeBase } from "../../api/equivalencias";
import { aFilasEditor, asignarVariable } from "./equivalenciasEditorModel";
import {
  armonizacionDeMismaEscala,
  filasConMismaEscalaConfirmada,
  indicesDeMismaEscala,
  textoConfirmarMismaEscala,
} from "./mismaEscalaModel";
import { indicadorDeEscala } from "./preguntaEquivalenteModel";
import { nombreDeSerieDeBases } from "./nombreDeSerie";

const SI_NO = [
  { codigo: "1", etiqueta: "Sí" },
  { codigo: "2", etiqueta: "No" },
];
const v = (name: string, firma: string, opciones = SI_NO): VariableDeBase => ({
  name, label: name, seccion: "", firma, opciones,
});
const variablesPorBase: Record<string, VariableDeBase[]> = {
  b2024: [v("p1", "1=Sí|2=No"), v("p2", "1=Sí|2=No"), v("p3", "1=Sí|2=No"), v("p9", "")],
  b2025: [v("q1", "1=Sí|2=No", [{ codigo: "1", etiqueta: "SI" }, { codigo: "2", etiqueta: "NO" }]), v("q2", "1=Sí|2=No|9=NS"), v("q3", "1=Sí|2=No"), v("q9", "")],
};
const bases = ["b2024", "b2025"];
const fila = (etiqueta: string, variables: Record<string, string>, extra: Partial<EquivalenciaFila> = {}): EquivalenciaFila => ({
  seccion: "", etiqueta_estandar: etiqueta, variables, cantidad: Object.keys(variables).length, ...extra,
});

const GUARDADAS: EquivalenciaFila[] = [
  fila("Misma", { b2024: "p1", b2025: "q1" }),
  fila("Distintas", { b2024: "p2", b2025: "q2" }),
  fila("Ya armonizada", { b2024: "p3", b2025: "q3" }, {
    armonizacion: { escala: SI_NO, por_base: { b2024: { comparable: true, mapa: {} } } },
  }),
  fila("Sin lista", { b2024: "p9", b2025: "q9" }),
  fila("Una sola base", { b2024: "p3" }),
  fila("Heredada", { b2024: "p1", b2025: "q3" }, { sugerida: true }),
  // Un indicador compuesto (ADR 0105) nunca se confirma como «misma escala»:
  // sus variables son expresiones, y su escala Sí/No ya viene declarada.
  fila("Compuesta", { b2024: "p1", b2025: "q1" }, {
    derivada: {
      regla: "alguna",
      por_base: { b2024: { variables: ["p1"], codigos: ["1"] }, b2025: { variables: ["q1"], codigos: ["1"] } },
    },
  }),
];

describe("filas de misma escala", () => {
  test("cuenta exactamente las que la tabla pinta «Misma escala» y no tienen armonización", () => {
    const serie = nombreDeSerieDeBases(bases);
    const pintadas = GUARDADAS
      .map((f, i) => [i, indicadorDeEscala(f, bases, variablesPorBase, serie).texto] as const)
      .filter(([i, t]) => t === "Misma escala" && !GUARDADAS[i].armonizacion && !GUARDADAS[i].sugerida && !GUARDADAS[i].derivada)
      .map(([i]) => i);
    expect(indicesDeMismaEscala(GUARDADAS, null, bases, variablesPorBase)).toEqual(pintadas);
    expect(pintadas).toEqual([0]);
  });

  test("la armonización es identidad con la lista de la primera base de la serie", () => {
    expect(armonizacionDeMismaEscala(GUARDADAS[0], bases, variablesPorBase)).toEqual({
      escala: SI_NO,
      por_base: { b2024: { comparable: true, mapa: {} }, b2025: { comparable: true, mapa: {} } },
    });
    // La serie manda: con 2025 primero, la escala es la de 2025.
    expect(armonizacionDeMismaEscala(GUARDADAS[0], ["b2025", "b2024"], variablesPorBase)?.escala).toEqual([
      { codigo: "1", etiqueta: "SI" },
      { codigo: "2", etiqueta: "NO" },
    ]);
  });

  test("confirmar sólo toca esas filas; las demás viajan como estaban", () => {
    const out = filasConMismaEscalaConfirmada(GUARDADAS, [0], bases, variablesPorBase);
    expect(out[0].armonizacion?.escala).toEqual(SI_NO);
    out.slice(1).forEach((f, i) => expect(f).toBe(GUARDADAS[i + 1]));
  });

  test("una fila con variables cambiadas sin guardar queda fuera", () => {
    const editor = aFilasEditor(GUARDADAS);
    expect(indicesDeMismaEscala(GUARDADAS, editor, bases, variablesPorBase)).toEqual([0]);
    const editada = asignarVariable(editor, editor[0].id, "b2025", "q3");
    expect(indicesDeMismaEscala(GUARDADAS, editada, bases, variablesPorBase)).toEqual([]);
    // Quitada sin guardar: tampoco.
    expect(indicesDeMismaEscala(GUARDADAS, editor.slice(1), bases, variablesPorBase)).toEqual([]);
  });

  test("texto del botón", () => {
    expect(textoConfirmarMismaEscala(1)).toBe("Confirmar 1 de misma escala");
    expect(textoConfirmarMismaEscala(12)).toBe("Confirmar las 12 de misma escala");
  });
});
