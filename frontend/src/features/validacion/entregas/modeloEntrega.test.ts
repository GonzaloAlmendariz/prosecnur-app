import { describe, expect, it } from "vitest";
import { archivosDelCierre, conNombre, estadoDelCierre, nombreDeDisposicion } from "./modeloEntrega";

describe("Validación sobre el kit de entregables", () => {
  it("el nombre del ZIP sale de Content-Disposition; el codificado manda", () => {
    expect(nombreDeDisposicion('attachment; filename="HSVG2026_Metodologia_de_validacion_10_11_26.zip"'))
      .toBe("HSVG2026_Metodologia_de_validacion_10_11_26.zip");
    expect(nombreDeDisposicion("attachment; filename=\"Metodologia.zip\"; filename*=UTF-8''Metodolog%C3%ADa_Bre%C3%B1a.zip"))
      .toBe("Metodología_Breña.zip");
    expect(nombreDeDisposicion("attachment; filename=plano.zip")).toBe("plano.zip");
    expect(nombreDeDisposicion("attachment")).toBeNull();
    expect(nombreDeDisposicion(null)).toBeNull();
  });

  it("conNombre no pisa el nombre del motor", () => {
    expect(conNombre({ file_id: "f", original_name: "HSVG_Plan.xlsx" }, "X.xlsx")).toEqual({ file_id: "f", original_name: "HSVG_Plan.xlsx" });
    expect(conNombre({ file_id: "f" }, "Plan_de_limpieza.xlsx")).toEqual({ file_id: "f", filename: "Plan_de_limpieza.xlsx" });
  });

  it("los archivos del cierre: la base primero, con su nombre y su copia; sin file_id no salen", () => {
    const archivos = archivosDelCierre([
      { kind: "excel_detalle", label: "Excel detalle de decisiones", file_id: "f3", filename: "HSVG_Decisiones_de_limpieza.xlsx", size: 300 },
      { kind: "reporte_html", label: "Reporte HTML ejecutivo", file_id: "f2", original_name: "HSVG_Revision_de_limpieza.html", size: 200 },
      { kind: "base_limpia", label: "Base final limpia", file_id: "f1", filename: "HSVG_Base_limpia.xlsx", size: 100, guardado_en: "C:\\E\\Entregables\\Procesamiento\\HSVG_Base_limpia.xlsx" },
      { kind: "otro", label: "Sin archivo" },
      "basura",
    ]);
    expect(archivos.map((a) => a.nombre)).toEqual([
      "HSVG_Base_limpia.xlsx", "HSVG_Revision_de_limpieza.html", "HSVG_Decisiones_de_limpieza.xlsx",
    ]);
    expect(archivos[0].guardadoEn).toBe("C:\\E\\Entregables\\Procesamiento\\HSVG_Base_limpia.xlsx");
    expect(archivosDelCierre({})).toEqual([]);
  });

  it("el estado del cierre: en curso, fallo con Reintentar, lista sin descarga automática", () => {
    const reintentar = () => {};
    expect(estadoDelCierre({ cerrando: false, error: "", archivos: null })).toEqual({ fase: "inactiva" });
    expect(estadoDelCierre({ cerrando: true, error: "", archivos: null }).fase).toBe("en_curso");
    expect(estadoDelCierre({ cerrando: false, error: "Faltan decisiones", archivos: null }, reintentar))
      .toMatchObject({ fase: "fallo", titulo: "No se pudo generar la base limpia", causa: "Faltan decisiones", reintentar });
    const archivos = [{ fileId: "f1", nombre: "B.xlsx", formato: "xlsx" }];
    expect(estadoDelCierre({ cerrando: false, error: "", archivos })).toMatchObject({ fase: "lista", archivos, sinDescargar: true });
    expect(estadoDelCierre({ cerrando: false, error: "", archivos: [] })).toEqual({ fase: "inactiva" });
  });
});
