// Ítem 6 de la oleada I2: las sumas de cada método salen de `sumas` del detalle; el reparto sólo donde aplica.
import { describe, expect, it } from "vitest";
import type { SumasDetalle } from "../../../../api/graficosCifras";
import { cifra, detalle, fila } from "./fixturaDetalle.test-utils";
import { cifrasRedondeo } from "./modeloCifrasRedondeo";

const CATS = [{ clave: "Sí", valor: 62 }, { clave: "No", valor: 37 }];
const sumas = (est: number, rep: number, aplica = true): SumasDetalle => ({ lamina: cifra(est), estandar: cifra(est), reparto: { ...cifra(rep), aplica } });

describe("cifras del redondeo", () => {
  it("una fila: la suma estándar, la del reparto y la mayor", () => {
    const d = detalle(CATS, { filas: [fila("total", CATS, { sumas: sumas(99, 100) })] });
    expect(cifrasRedondeo(d)).toEqual({ estandar: "Estándar: suma 99%", reparto: "Reparto: 100%", mayor: "La mayor: 62%" });
  });
  it("respuesta múltiple: el reparto no aplica y no se dice", () => {
    const d = detalle(CATS, { filas: [fila("total", CATS, { sumas: sumas(130, 130, false) })] });
    expect(cifrasRedondeo(d)?.reparto).toBeNull();
  });
  it("varias barras: el rango de las sumas", () => {
    const d = detalle(CATS, { forma: "escala", filas: [fila("a", CATS, { sumas: sumas(99, 100) }), fila("b", CATS, { sumas: sumas(101, 100) })] });
    expect(cifrasRedondeo(d)?.estandar).toBe("Estándar: suma de 99% a 101%");
    expect(cifrasRedondeo(d)?.reparto).toBe("Reparto: 100%");
    expect(cifrasRedondeo(null)).toBeNull();
  });
});
