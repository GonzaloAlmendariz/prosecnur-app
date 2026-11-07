import { describe, expect, it } from "vitest";
import { SALIDAS } from "./PiezasIdentidad";

// «A qué salida llega cada pieza» dice lo que hace el motor: los íconos sólo llegan al PPT (ningún reporte_word_*.R los
// dibuja; reporte_word_documento.R deja fuera la lámina de íconos); lo demás llega a los dos.
describe("A qué salida llega cada pieza de la identidad", () => {
  it("los íconos sólo al PPT; línea, colores, logos y letra a los dos", () => {
    const de = (k: string) => SALIDAS.find((s) => s.clave === k);
    expect(de("iconos")).toMatchObject({ ppt: true, word: false });
    for (const k of ["linea", "colores", "logos", "letra"]) expect(de(k)).toMatchObject({ ppt: true, word: true });
  });
});
