import { describe, expect, it } from "vitest";

import { normalizarTablasConstruidas } from "../../../../../api/monitoreoAulasTablas";
import { lecturaDeTabla } from "./TablasDeMaterial";

// ADR 0125: Material construye las tablas en el Sheets; Monitoreo comprueba que
// existen y, si faltan, lleva a Material › Entrega.
describe("tablas de Material en Insumos › Fuentes", () => {
  it("normaliza lo que serializa Plumber, con existe NA como null", () => {
    const t = normalizarTablasConstruidas({
      libro: { destino: ["L1"], url: ["https://x/L1"], existe: [null], faltan: [], error: ["sin acceso"] },
      distribucion: { destino: "D1", url: "u", existe: [true], semanas: ["Semana 1", "Semana 2"], error: "" },
    });
    expect(t.libro.existe).toBeNull();
    expect(t.libro.error).toBe("sin acceso");
    expect(t.distribucion.existe).toBe(true);
    expect(t.distribucion.semanas).toEqual(["Semana 1", "Semana 2"]);
  });

  it("sin destino o incompleta pide construir en Material; ilegible no se da por faltante", () => {
    const vacia = { destino: "", url: "", existe: false, error: "" };
    expect(lecturaDeTabla(vacia).falta).toBe(true);
    const incompleta = lecturaDeTabla({ destino: "L1", url: "", existe: false, error: "" }, ["Base de control"]);
    expect(incompleta.falta).toBe(true);
    expect(incompleta.nota).toContain("Base de control");
    const ilegible = lecturaDeTabla({ destino: "L1", url: "", existe: null, error: "x" });
    expect(ilegible.falta).toBe(false);
    expect(ilegible.estado).toBe("Sin leer");
    expect(lecturaDeTabla({ destino: "L1", url: "", existe: true, error: "" }).estado).toBe("Construida");
  });
});
