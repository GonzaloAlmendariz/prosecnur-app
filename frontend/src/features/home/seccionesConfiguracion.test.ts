import { describe, expect, test } from "vitest";
import { seccionDeConfiguracion } from "./seccionesConfiguracion";
import { searchSinConfiguracion } from "./useAbrirConfiguracion";

describe("configuración por dirección (L7)", () => {
  test("foco elige la sección; «conexiones» es alias de connections", () => {
    expect(seccionDeConfiguracion("connections")).toBe("connections");
    expect(seccionDeConfiguracion("Conexiones")).toBe("connections");
    expect(seccionDeConfiguracion("notes")).toBe("notes");
    expect(seccionDeConfiguracion("base-2")).toBeNull();
    expect(seccionDeConfiguracion(null)).toBeNull();
  });

  test("cerrar suelta el panel y su foco de sección, y conserva el resto", () => {
    expect(searchSinConfiguracion("?seccion=fuentes&panel=configuracion&foco=connections", true)).toBe("?seccion=fuentes");
  });

  test("un foco que no es de la configuración se respeta al cerrar", () => {
    expect(searchSinConfiguracion("?panel=configuracion&foco=base-2", false)).toBe("?foco=base-2");
  });
});
