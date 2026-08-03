import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConfirmadorCriterio } from "../ConfirmadorCriterio";
import { ControlRango, ordenarRango } from "../ControlRango";
import { estadosCascada } from "../usarEmbudoVivo";

/**
 * F121 · Las tres piezas del embudo vivo, con las decisiones de Gonzalo:
 * orden del ADR, rango de dos manijas, y confirmación por criterio.
 */
describe("ControlRango · dos manijas", () => {
  const render = (over: Partial<Parameters<typeof ControlRango>[0]> = {}) =>
    renderToStaticMarkup(
      <ControlRango desde={3} hasta={7} min={1} max={10} etiqueta="Nivel del curso" onCambio={() => {}} {...over} />,
    );

  it("cada manija es un control nativo, no un dibujo", () => {
    // Un deslizador hecho con `pointerdown` se ve igual y no se opera con
    // teclado ni lo anuncia un lector de pantalla.
    const html = render();
    expect((html.match(/type="range"/g) ?? []).length).toBe(2);
    expect(html).toContain('aria-label="Nivel del curso — desde"');
    expect(html).toContain('aria-label="Nivel del curso — hasta"');
  });

  it("la banda dibuja el tramo entre las dos manijas", () => {
    // 3 y 7 sobre 1..10 → de 22,2% a 66,7%, ancho 44,4%.
    const html = render();
    const banda = /class="cmv2-rango-banda" style="left:([\d.]+)%;width:([\d.]+)%"/.exec(html);
    expect(banda).not.toBeNull();
    expect(Number(banda![1])).toBeCloseTo(22.2, 0);
    expect(Number(banda![2])).toBeCloseTo(44.4, 0);
  });

  it("los campos exactos acompañan a las manijas", () => {
    // El deslizador busca, el campo fija — y con dos cortes hacen falta dos.
    const html = render();
    expect((html.match(/type="number"/g) ?? []).length).toBe(2);
  });

  it("cruzar las manijas las intercambia, no las bloquea", () => {
    // Bloquear obliga a soltar, mover la otra y volver; intercambiar hace lo que
    // la mano pedía. Estaba documentado y SIN PRUEBA: una mutación que lo quitó
    // no rompía nada, que es la definición de comportamiento no cubierto.
    expect(ordenarRango(8, 3, 1, 10)).toEqual({ desde: 3, hasta: 8 });
    expect(ordenarRango(3, 8, 1, 10)).toEqual({ desde: 3, hasta: 8 });
  });

  it("el tramo se acota al rango por los dos extremos", () => {
    expect(ordenarRango(-5, 99, 1, 10)).toEqual({ desde: 1, hasta: 10 });
  });

  it("un tramo degenerado no rompe la banda", () => {
    const html = render({ desde: 5, hasta: 5 });
    const banda = /class="cmv2-rango-banda" style="left:[\d.]+%;width:([\d.]+)%"/.exec(html);
    expect(Number(banda![1])).toBe(0);
  });
});

describe("ConfirmadorCriterio", () => {
  it("al día no pide nada", () => {
    const html = renderToStaticMarkup(
      <ConfirmadorCriterio estado="al-dia" onConfirmar={() => {}} />,
    );
    expect(html).toContain("Al día");
    expect(html).not.toContain("<button");
  });

  it("pendiente dice qué está en juego, no sólo que hay cambios", () => {
    // Sin esto, «confirmar» parece un trámite. Lo que hay en juego es que los
    // criterios siguientes no pueden recalcularse.
    const html = renderToStaticMarkup(
      <ConfirmadorCriterio estado="pendiente" cambios={2} enEspera={3} onConfirmar={() => {}} />,
    );
    expect(html).toContain("2 cambios sin confirmar");
    expect(html).toContain("3 criterios quedan en espera");
  });

  it("un solo cambio y un solo criterio concuerdan en singular", () => {
    const html = renderToStaticMarkup(
      <ConfirmadorCriterio estado="pendiente" cambios={1} enEspera={1} onConfirmar={() => {}} />,
    );
    expect(html).toContain("1 cambio sin confirmar");
    expect(html).toContain("1 criterio queda en espera");
  });

  it("confirmando bloquea los dos botones, no sólo el de confirmar", () => {
    const html = renderToStaticMarkup(
      <ConfirmadorCriterio estado="confirmando" cambios={1} onConfirmar={() => {}} onDescartar={() => {}} />,
    );
    expect((html.match(/disabled=""/g) ?? []).length).toBe(2);
  });
});

describe("estadosCascada · el orden es el del ADR", () => {
  it("lo anterior al que se edita está confirmado; lo posterior, en espera", () => {
    // Gonzalo: «mantén el orden del ADR». No se reordena, así que la cascada
    // tiene exactamente tres tramos y no hay un cuarto caso.
    expect(estadosCascada(5, 2)).toEqual([
      "confirmado", "confirmado", "editando", "espera", "espera",
    ]);
  });

  it("sin nada en edición, todo está confirmado", () => {
    expect(estadosCascada(3, null)).toEqual(["confirmado", "confirmado", "confirmado"]);
  });

  it("editar el primero deja a todos los demás en espera", () => {
    expect(estadosCascada(3, 0)).toEqual(["editando", "espera", "espera"]);
  });
});
