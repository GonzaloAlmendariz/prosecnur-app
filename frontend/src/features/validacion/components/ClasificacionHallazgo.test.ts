import { describe, expect, it } from "vitest";

import { severidadAlGuardar, severidadDeClasificacion } from "./ClasificacionHallazgo";

describe("severidad que guarda el editor de criterios", () => {
  it("la clase elegida manda: inconsistencia es error, caso a revisar es advertencia", () => {
    expect(severidadDeClasificacion("inconsistencia_usuario")).toBe("error");
    expect(severidadDeClasificacion("caso_validar")).toBe("advertencia");
    expect(severidadAlGuardar("caso_validar", "error", true)).toBe("advertencia");
    expect(severidadAlGuardar("inconsistencia_usuario", "advertencia", true)).toBe("error");
  });

  it("abrir y guardar una regla sin cambiar su clase conserva su severidad", () => {
    // Regla sembrada con severidad error cuya clase llega como caso a revisar por defecto.
    expect(severidadAlGuardar("caso_validar", "error", false)).toBe("error");
    expect(severidadAlGuardar("inconsistencia_usuario", "advertencia", false)).toBe("advertencia");
  });

  it("una regla nueva toma la severidad de su clase", () => {
    expect(severidadAlGuardar("caso_validar", undefined, false)).toBe("advertencia");
    expect(severidadAlGuardar("inconsistencia_usuario", null, false)).toBe("error");
  });
});
