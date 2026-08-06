import { describe, expect, it } from "vitest";
import {
  aFilasEditor,
  agruparPorBateria,
  asignarVariable,
  confirmarFila,
  filasParaGuardar,
  incorporarSugerencias,
  resumenEditor,
  variablesTomadas,
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

  it("las sugerencias no pisan lo ya decidido", () => {
    const filas = aFilasEditor([fila("Ya decidida", { docentes: "p13_1" })]);
    const out = incorporarSugerencias(filas, [
      // Choca en docentes: se descarta entera.
      fila("Propuesta que choca", { docentes: "p13_1", estudiantes: "p11_1" }),
      fila("Propuesta libre", { docentes: "p14_1", estudiantes: "p12_1" }),
    ]);

    expect(out).toHaveLength(2);
    expect(out[0].etiqueta_estandar).toBe("Ya decidida");
    expect(out[1].etiqueta_estandar).toBe("Propuesta libre");
    expect(out[1].sugerida).toBe(true);
  });

  it("una sugerencia que choca se descarta entera, no a medias", () => {
    // Aceptarla a medias produciría una fila que dice ser la misma pregunta en
    // dos públicos cuando el analista sólo confirmó uno, y eso no se ve.
    const filas = aFilasEditor([fila("Decidida", { estudiantes: "p11_1" })]);
    const out = incorporarSugerencias(filas, [
      fila("Choca en estudiantes", { docentes: "p13_1", estudiantes: "p11_1" }),
    ]);
    expect(out).toHaveLength(1);
    expect(variablesTomadas(out, "docentes").size).toBe(0);
  });

  it("dos sugerencias que comparten variable no entran ambas", () => {
    const out = incorporarSugerencias([], [
      fila("A", { docentes: "p13_1", estudiantes: "p11_1" }),
      fila("B", { docentes: "p13_1", estudiantes: "p12_1" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].etiqueta_estandar).toBe("A");
  });

  it("una sugerencia sin confirmar se guarda MARCADA, no se pierde", () => {
    // ADR 0064: la regla del 0062 —descartarla al guardar— destruía trabajo en
    // cuanto la plantilla empezó a sembrar propuestas: confirmar diez de
    // cincuenta y ocho y pulsar Guardar borraba las otras cuarenta y ocho. Lo
    // que se protege es que la propuesta no ACTÚE como decisión, y eso lo
    // garantizan el importador de etiquetas y el generador del mazo.
    const filas = incorporarSugerencias([], [fila("Propuesta", { docentes: "p13_1", estudiantes: "p11_1" })]);
    const pendientes = filasParaGuardar(filas);
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].sugerida).toBe(true);

    const confirmadas = confirmarFila(filas, filas[0].id);
    const guardadas = filasParaGuardar(confirmadas);
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0].cantidad).toBe(2);
    expect(guardadas[0].sugerida).toBe(false);
    // Y lo que viaja al backend no lleva la identidad de edición.
    expect("id" in guardadas[0]).toBe(false);
  });

  it("las filas sin variables no se guardan", () => {
    const filas = aFilasEditor([fila("Sin nada", {}), fila("Con algo", { docentes: "p13_1" })]);
    expect(filasParaGuardar(filas)).toHaveLength(1);
  });

  it("el resumen separa lo confirmado de lo propuesto", () => {
    const filas = incorporarSugerencias(
      aFilasEditor([
        fila("Con etiqueta", { docentes: "p13_1" }, { diapositiva: "3" }),
        fila("", { docentes: "p14_1" }),
      ]),
      [fila("Propuesta", { estudiantes: "p11_1", egresados: "p18_1" })],
    );
    const r = resumenEditor(filas);
    expect(r.total).toBe(3);
    expect(r.confirmadas).toBe(2);
    expect(r.sugeridas).toBe(1);
    expect(r.sinEtiqueta).toBe(1);
    expect(r.conDiapositiva).toBe(1);
  });
});

describe("agruparPorBateria", () => {
  const f = (etiqueta: string, variables: Record<string, string>, diapositiva = "") => ({
    seccion: "",
    etiqueta_estandar: etiqueta,
    variables,
    cantidad: Object.keys(variables).length,
    diapositiva,
  });

  it("junta los temas que comparten raíz en algún público", () => {
    const filas = aFilasEditor([
      f("Salud", { docentes: "p13_1", estudiantes: "p11_1" }),
      f("Bienestar", { docentes: "p13_2", estudiantes: "p11_2" }),
      // Sólo existe en estudiantes: nunca compartiría una firma de dos públicos
      // con sus hermanas, pero sí la raíz `p11` DENTRO de estudiantes. Es el caso
      // que obliga a unir por público y no por la tupla completa.
      f("Empleabilidad", { estudiantes: "p11_3" }),
      f("Otra cosa", { docentes: "p20", estudiantes: "p30" }),
    ]);

    const out = agruparPorBateria(filas);
    expect(out[0].diapositiva).toBe(out[1].diapositiva);
    expect(out[2].diapositiva).toBe(out[0].diapositiva);
    // Sin sufijo numérico no hay batería: va a su propia diapositiva.
    expect(out[3].diapositiva).not.toBe(out[0].diapositiva);
  });

  it("no reescribe una diapositiva ya asignada y continúa su numeración", () => {
    const filas = aFilasEditor([
      f("Ya puesta", { docentes: "p13_1" }, "7"),
      f("Sin poner", { docentes: "p20_1" }),
    ]);

    const out = agruparPorBateria(filas);
    // Una asignación del analista no la reescribe una heurística.
    expect(out[0].diapositiva).toBe("7");
    // Y la clave nueva continúa después de la mayor ya declarada, para no
    // chocar con el informe ni renumerarlo.
    expect(out[1].diapositiva).toBe("8");
  });
});
