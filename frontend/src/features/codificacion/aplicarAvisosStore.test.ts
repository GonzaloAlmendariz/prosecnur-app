import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CodifAplicarRespuesta } from "../../api/dashboard";
import {
  APLICAR_ENTRADA_VACIA,
  aplicarCodificacion,
  claveAplicar,
  selectAplicarEntrada,
  useAplicarAvisosStore,
} from "./aplicarAvisosStore";

// Lo que deja `/aplicar` vive fuera de AdaptarPane: al terminar el job la
// página remonta el panel y el estado local se perdía (QA C5, Adaptar).

const respuesta = (over: Partial<CodifAplicarRespuesta> = {}): CodifAplicarRespuesta => ({
  ok: true,
  job_id: "job-1",
  kind: "codif_aplicar",
  omitidas: [
    { pregunta: "P66", motivo: "sin_columna_texto", mensaje: "Falta «P66_otro».", variable_nueva: null },
  ],
  textos_sin_codigo: [{ pregunta: "P4", columna: "P4_otro", casos: 1, textos: 1, ejemplos: ["Hombre"] }],
  sin_recodificar: [
    { parent: "P9", parent_label: "P9", decision: "pendiente", motivo: "", n_respuestas: 3, deliberado: false },
  ],
  ...over,
});

const entrada = (clave: string) => selectAplicarEntrada(clave)(useAplicarAvisosStore.getState());

const A = claveAplicar("sid-1", "base_a");
const B = claveAplicar("sid-1", "base_b");

describe("aplicarAvisosStore", () => {
  beforeEach(() => useAplicarAvisosStore.getState().reset());

  it("la clave separa sesión y base; sin base es «default»", () => {
    expect(claveAplicar("s", "x")).not.toBe(claveAplicar("t", "x"));
    expect(claveAplicar("s", null)).toBe("s::default");
    expect(claveAplicar("s", "  ")).toBe("s::default");
  });

  it("una base sin aplicación lee la entrada vacía", () => {
    expect(entrada(A)).toBe(APLICAR_ENTRADA_VACIA);
  });

  it("recibir llena avisos, sin recodificar y job, y pide enfocar", () => {
    const s = useAplicarAvisosStore.getState();
    s.iniciar(A);
    expect(entrada(A).aplicando).toBe(true);
    s.recibir(A, respuesta());
    const e = entrada(A);
    expect(e.aplicando).toBe(false);
    expect(e.jobId).toBe("job-1");
    expect(e.avisos.omitidas.map((o) => o.pregunta)).toEqual(["P66"]);
    expect(e.avisos.textos_sin_codigo.map((t) => t.pregunta)).toEqual(["P4"]);
    expect(e.sinRecodificar.map((v) => v.parent)).toEqual(["P9"]);
    expect(e.enfocarPendiente).toBe(true);
    s.marcarEnfocado(A);
    expect(entrada(A).enfocarPendiente).toBe(false);
  });

  it("sin avisos no pide enfocar", () => {
    const s = useAplicarAvisosStore.getState();
    s.iniciar(A);
    s.recibir(A, respuesta({ omitidas: [], textos_sin_codigo: [] }));
    expect(entrada(A).enfocarPendiente).toBe(false);
  });

  it("iniciar limpia la aplicación anterior de esa base, incluidas las descargas", () => {
    const s = useAplicarAvisosStore.getState();
    s.iniciar(A);
    s.recibir(A, respuesta());
    s.terminar(A, { data: "f1", inst: "f2" });
    expect(entrada(A).salida).toEqual({ data: "f1", inst: "f2" });
    expect(entrada(A).jobId).toBeNull();
    s.iniciar(A);
    const e = entrada(A);
    expect(e.avisos.omitidas).toEqual([]);
    expect(e.avisos.textos_sin_codigo).toEqual([]);
    expect(e.sinRecodificar).toEqual([]);
    expect(e.salida).toBeNull();
    expect(e.aplicando).toBe(true);
  });

  it("una base no ve los avisos de otra", () => {
    const s = useAplicarAvisosStore.getState();
    s.iniciar(A);
    s.recibir(A, respuesta());
    expect(entrada(B)).toBe(APLICAR_ENTRADA_VACIA);
    // Y aplicar en B no borra lo de A.
    s.iniciar(B);
    s.recibir(B, respuesta({ omitidas: [], job_id: "job-2" }));
    expect(entrada(A).avisos.omitidas).toHaveLength(1);
    expect(entrada(B).avisos.omitidas).toHaveLength(0);
    expect(entrada(B).jobId).toBe("job-2");
  });

  it("aplicarCodificacion limpia antes del POST y llena con la respuesta", async () => {
    const s = useAplicarAvisosStore.getState();
    s.iniciar(A);
    s.recibir(A, respuesta());
    s.terminar(A, { data: "viejo", inst: "viejo" });

    let resolver: (r: CodifAplicarRespuesta) => void = () => {};
    const llamar = vi.fn(() => new Promise<CodifAplicarRespuesta>((r) => { resolver = r; }));
    const enCurso = aplicarCodificacion(A, llamar);
    // Durante el POST: limpio y aplicando.
    expect(entrada(A).aplicando).toBe(true);
    expect(entrada(A).avisos.omitidas).toEqual([]);
    expect(entrada(A).salida).toBeNull();
    // Un segundo clic mientras espera no lanza otro POST.
    await aplicarCodificacion(A, llamar);
    expect(llamar).toHaveBeenCalledTimes(1);

    resolver(respuesta({ job_id: "job-9" }));
    await enCurso;
    expect(entrada(A).aplicando).toBe(false);
    expect(entrada(A).jobId).toBe("job-9");
    expect(entrada(A).avisos.omitidas).toHaveLength(1);
  });

  it("un POST que falla deja el error y libera el botón", async () => {
    await aplicarCodificacion(A, () => Promise.reject(new Error("E_CODIF: sin catálogo")));
    expect(entrada(A).aplicando).toBe(false);
    expect(entrada(A).jobId).toBeNull();
    expect(entrada(A).error).toBe("E_CODIF: sin catálogo");
  });
});
