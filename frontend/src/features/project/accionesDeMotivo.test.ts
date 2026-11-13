import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { accionDeMotivo } from "./accionesDeMotivo";
import { MotivosSinGuardar } from "./MotivosSinGuardar";

describe("acción de cada motivo sin guardar", () => {
  it("traduce las claves y funciones que anota el backend", () => {
    expect(accionDeMotivo("validacion_scope_set")).toBe("Se cambió la base de Validación");
    expect(accionDeMotivo(".carga_review_set_reconciliation")).toBe("Se confirmaron las columnas fuera del formulario");
    expect(accionDeMotivo(".instrument_revision_binding_apply")).toBe("Se vinculó la versión del formulario a la base");
    expect(accionDeMotivo("estudio_replace_base_files")).toBe("Se reemplazaron los archivos de una base");
    expect(accionDeMotivo("choice_code_maps_confirmed")).toBe("Se confirmaron los códigos de respuesta");
    expect(accionDeMotivo("analitica_codebook_ok")).toBe("Se generó un entregable de Analítica");
    expect(accionDeMotivo("calc_muestra_aulas_selection")).toBe("Se cambió el cálculo de muestra");
  });

  it("une las claves de una misma escritura sin repetir y conserva la circunstancia", () => {
    expect(accionDeMotivo("estudio + instrumento")).toBe("Se cambiaron las bases del estudio; se cambió el formulario");
    expect(accionDeMotivo("analitica_config + analitica_config_por_base")).toBe("Se cambió la configuración de Analítica");
    expect(accionDeMotivo("choice_code_mapping (migrado al abrir un .pulso antiguo)"))
      .toBe("Se ajustaron los códigos de respuesta, migrado al abrir un .pulso antiguo");
  });

  it("lo que no está en la tabla dice su área, nunca el identificador", () => {
    expect(accionDeMotivo("validacion_algo_nuevo")).toBe("Cambio en Validación");
    expect(accionDeMotivo(".pulso_repair_algo")).toBe("Cambio en el proyecto");
    expect(accionDeMotivo("desconocido")).toBe("Cambio en el proyecto");
  });

  it("la lista del diálogo no muestra identificadores", () => {
    const motivos = ["validacion_scope_set", ".carga_review_set_reconciliation", ".instrument_revision_binding_apply",
      "estudio_replace_base_files", "choice_code_maps_confirmed", "xyz_interno"].map((motivo) => ({ motivo, veces: 1, ultima: null }));
    const html = renderToStaticMarkup(createElement(MotivosSinGuardar, { motivos }));
    const visible = html.replace(/<[^>]+>/g, " ");
    expect(visible).toContain("Cambios desde el último guardado");
    for (const { motivo } of motivos) expect(visible).not.toContain(motivo);
    expect(visible).not.toMatch(/[a-z]+_[a-z]+/);
  });
});
