import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AulasAvanceProyectado } from "./AulasAvanceProyectado";

/**
 * «Lo previsto» tiene dos fuentes que no valen lo mismo, y el motor lo dice por
 * escrito: `mujeres_esperadas`/`hombres_esperados` de la hoja de control es el
 * dato directo; repartir `expected_valid` por `sex_top_*` es una DERIVACIÓN que
 * «asume que la tasa de efectividad no depende del sexo».
 *
 * Ese supuesto es justo lo que la calibración existe para poner a prueba —en
 * 2025 la composición lograda se fue +3,4 pp hacia mujeres—, y por eso el motor
 * hace viajar `previsto_origen`: «quien lea tiene que poder saberlo».
 *
 * Llegaba al normalizador del frontend y ahí se quedaba. Medido el 2026-08-30:
 * 30 de 30 celdas con `composicion_del_aula` y ni una palabra en pantalla.
 */
const celda = (origen: string) => ({
  faculty: "EDUCACION", sex: "F", cuota: 20, logrado: 32, previsto: 25.7,
  proyeccion: 32, brecha: 0, estado: "asegurada", etiqueta: "Va a llegar, con margen",
  previsto_origen: origen, prob_cierre: 0.9, dispersion: 1.2, dispersion_n: 152,
}) as never;

describe("el panel dice de dónde sale «lo previsto»", () => {
  it("con todo derivado lo declara y nombra el supuesto", () => {
    const html = renderToStaticMarkup(<AulasAvanceProyectado celdas={[celda("composicion_del_aula")]} />);
    expect(html).toContain("composición de sus elegibles");
    expect(html).toContain("supone que la efectividad no depende del sexo");
  });

  it("con las dos fuentes conviviendo dice cuántas son de cada una", () => {
    const html = renderToStaticMarkup(
      <AulasAvanceProyectado celdas={[celda("composicion_del_aula"), celda("hoja_de_control")]} />,
    );
    expect(html).toContain("1 de 2 grupos");
  });

  it("si nada se deriva no dice nada: el aviso es sobre la derivación", () => {
    const html = renderToStaticMarkup(<AulasAvanceProyectado celdas={[celda("hoja_de_control")]} />);
    expect(html).not.toContain("composición de sus elegibles");
  });
});
