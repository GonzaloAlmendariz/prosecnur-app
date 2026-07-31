import { describe, expect, it } from "vitest";
import {
  acreditacionAgruparEstados,
  acreditacionFamiliaDeEstado,
} from "./familiasDeLlamada";

describe("clasificación de estados crudos del cliente", () => {
  it("tolera el error de tipeo real de la hoja de acrconta", () => {
    // "Número Incorrrecto" (tres erres) viene así del cliente y no se puede
    // corregir desde la app: se normaliza por raíz.
    expect(acreditacionFamiliaDeEstado("Número Incorrrecto").familia).toBe("numero_invalido");
    expect(acreditacionFamiliaDeEstado("Número Incorrecto").familia).toBe("numero_invalido");
  });

  it("no confunde 'No efectivo' con efectivo", () => {
    expect(acreditacionFamiliaDeEstado("Efectivo").familia).toBe("efectivo");
    expect(acreditacionFamiliaDeEstado("No efectivo / Fuera de servicio").familia).toBe("sin_contacto");
  });

  it("mapea las once categorías reales de acrconta", () => {
    const esperado: Record<string, string> = {
      "Efectivo": "efectivo",
      "No contesta": "sin_contacto",
      "Apagado": "sin_contacto",
      "No barrido": "sin_barrer",
      "Número Incorrrecto": "numero_invalido",
      "No efectivo / Fuera de servicio": "sin_contacto",
      "No existe el número": "numero_invalido",
      "Contactar después": "sin_contacto",
      "Rechazo": "rechazo",
      "Número suspendido": "numero_invalido",
      "Contactado por otro": "sin_contacto",
    };
    for (const [crudo, familia] of Object.entries(esperado)) {
      expect(acreditacionFamiliaDeEstado(crudo).familia, crudo).toBe(familia);
    }
  });

  it("un estado vacío se lee como sin barrer", () => {
    expect(acreditacionFamiliaDeEstado("").familia).toBe("sin_barrer");
    expect(acreditacionFamiliaDeEstado(null).familia).toBe("sin_barrer");
  });

  it("un estado desconocido NO se disfraza de otra familia", () => {
    // Reetiquetar en silencio es lo que rompe la trazabilidad del expediente.
    expect(acreditacionFamiliaDeEstado("Parcial").familia).toBe("otro");
    expect(acreditacionFamiliaDeEstado("Cualquier cosa").familia).toBe("otro");
  });

  it("reprogramada cuenta como sin contacto", () => {
    expect(acreditacionFamiliaDeEstado("Reprogramada").familia).toBe("sin_contacto");
  });
});

describe("agrupación en familias", () => {
  const crudo = [
    { label: "Efectivo", value: 141 },
    { label: "No contesta", value: 61 },
    { label: "Apagado", value: 17 },
    { label: "No barrido", value: 16 },
    { label: "Número Incorrrecto", value: 9 },
    { label: "No efectivo / Fuera de servicio", value: 8 },
    { label: "No existe el número", value: 6 },
    { label: "Contactar después", value: 5 },
    { label: "Rechazo", value: 4 },
    { label: "Número suspendido", value: 2 },
    { label: "Contactado por otro", value: 1 },
  ];

  it("reduce once categorías crudas a cinco familias sin perder casos", () => {
    const grupos = acreditacionAgruparEstados(crudo);
    expect(grupos).toHaveLength(5);
    expect(grupos.reduce((sum, g) => sum + g.value, 0)).toBe(270);
  });

  it("conserva el crudo del cliente como detalle trazable", () => {
    const invalidos = acreditacionAgruparEstados(crudo).find((g) => g.familia === "numero_invalido")!;
    expect(invalidos.value).toBe(17);
    expect(invalidos.detalle.map((d) => d.label)).toEqual([
      "Número Incorrrecto",
      "No existe el número",
      "Número suspendido",
    ]);
  });

  it("ordena por lectura operativa, no por volumen", () => {
    const familias = acreditacionAgruparEstados(crudo).map((g) => g.familia);
    expect(familias).toEqual(["efectivo", "sin_contacto", "numero_invalido", "rechazo", "sin_barrer"]);
  });

  it("descarta categorías en cero", () => {
    const grupos = acreditacionAgruparEstados([
      { label: "Efectivo", value: 3 },
      { label: "Rechazo", value: 0 },
    ]);
    expect(grupos.map((g) => g.familia)).toEqual(["efectivo"]);
  });
});
