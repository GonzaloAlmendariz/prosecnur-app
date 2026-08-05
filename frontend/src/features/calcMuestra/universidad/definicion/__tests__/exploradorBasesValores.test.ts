import { describe, expect, it } from "vitest";

import { etiquetaDeValor } from "../exploradorBasesValores";

/**
 * G47 · Gonzalo: «el motivo de exclusión no es una categoría que se vea muy
 * elegante, se ve muy técnica; hay que perfeccionar las etiquetas tanto del
 * nombre de la variable como de sus opciones».
 *
 * Medido en su proyecto, la columna publica cosas como
 * `min_eligible_per_class|modality|session_type|enrolled_total|min_eligible`:
 * no es una categoría, es el registro interno de qué filtros tumbaron ese
 * curso-horario.
 */
describe("etiquetaDeValor · motivo de exclusión", () => {
  it("traduce cada motivo y los une como lista, no con la barra del motor", () => {
    expect(etiquetaDeValor("exclude_reason", "min_eligible_per_class|modality|min_eligible"))
      .toBe("Mínimo por aula (filtro base) · Modalidad · Mínimo de alumnos elegibles");
  });

  it("un motivo suelto se lee igual de bien", () => {
    expect(etiquetaDeValor("exclude_reason", "teacher_type")).toBe("Tipo de docente");
  });

  it("distingue el filtro base del criterio, que se llaman casi igual", () => {
    // Aparecen juntos en la misma celda; con el mismo nombre serían
    // indistinguibles y parecerían un duplicado del motor.
    expect(etiquetaDeValor("exclude_reason", "min_eligible"))
      .not.toBe(etiquetaDeValor("exclude_reason", "min_eligible_per_class"));
  });

  it("un motivo desconocido se humaniza en vez de quedarse en clave", () => {
    expect(etiquetaDeValor("exclude_reason", "criterio_nuevo_del_motor"))
      .toBe("Criterio nuevo del motor");
  });
});

describe("etiquetaDeValor · otras derivadas", () => {
  it("TRUE/FALSE dicen lo que significan en esta columna", () => {
    expect(etiquetaDeValor("included", "TRUE")).toBe("Entra al marco");
    expect(etiquetaDeValor("included", "FALSE")).toBe("Queda fuera");
  });

  it("los tramos de tamaño nombran sus extremos", () => {
    expect(etiquetaDeValor("size_group", "G1")).toContain("más pequeños");
    expect(etiquetaDeValor("size_group", "G4")).toContain("más grandes");
    expect(etiquetaDeValor("size_group", "G2")).toBe("Tramo 2");
  });

  it("«curso» y «modal» dicen qué nivel se está usando", () => {
    expect(etiquetaDeValor("level_reference", "curso")).toBe("Nivel declarado del curso");
    expect(etiquetaDeValor("level_reference", "modal")).toBe("Nivel más frecuente del aula");
  });

  it("las claves normalizadas del motor se leen con espacios", () => {
    expect(etiquetaDeValor("teacher_type_top", "docente_contratado_contratado"))
      .toBe("Docente contratado contratado");
  });

  it("sin nada mejor que el crudo devuelve null y quien llama lo conserva", () => {
    // Un valor del archivo en mayúsculas no es una clave del motor: no se toca.
    expect(etiquetaDeValor("size_group", "OBLIGATORIO")).toBeNull();
    expect(etiquetaDeValor("included", "  ")).toBeNull();
  });
});
