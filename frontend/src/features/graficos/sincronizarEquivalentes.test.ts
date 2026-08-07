import { describe, expect, it } from "vitest";
import { sincronizarEquivalentes } from "./sincronizarEquivalentes";
import type { PlanJson, Slide } from "../../api/graficos";

const manual = (id: string): Slide => ({
  id,
  tipo: "p_slide_1_grafico",
  payload: { titulo: id },
});

const derivada = (id: string): Slide => ({
  id,
  tipo: "p_slide_1_grafico",
  payload: { titulo: id },
  origen: "equivalencias",
});

const plan = (...slides: Slide[]): PlanJson => ({ slides });

describe("sincronizarEquivalentes", () => {
  it("no toca las diapositivas hechas a mano", () => {
    // El caso que motiva todo esto: el perfil sociodemográfico por actor se arma
    // a mano y no puede desaparecer porque cambió la matriz.
    const actual = plan(manual("portada"), derivada("s-equiv-1"), manual("perfil"));

    const out = sincronizarEquivalentes(actual, [derivada("s-equiv-1"), derivada("s-equiv-2")]);

    expect(out.plan.slides.map((s) => s.id)).toEqual([
      "portada", "s-equiv-1", "s-equiv-2", "perfil",
    ]);
    expect(out.conservadas).toBe(2);
    expect(out.reemplazadas).toBe(1);
    expect(out.nuevas).toBe(2);
  });

  it("no duplica al regenerar dos veces", () => {
    // «Añadir» concatenaba: regenerar dejaba el bloque dos veces en el mazo.
    const derivadas = [derivada("s-equiv-1"), derivada("s-equiv-2")];
    const una = sincronizarEquivalentes(plan(manual("portada")), derivadas);
    const dos = sincronizarEquivalentes(una.plan, derivadas);

    expect(dos.plan.slides.map((s) => s.id)).toEqual(["portada", "s-equiv-1", "s-equiv-2"]);
  });

  it("reinserta el bloque donde estaba, no al final", () => {
    // Un mazo que abre con las comparaciones no puede acabar con ellas detrás de
    // los anexos sólo por haber regenerado.
    const actual = plan(derivada("s-equiv-1"), manual("anexo-a"), manual("anexo-b"));

    const out = sincronizarEquivalentes(actual, [derivada("s-equiv-9")]);

    expect(out.plan.slides.map((s) => s.id)).toEqual(["s-equiv-9", "anexo-a", "anexo-b"]);
  });

  it("retira las derivadas que la matriz ya no produce", () => {
    const actual = plan(derivada("s-equiv-1"), derivada("s-equiv-2"), manual("cierre"));

    const out = sincronizarEquivalentes(actual, [derivada("s-equiv-1")]);

    expect(out.plan.slides.map((s) => s.id)).toEqual(["s-equiv-1", "cierre"]);
    expect(out.reemplazadas).toBe(2);
    expect(out.nuevas).toBe(1);
  });

  it("sin bloque previo, entra al final", () => {
    const out = sincronizarEquivalentes(plan(manual("portada")), [derivada("s-equiv-1")]);
    expect(out.plan.slides.map((s) => s.id)).toEqual(["portada", "s-equiv-1"]);
    expect(out.reemplazadas).toBe(0);
  });

  it("marca como derivada toda diapositiva que entra en el bloque", () => {
    // Aunque el backend no la marcara, al entrar por esta vía queda marcada: es
    // lo que permite volver a encontrarla en la siguiente regeneración.
    const sinMarca: Slide = { id: "s-equiv-1", tipo: "p_slide_1_grafico", payload: {} };
    const out = sincronizarEquivalentes(plan(), [sinMarca]);
    expect(out.plan.slides[0].origen).toBe("equivalencias");
  });
});
