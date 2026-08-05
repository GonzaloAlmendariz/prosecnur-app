import { describe, expect, it } from "vitest";

import { nombreDeColumna } from "../exploradorBasesNombres";
import type { CalcMuestraWorkspaceVariableMapping } from "../../../../../api/client";

/**
 * G43 · Gonzalo: «pero los nombres de la base no son los de las columnas
 * originales del Excel».
 *
 * Lo que se prueba aquí es de dónde sale cada nombre y, sobre todo, cuándo NO
 * se puede prometer que venga del archivo: una columna que el marco calcula no
 * tiene original, y darle uno inventado sería peor que enseñar el técnico.
 */
const mappings = [
  { role: "faculty", label: "Facultad", column: "FACULTAD DEL ALUMNO" },
] as unknown as CalcMuestraWorkspaceVariableMapping[];

describe("nombreDeColumna", () => {
  it("usa la columna declarada en Datos › Variables", () => {
    const nombre = nombreDeColumna("faculty", mappings);
    expect(nombre).toMatchObject({
      titulo: "FACULTAD DEL ALUMNO",
      tecnico: "faculty",
      origen: "excel",
    });
  });

  it("cae al `mappedColumn` del catálogo cuando el workspace no lo declara", () => {
    const nombre = nombreDeColumna("condicion_curso", [], { condicion_curso: "Condición" });
    expect(nombre).toMatchObject({ titulo: "Condición", origen: "excel" });
  });

  it("la declaración del usuario gana sobre el catálogo", () => {
    const nombre = nombreDeColumna("faculty", mappings, { faculty: "otra cosa" });
    expect(nombre.titulo).toBe("FACULTAD DEL ALUMNO");
  });

  it("una columna derivada dice que la calcula el marco, y qué calcula", () => {
    const nombre = nombreDeColumna("eligible_n", mappings);
    expect(nombre.origen).toBe("motor");
    expect(nombre.titulo).toBe("Alumnos elegibles");
    expect(nombre.detalle).toContain("criterios de estudiante");
  });

  it("sin declaración ni derivada conocida conserva el nombre técnico", () => {
    const nombre = nombreDeColumna("columna_rara_del_frame", mappings);
    expect(nombre).toMatchObject({
      titulo: "columna_rara_del_frame",
      tecnico: "columna_rara_del_frame",
      origen: "interno",
    });
  });

  it("un rol conocido sin columna declarada usa su etiqueta institucional", () => {
    const nombre = nombreDeColumna("campus", []);
    expect(nombre.titulo).toBe("Sede o campus");
    // No es «excel»: nadie declaró qué columna del archivo la sostiene.
    expect(nombre.origen).toBe("interno");
  });

  it("una columna declarada en blanco no cuenta como declarada", () => {
    const vacios = [
      { role: "faculty", label: "Facultad", column: "   " },
    ] as unknown as CalcMuestraWorkspaceVariableMapping[];
    expect(nombreDeColumna("faculty", vacios).origen).not.toBe("excel");
  });
});
