import { describe, expect, it } from "vitest";
import type { CodifConfigBundle } from "../../../api/dashboard";
import {
  archivosDeAdaptacion, conNombre, estadoDeAdaptacion, MATRICES, respaldoComoArchivo, type EntradaAdaptacion,
} from "./modeloEntrega";

const VACIA: EntradaAdaptacion = { aplicando: false, jobId: null, avance: null, archivos: null, error: "", entregaCerrada: false };

describe("Codificación sobre el kit de entregables", () => {
  it("conNombre respeta el nombre del motor y sólo rellena el que falta", () => {
    expect(conNombre({ file_id: "f", filename: "HSVG_Matriz.xlsx" }, "X.xlsx")).toEqual({ file_id: "f", filename: "HSVG_Matriz.xlsx" });
    expect(conNombre({ file_id: "f", original_name: "Otro.xlsx" }, "X.xlsx")).toEqual({ file_id: "f", original_name: "Otro.xlsx" });
    expect(conNombre({ file_id: "f", size: 10 }, MATRICES.client.respaldo)).toEqual({
      file_id: "f", size: 10, filename: "Matriz_de_codificacion_para_el_cliente.xlsx",
    });
    expect(conNombre(null, "X.xlsx")).toBeNull();
  });

  it("el respaldo JSON sale sin ok ni suggested_filename, con el nombre que sugiere el backend", async () => {
    const bundle = {
      ok: true, schema_version: "prosecnur.coding_config.v1", exported_at: "", app_version: "", project_label: "",
      mode: "unibase", suggested_filename: "HSVG2026_codificacion.json", variables: [],
    } as CodifConfigBundle;
    const archivo = respaldoComoArchivo(bundle);
    expect(archivo.nombre).toBe("HSVG2026_codificacion.json");
    const texto = await archivo.blob.text();
    expect(JSON.parse(texto)).not.toHaveProperty("ok");
    expect(JSON.parse(texto)).not.toHaveProperty("suggested_filename");
    expect(respaldoComoArchivo({ ...bundle, suggested_filename: "" }, new Date("2026-11-10T12:00:00Z")).nombre)
      .toBe("prosecnur_codificacion_2026-11-10.json");
  });

  it("los dos archivos de la adaptación, en orden; con guardado_en del motor si llega", () => {
    const archivos = archivosDeAdaptacion({
      ok: true,
      instrumento_adaptado: { file_id: "fi", size: 1024 },
      data_adaptada: { file_id: "fd", size: 2048, filename: "HSVG2026_Data_adaptada_10_11_26.xlsx", guardado_en: "C:\\E\\Entregables\\Procesamiento\\HSVG2026_Data_adaptada_10_11_26.xlsx" },
    });
    expect(archivos.map((a) => [a.fileId, a.nombre, a.formato])).toEqual([
      ["fd", "HSVG2026_Data_adaptada_10_11_26.xlsx", "xlsx"],
      ["fi", "Instrumento_adaptado.xlsx", "xlsx"],
    ]);
    expect(archivos[0].guardadoEn).toBe("C:\\E\\Entregables\\Procesamiento\\HSVG2026_Data_adaptada_10_11_26.xlsx");
    expect(archivosDeAdaptacion({ ok: true, data_adaptada: {} })).toEqual([]);
  });

  it("el estado del contenedor sigue al store: preparando, job con avance y Cancelar, fallo, listo y cerrado", () => {
    const cancelar = () => {};
    const reintentar = () => {};
    expect(estadoDeAdaptacion(VACIA)).toEqual({ fase: "inactiva" });
    expect(estadoDeAdaptacion({ ...VACIA, aplicando: true })).toMatchObject({ fase: "en_curso", porcentaje: null });
    expect(estadoDeAdaptacion({ ...VACIA, jobId: "j", avance: { porcentaje: 40, mensaje: "Adaptando base" } }, { cancelar }))
      .toMatchObject({ fase: "en_curso", porcentaje: 40, mensaje: "Adaptando base", cancelar });
    expect(estadoDeAdaptacion({ ...VACIA, error: "Sin mapeos" }, { reintentar }))
      .toMatchObject({ fase: "fallo", titulo: "No se pudieron adaptar las respuestas", causa: "Sin mapeos", reintentar });
    const archivos = [{ fileId: "f", nombre: "D.xlsx", formato: "xlsx" }];
    // Lista sin descarga automática: la adaptación cambia la base; los archivos se ofrecen.
    expect(estadoDeAdaptacion({ ...VACIA, archivos })).toMatchObject({ fase: "lista", archivos, sinDescargar: true });
    expect(estadoDeAdaptacion({ ...VACIA, archivos, entregaCerrada: true })).toEqual({ fase: "inactiva" });
    // Un job corriendo se ve aunque se haya cerrado el contenedor anterior.
    expect(estadoDeAdaptacion({ ...VACIA, jobId: "j", entregaCerrada: true }).fase).toBe("en_curso");
  });
});
