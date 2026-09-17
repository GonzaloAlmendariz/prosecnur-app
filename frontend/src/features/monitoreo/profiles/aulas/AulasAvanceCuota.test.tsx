import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasAvanceCuota } from "./AulasAvanceCuota";
import type { VistaDeAvanceCuota } from "./avanceCuota";

/**
 * Desde que la brecha suma los grupos de facultad y sexo en vez de restar el
 * total, la cabecera puede publicar a la vez un avance por encima de 100 y una
 * cifra por recoger. Las dos son ciertas y quien no diseñó el estudio lee una
 * contradicción, así que la pantalla tiene que decir la causa.
 */
const vista = (over: Partial<VistaDeAvanceCuota["total"]> = {}): VistaDeAvanceCuota => ({
  procedencia: { chip: "cuota del diseño", detalle: "", degradada: false },
  vacio: null,
  total: {
    etiqueta: "Cuota del diseño",
    cuota: 2500,
    validas: 2668,
    brecha: 170,
    avance: 106.7,
    avanceTexto: "106.7 %",
    relleno: 100,
    aria: "106.7 % de la cuota",
    notas: [],
    descuadre: null,
    ...over,
  },
  filas: [],
  cumplidas: 0,
  sinCuota: 0,
});

describe("AulasAvanceCuota", () => {
  it("dice por qué conviven un avance sobre 100 y una cifra por recoger", () => {
    // El caso real de HSVG2026 «como 2025»: 2.668 sobre 2.500 con 170 personas
    // todavía por recoger en los grupos que no cierran.
    const html = renderToStaticMarkup(<AulasAvanceCuota vista={vista()} />);
    expect(html).toContain("170");
    expect(html).toContain("pasarse en un grupo no cubre al que va corto");
  });

  it("no la pinta cuando no hay contradicción que explicar", () => {
    // Por debajo de la cuota, «por recoger» se explica solo.
    const aMedias = renderToStaticMarkup(
      <AulasAvanceCuota vista={vista({ validas: 1200, brecha: 1300, avance: 48, avanceTexto: "48 %", relleno: 48 })} />,
    );
    expect(aMedias).not.toContain("pasarse en un grupo");

    // Y con la cuota cerrada de verdad tampoco: no hay nada por recoger.
    const cerrada = renderToStaticMarkup(
      <AulasAvanceCuota vista={vista({ brecha: 0 })} />,
    );
    expect(cerrada).toContain("cuota cumplida");
    expect(cerrada).not.toContain("pasarse en un grupo");
  });
});
