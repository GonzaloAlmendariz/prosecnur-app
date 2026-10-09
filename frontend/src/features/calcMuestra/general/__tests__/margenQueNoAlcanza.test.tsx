/**
 * L4 del loop de mejoras (2026-09-27): cuando el margen alcanzado supera al
 * pedido, Método lo decía en verde. La tarjeta «Margen alcanzado» llevaba el
 * sello de procedencia «cifra validada» —que se lee como «cumple»— y la causa
 * que el motor redacta (el piso, el marco topado) sólo aparecía en Resultados.
 * Lo que no alcanza se dice donde se decide.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente } from "../../../../api/calcMuestra";
import { defaultComponente } from "../../sharedCore";
import { BandaDisenoGeneral } from "../BandaDisenoGeneral";
import { avisoMargenGeneral, cifrasDisenoGeneral } from "../bandaDisenoModelo";

type Resultado = NonNullable<CalcMuestraComponente["resultado"]>;

const TOPE =
  "Abordando el marco completo se esperan 600 completas de las 697 que pide el margen: el error alcanzable es ±3.3 puntos, no ±3.0. Sube la tasa de respuesta o acepta ese margen.";

function comp(precision: number, advertencia?: string): CalcMuestraComponente {
  return {
    ...defaultComponente({ id: "c1", actor: "Hogares" }),
    tecnica: "prob_aleatorio_simple",
    naturaleza: "prob",
    parametros: { ...defaultComponente().parametros, e: 0.03, tasa_respuesta: 0.3 },
    resultado: {
      n_objetivo: 697,
      n_operativo: 2000,
      precision_alcanzada: precision,
      advertencia,
    } as unknown as Resultado,
  };
}

describe("L4 · el margen que no alcanza se dice en Método", () => {
  it("la tarjeta no lleva «cifra validada» y dice que no se alcanza", () => {
    const margen = cifrasDisenoGeneral({ comp: comp(0.0335, TOPE), marco: null, corrida: null, seccion: "metodo" })
      .find((c) => c.clave === "margen");
    expect(margen).toMatchObject({ tono: "alerta" });
    expect(margen?.origen).toBeUndefined();
    expect(margen?.detalle).toContain("no se alcanza");
  });

  it("si cumple, conserva el sello de procedencia", () => {
    const margen = cifrasDisenoGeneral({ comp: comp(0.0299), marco: null, corrida: null, seccion: "metodo" })
      .find((c) => c.clave === "margen");
    expect(margen).toMatchObject({ tono: "ok", origen: "motor" });
  });

  it("el aviso toma la causa que redactó el motor, sin la frase de cierre", () => {
    const aviso = avisoMargenGeneral(comp(0.0335, `${TOPE} Muestreo aleatorio simple: el margen de error formal corresponde al diseño.`));
    expect(aviso).toBe(TOPE);
    const piso = avisoMargenGeneral(comp(0.0335,
      "Con el piso de 30 por estrato, el error alcanzado (±5.3 puntos) supera el declarado (±5.0): sube n o baja el piso. Muestreo estratificado con asignación de Neyman: el margen de error formal corresponde al diseño probabilístico documentado."));
    expect(piso).toBe("Con el piso de 30 por estrato, el error alcanzado (±5.3 puntos) supera el declarado (±5.0): sube n o baja el piso.");
  });

  it("sin causa redactada, dice las dos cifras", () => {
    expect(avisoMargenGeneral(comp(0.0335))).toBe("El n no alcanza el margen pedido: ±3.4% frente a ±3.0%.");
    expect(avisoMargenGeneral(comp(0.0299))).toBeNull();
  });

  it("la banda de Método pinta el aviso; la de Resultados no lo repite", () => {
    const metodo = renderToStaticMarkup(<BandaDisenoGeneral comp={comp(0.0335, TOPE)} marco={null} corrida={null} seccion="metodo" />);
    expect(metodo).toContain("se esperan 600 completas");
    const resultados = renderToStaticMarkup(<BandaDisenoGeneral comp={comp(0.0335, TOPE)} marco={null} corrida={null} seccion="resultados" />);
    expect(resultados).not.toContain("se esperan 600 completas");
  });
});
