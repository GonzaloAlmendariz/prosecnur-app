/**
 * El rendimiento de la agenda: agendadas por aula aplicada.
 *
 * Es el número con el que se decide cuán profunda tiene que ser la cadena de
 * reemplazos. La tarjeta mostraba los tres conteos crudos y obligaba a dividir
 * a mano — y así fue como en este mismo loop se comparó mal la cadena de un
 * diseño de 30 titulares (360 agendadas) contra las 1.012 de 2025, que son
 * agendadas de un estudio con 194 aulas aplicadas.
 */
import { describe, expect, it } from "vitest";
import { rendimientoAgenda } from "../rendimientoAgendaModel";

describe("rendimientoAgenda", () => {
  it("con las cifras reales de 2025 da 5,2 agendadas por aplicada", () => {
    const r = rendimientoAgenda(1012, 194);
    expect(r?.porAplicada).toBeCloseTo(5.216, 3);
    expect(r?.tasaAplicacion).toBeCloseTo(0.1917, 4);
  });

  it("sin aplicadas no hay rendimiento", () => {
    // Dividir por cero daría infinito y "infinitas agendadas por aplicada" es
    // peor que callarse: afirma un rendimiento catastrófico donde sólo hay
    // ausencia de medición.
    expect(rendimientoAgenda(1012, 0)).toBeNull();
    expect(rendimientoAgenda(0, 0)).toBeNull();
  });

  it("no publica un rendimiento menor que 1 cuando la fuente se contradice", () => {
    // Más aplicadas que agendadas es imposible, y el cociente se leería como
    // "sobran aulas". No es hipotético: la referencia de 2025 se declara
    // verificada:false con 21 registros inconsistentes de 194.
    expect(rendimientoAgenda(100, 194)).toBeNull();
  });

  it("sin cifras no inventa", () => {
    expect(rendimientoAgenda(null, 194)).toBeNull();
    expect(rendimientoAgenda(1012, undefined)).toBeNull();
    expect(rendimientoAgenda(Number.NaN, 194)).toBeNull();
  });

  it("una agenda sin pérdidas da exactamente 1", () => {
    const r = rendimientoAgenda(194, 194);
    expect(r?.porAplicada).toBe(1);
    expect(r?.tasaAplicacion).toBe(1);
  });
});
