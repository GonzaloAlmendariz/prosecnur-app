// La subida de una base que no calza ofrece el emparejamiento por texto y, al
// aceptar, la página recibe la base cargada (ítem 4).
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiUpload = vi.fn();
const apiCargaData = vi.fn();
const propuestaApi = vi.fn();
const aplicarApi = vi.fn();

vi.mock("../../../../api/client", () => ({
  apiCargaData: (...a: unknown[]) => apiCargaData(...a),
  apiCargaInstrumento: vi.fn(),
  apiQuitarData: vi.fn(),
  apiQuitarInstrumento: vi.fn(),
  apiUpload: (...a: unknown[]) => apiUpload(...a),
  uploadKindForDataFile: (f: File) => (/\.sav$/i.test(f.name) ? "sav" : "data"),
}));
vi.mock("../../../../api/estudio", () => ({ apiUpload: (...a: unknown[]) => apiUpload(...a) }));
vi.mock("../../../../api/xlsformEditor", () => ({ apiCargaInstrumentoDelEditor: vi.fn() }));
vi.mock("../../../../api/cargaEmparejamiento", () => ({
  apiCargaEmparejamientoTexto: (...a: unknown[]) => propuestaApi(...a),
  apiCargaEmparejamientoTextoAplicar: (...a: unknown[]) => aplicarApi(...a),
}));

import { subirInsumo } from "../accionesDeInsumos";
import { useEmparejamientoTexto } from "./useEmparejamientoTexto";

const propuesta = {
  resumen: { n_columnas: 3, n_ya_calzan: 0, n_propuestas: 2, n_dudosas: 0, n_ambiguas: 0, n_sin_pareja: 1, n_preguntas: 2, n_preguntas_sin_columna: 0 },
  columnas: [],
  sin_columna: [],
};

function efectos() {
  return {
    setError: vi.fn(),
    setBusy: vi.fn(),
    setInstrumento: vi.fn(),
    setEstructura: vi.fn(),
    setDataPreview: vi.fn(),
    setCambiosRespuestas: vi.fn(),
    setChoiceMappingReview: vi.fn(),
    refresh: vi.fn(async () => undefined),
    leerRevision: vi.fn(async () => undefined),
    tieneFormulario: true,
  };
}

const noCalza = Object.assign(new Error("Las respuestas no calzan con el formulario · E_DATA_XLSFORM_INCOMPATIBLE"), {
  code: "E_DATA_XLSFORM_INCOMPATIBLE",
});

beforeEach(() => {
  vi.clearAllMocks();
  useEmparejamientoTexto.getState().limpiar();
  apiUpload.mockResolvedValue({ file_id: "f1" });
});

describe("oferta de emparejamiento por texto al subir respuestas", () => {
  it("una base de Excel que no calza pide la propuesta y, al aceptar, la página recibe la base", async () => {
    apiCargaData.mockRejectedValue(noCalza);
    propuestaApi.mockResolvedValue(propuesta);
    const e = efectos();
    await subirInsumo("data", new File(["x"], "base.xlsx"), e);
    expect(e.setError).toHaveBeenCalledWith(noCalza.message);
    await vi.waitFor(() => expect(useEmparejamientoTexto.getState().fase).toBe("lista"));
    expect(useEmparejamientoTexto.getState().propuesta).toEqual(propuesta);

    aplicarApi.mockResolvedValue({ ok: true, preview: { n_filas: 3, columnas: [] }, cambios: null });
    await useEmparejamientoTexto.getState().aplicar([{ columna: 2, encabezado: "P1. Edad", name: "edad" }]);
    expect(aplicarApi).toHaveBeenCalledWith("f1", [{ columna: 2, encabezado: "P1. Edad", name: "edad" }]);
    expect(e.setError).toHaveBeenLastCalledWith("");
    expect(e.setDataPreview).toHaveBeenCalledWith({ n_filas: 3, columnas: [] });
    expect(e.leerRevision).toHaveBeenCalledWith(true);
    expect(useEmparejamientoTexto.getState().fase).toBe("inactivo");
  });

  it("otro error o un .sav no ofrecen el emparejamiento", async () => {
    apiCargaData.mockRejectedValue(Object.assign(new Error("x"), { code: "E_OTRA_COSA" }));
    await subirInsumo("data", new File(["x"], "base.xlsx"), efectos());
    apiCargaData.mockRejectedValue(noCalza);
    await subirInsumo("data", new File(["x"], "base.sav"), efectos());
    expect(propuestaApi).not.toHaveBeenCalled();
    expect(useEmparejamientoTexto.getState().fase).toBe("inactivo");
  });

  it("si la propuesta no se puede leer, se dice con su causa", async () => {
    apiCargaData.mockRejectedValue(noCalza);
    propuestaApi.mockRejectedValue(new Error("Extensión no soportada"));
    await subirInsumo("data", new File(["x"], "base.xlsx"), efectos());
    await vi.waitFor(() => expect(useEmparejamientoTexto.getState().fase).toBe("error"));
    expect(useEmparejamientoTexto.getState().error).toBe("Extensión no soportada");
  });
});
