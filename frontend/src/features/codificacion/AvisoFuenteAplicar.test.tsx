import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CodifAplicarRespuesta } from "../../api/dashboard";
import { normalizeCodifAvisoFuente } from "../../api/codificacion";

// B1 (2026-10-24): `/aplicar` devuelve `aviso_fuente` cuando Codificación leyó otro número de casos que el de la base
// (codificacion_fuente_aviso_n, api/R/codificacion_fuente_actual.R). El frontend lo descartaba. Se pinta como aviso
// propio, en texto llano; no por `avisos_incompletos`, que lo diría como «No se pudo revisar…».

vi.mock("../../lib/SessionContext", () => ({
  useSession: () => ({ sessionId: "sid-1", refresh: async () => {} }),
}));
vi.stubGlobal("localStorage", { getItem: () => "sid-1", setItem: () => {}, removeItem: () => {} });

const { AdaptarAplicacionResumenVista, AdaptarAplicacionVista } = await import("./AdaptarAplicacion");
const { aplicarCodificacion, claveAplicar, selectAplicarEntrada, useAplicarAvisosStore } = await import("./aplicarAvisosStore");

const AVISO_R = "Codificación leyó 380 casos y la base «default» tiene 397: la adaptación no corresponde a la base vigente. Revisa la fuente antes de usarla.";
const A = claveAplicar("sid-1", "default");
const respuesta = (aviso_fuente: string | null): CodifAplicarRespuesta => ({
  ok: true, job_id: "job-1", kind: "codificacion.aplicar", avisos_incompletos: [], omitidas: [], textos_sin_codigo: [], sin_recodificar: [], aviso_fuente,
});
const nada = () => {};
const montar = () => renderToStaticMarkup(
  <AdaptarAplicacionVista entrada={selectAplicarEntrada(A)(useAplicarAvisosStore.getState())} nPreguntas={2}
    onBackToCodificar={nada} onBackToMatrices={nada} onAdaptar={nada} onJobDone={nada} onJobError={nada} onJobCancelled={nada} onEnfocado={nada} />,
);

describe("B1 · aviso de la fuente de Codificación al aplicar", () => {
  beforeEach(() => useAplicarAvisosStore.getState().reset());

  it("el normalizador lee el texto y descarta lo que no es texto (un NULL de R llega como {})", () => {
    expect(normalizeCodifAvisoFuente({ aviso_fuente: `  ${AVISO_R} ` })).toBe(AVISO_R);
    expect(normalizeCodifAvisoFuente({ aviso_fuente: [AVISO_R] })).toBe(AVISO_R);
    expect(normalizeCodifAvisoFuente({ aviso_fuente: {} })).toBeNull();
    expect(normalizeCodifAvisoFuente({ aviso_fuente: "" })).toBeNull();
    expect(normalizeCodifAvisoFuente({})).toBeNull();
  });

  it("se pinta como aviso propio, en texto llano, y sobrevive al remontaje del fin del job", async () => {
    await aplicarCodificacion(A, async () => respuesta(AVISO_R));
    useAplicarAvisosStore.getState().terminar(A, { data: "f-data", inst: "f-inst" });
    const html = montar();
    expect(html).toContain('data-testid="codificacion-aviso-fuente"');
    expect(html).toContain("Se leyeron 380 respuestas, pero la base tiene 397");
    expect(html).not.toContain("No se pudo revisar");
    expect(html).not.toContain("default");
    expect(renderToStaticMarkup(<AdaptarAplicacionResumenVista entrada={selectAplicarEntrada(A)(useAplicarAvisosStore.getState())} onVerAvisos={nada} />))
      .toContain("1 aviso");
  });

  it("sin aviso de fuente no pinta nada", async () => {
    await aplicarCodificacion(A, async () => respuesta(null));
    expect(montar()).not.toContain("codificacion-aviso-fuente");
  });
});
