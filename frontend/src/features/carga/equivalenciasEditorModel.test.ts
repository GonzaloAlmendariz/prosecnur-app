import { describe, expect, it } from "vitest";
import * as modelo from "./equivalenciasEditorModel";
import {
  aFilasEditor,
  asignarPregunta,
  asignarVariable,
  confirmarFila,
  filaVacia,
  filasParaGuardar,
  resumenEditor,
  variablesTomadas,
  ordenarBasesPorSerie,
} from "./equivalenciasEditorModel";
import type { EquivalenciaFila } from "../../api/equivalencias";

const fila = (
  etiqueta: string,
  variables: Record<string, string>,
  extra: Partial<EquivalenciaFila> = {},
): EquivalenciaFila => ({
  seccion: "Servicios",
  etiqueta_estandar: etiqueta,
  variables,
  cantidad: Object.keys(variables).length,
  ...extra,
});

describe("editor de equivalencias", () => {
  it("una variable no puede estar en dos filas a la vez", () => {
    // Si `p13_1` de docentes quedara en dos filas, la app diría que esa pregunta
    // es dos preguntas distintas, y el conteo por público —y el gráfico que
    // salga de él— quedaría mal sin ninguna señal en pantalla.
    const filas = aFilasEditor([
      fila("¿Conoce salud?", { docentes: "p13_1" }),
      fila("¿Ha utilizado salud?", { docentes: "p14_1" }),
    ]);
    const out = asignarVariable(filas, filas[1].id, "docentes", "p13_1");

    expect(out[0].variables.docentes).toBeUndefined();
    expect(out[1].variables.docentes).toBe("p13_1");
    expect(out[0].cantidad).toBe(0);
    expect(out[1].cantidad).toBe(1);
  });

  it("asignar vacío libera la variable", () => {
    const filas = aFilasEditor([fila("X", { docentes: "p13_1", estudiantes: "p11_1" })]);
    const out = asignarVariable(filas, filas[0].id, "docentes", "");
    expect(out[0].variables).toEqual({ estudiantes: "p11_1" });
    expect(variablesTomadas(out, "docentes").size).toBe(0);
  });

  it("al elegir la primera pregunta, la fila sin nombre toma su etiqueta; un nombre escrito no se pisa (ADR 0104)", () => {
    const filas = [filaVacia()];
    const una = asignarPregunta(filas, filas[0].id, "docentes", "p13_1", "¿Conoce el servicio de salud?");
    expect(una[0].etiqueta_estandar).toBe("¿Conoce el servicio de salud?");
    expect(una[0].variables).toEqual({ docentes: "p13_1" });

    // La segunda base no renombra: el nombre ya existe.
    const dos = asignarPregunta(una, filas[0].id, "estudiantes", "p11_1", "¿Sabe que existe salud?");
    expect(dos[0].etiqueta_estandar).toBe("¿Conoce el servicio de salud?");
    expect(dos[0].cantidad).toBe(2);

    // Quitar una pregunta no inventa nombre, y una pregunta sin etiqueta tampoco.
    const vacia = [filaVacia()];
    expect(asignarPregunta(vacia, vacia[0].id, "docentes", "", "X")[0].etiqueta_estandar).toBe("");
    expect(asignarPregunta(vacia, vacia[0].id, "docentes", "p9", "  ")[0].etiqueta_estandar).toBe("");
  });

  it("asignarPregunta conserva la regla de una variable en una sola fila", () => {
    const filas = aFilasEditor([fila("A", { docentes: "p13_1" }), fila("", {})]);
    const out = asignarPregunta(filas, filas[1].id, "docentes", "p13_1", "Salud");
    expect(out[0].variables.docentes).toBeUndefined();
    expect(out[1]).toMatchObject({ etiqueta_estandar: "Salud", variables: { docentes: "p13_1" } });
  });

  it("ADR 0104: el editor ya no incorpora propuestas automáticas ni confirma en bloque", () => {
    expect("incorporarSugerencias" in modelo).toBe(false);
    expect("confirmarTodas" in modelo).toBe(false);
  });

  it("una propuesta heredada sin confirmar se guarda MARCADA, no se pierde, y se confirma de una en una", () => {
    // ADR 0064 y ADR 0104 §5: lo que un .pulso anterior traía como propuesta no
    // se descarta al guardar ni actúa como decisión hasta que alguien la confirma.
    const filas = aFilasEditor([
      fila("Propuesta", { docentes: "p13_1", estudiantes: "p11_1" }, { sugerida: true }),
      fila("Otra propuesta", { docentes: "p14_1", estudiantes: "p12_1" }, { sugerida: true }),
    ]);
    const pendientes = filasParaGuardar(filas);
    expect(pendientes).toHaveLength(2);
    expect(pendientes.every((f) => f.sugerida === true)).toBe(true);

    const confirmadas = confirmarFila(filas, filas[0].id);
    const guardadas = filasParaGuardar(confirmadas);
    expect(guardadas[0].cantidad).toBe(2);
    expect(guardadas[0].sugerida).toBe(false);
    // La otra sigue sin confirmar: no hay confirmación en bloque.
    expect(guardadas[1].sugerida).toBe(true);
    // Y lo que viaja al backend no lleva la identidad de edición.
    expect("id" in guardadas[0]).toBe(false);
  });

  it("las filas sin variables no se guardan", () => {
    const filas = aFilasEditor([fila("Sin nada", {}), fila("Con algo", { docentes: "p13_1" })]);
    expect(filasParaGuardar(filas)).toHaveLength(1);
  });

  it("el resumen separa lo confirmado de lo heredado sin confirmar", () => {
    const filas = aFilasEditor([
      fila("Con etiqueta", { docentes: "p13_1" }),
      fila("", { docentes: "p14_1" }),
      fila("Propuesta", { estudiantes: "p11_1", egresados: "p18_1" }, { sugerida: true }),
    ]);
    const r = resumenEditor(filas);
    expect(r.total).toBe(3);
    expect(r.confirmadas).toBe(2);
    expect(r.sugeridas).toBe(1);
    expect(r.sinEtiqueta).toBe(1);
  });
});

describe("sección legible", () => {
  it("«Pag2» de SurveyMonkey se lee como página del formulario; una sección real queda igual", async () => {
    const { seccionLegible } = await import("./equivalenciasEditorModel");
    expect(seccionLegible("Pag2")).toBe("Página 2 del formulario");
    expect(seccionLegible("pag 12")).toBe("Página 12 del formulario");
    expect(seccionLegible("Características institucionales")).toBe("Características institucionales");
    expect(seccionLegible(null)).toBe("");
  });
});

describe("ordenarBasesPorSerie", () => {
  it("sigue armonizacion_periodos cuando existe", () => {
    expect(ordenarBasesPorSerie(["b2026", "b2024", "b2025"], ["b2024", "b2025", "b2026"]))
      .toEqual(["b2024", "b2025", "b2026"]);
  });

  it("deja al final las bases fuera de la serie e ignora periodos sin base", () => {
    expect(ordenarBasesPorSerie(["extra", "b2026", "b2024"], ["b2024", "fantasma", "b2026"]))
      .toEqual(["b2024", "b2026", "extra"]);
  });

  it("sin serie conserva el orden actual", () => {
    expect(ordenarBasesPorSerie(["b2026", "b2024"], undefined)).toEqual(["b2026", "b2024"]);
    expect(ordenarBasesPorSerie(["b2026", "b2024"], [])).toEqual(["b2026", "b2024"]);
  });
});
