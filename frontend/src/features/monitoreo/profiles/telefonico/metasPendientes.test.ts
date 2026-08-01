import { describe, expect, it, vi } from "vitest";

import { aplicarMetasPendientes, etiquetaDeConfirmacion, metasQueCambian } from "./metasPendientes";

// Ajustar metas era inmanejable porque cada edición era una decisión: cada meta
// tocada persistía la config y recalculaba universo, brecha, tasa y reserva.
// Ajustar y confirmar tienen que ser dos actos, y el recálculo uno solo.

const guardadas: Record<string, number> = { "Homologación Laboral": 80, "Vinculación Laboral": 20 };
const metaGuardada = (value: string) => guardadas[value] ?? 0;

describe("metasQueCambian", () => {
  it("solo cuenta las metas que difieren de lo guardado", () => {
    expect(metasQueCambian({ "Homologación Laboral": 90 }, metaGuardada)).toEqual(["Homologación Laboral"]);
  });

  it("pasar por un campo sin cambiarlo no es un cambio pendiente", () => {
    // Si contara, el botón se encendería solo por mover el cursor y confirmar
    // guardaría y recalcularía sin motivo.
    expect(metasQueCambian({ "Homologación Laboral": 80 }, metaGuardada)).toEqual([]);
  });

  it("cero cuenta como cambio cuando la meta guardada no era cero", () => {
    expect(metasQueCambian({ "Vinculación Laboral": 0 }, metaGuardada)).toEqual(["Vinculación Laboral"]);
  });
});

describe("aplicarMetasPendientes", () => {
  it("aplica todo el borrador en una sola pasada", () => {
    const upsert = vi.fn((goals: string[], value: string, meta: number) => [...goals, `${value}=${meta}`]);
    const resultado = aplicarMetasPendientes(
      [] as string[],
      { "Homologación Laboral": 90, "Vinculación Laboral": 25 },
      metaGuardada,
      upsert,
    );

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(resultado).toEqual(["Homologación Laboral=90", "Vinculación Laboral=25"]);
  });

  it("sin cambios no toca nada y devuelve el mismo objeto", () => {
    // La identidad importa: quien lo consume decide si vale la pena persistir.
    const upsert = vi.fn();
    const goals = ["intacto"];
    expect(aplicarMetasPendientes(goals, { "Homologación Laboral": 80 }, metaGuardada, upsert)).toBe(goals);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("ignora las metas que no cambiaron aunque estén en el borrador", () => {
    const upsert = vi.fn((goals: string[], value: string, meta: number) => [...goals, `${value}=${meta}`]);
    aplicarMetasPendientes(
      [] as string[],
      { "Homologación Laboral": 80, "Vinculación Laboral": 25 },
      metaGuardada,
      upsert,
    );

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith([], "Vinculación Laboral", 25);
  });
});

describe("etiquetaDeConfirmacion", () => {
  it("cuenta lo que va a confirmar", () => {
    expect(etiquetaDeConfirmacion(1)).toBe("Confirmar 1 meta");
    expect(etiquetaDeConfirmacion(3)).toBe("Confirmar 3 metas");
  });

  it("sin nada pendiente no promete una acción", () => {
    expect(etiquetaDeConfirmacion(0)).toBe("Metas confirmadas");
  });
});
