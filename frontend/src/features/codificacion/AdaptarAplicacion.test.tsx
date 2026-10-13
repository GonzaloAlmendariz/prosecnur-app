import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CodifAplicarRespuesta } from "../../api/dashboard";

vi.mock("../../lib/SessionContext", () => ({
  useSession: () => ({ sessionId: "sid-1", refresh: async () => {} }),
}));

// `downloadUrl` firma el enlace con el sid de localStorage; en node no hay.
vi.stubGlobal("localStorage", {
  getItem: () => "sid-1",
  setItem: () => {},
  removeItem: () => {},
});

const { AdaptarAplicacionVista } = await import("./AdaptarAplicacion");
const { aplicarCodificacion, claveAplicar, selectAplicarEntrada, useAplicarAvisosStore } = await import(
  "./aplicarAvisosStore"
);

// AdaptarPane se desmonta cuando el job de `/aplicar` termina (la página pinta
// «Cargando base de codificación…» y lo remonta). Lo que la aplicación dejó
// —avisos, sin recodificar, descargas— tiene que seguir ahí al volver.
//
// Sin DOM, «montar» es pintar una instancia nueva desde lo que hay en el store
// en ese momento: exactamente lo que hace el remontaje real, que no hereda nada
// del componente anterior. (El SSR de zustand lee el estado inicial, por eso se
// pinta la vista con la entrada del store y no el contenedor.)

const A = claveAplicar("sid-1", "base_a");
const B = claveAplicar("sid-1", "base_b");

const respuesta: CodifAplicarRespuesta = {
  ok: true,
  job_id: "job-1",
  kind: "codif_aplicar",
  omitidas: [
    { pregunta: "P66", motivo: "sin_columna_texto", mensaje: "Falta «P66_otro».", variable_nueva: null },
  ],
  textos_sin_codigo: [],
  sin_recodificar: [
    { parent: "P9", parent_label: "P9", decision: "pendiente", motivo: "", n_respuestas: 3, deliberado: false },
  ],
};

const nada = () => {};
const montar = (clave: string, nPreguntas = 2) =>
  renderToStaticMarkup(
    <AdaptarAplicacionVista
      entrada={selectAplicarEntrada(clave)(useAplicarAvisosStore.getState())}
      nPreguntas={nPreguntas}
      onBackToCodificar={nada}
      onBackToMatrices={nada}
      onAdaptar={nada}
      onJobDone={nada}
      onJobError={nada}
      onJobCancelled={nada}
      onEnfocado={nada}
    />,
  );

function boton(html: string): string {
  const m = html.match(/<button[^>]*data-testid="codificacion-adaptar-boton"[^>]*>[\s\S]*?<\/button>/);
  if (!m) throw new Error("no se encontró el botón Adaptar");
  return m[0];
}

describe("AdaptarAplicacionVista", () => {
  beforeEach(() => useAplicarAvisosStore.getState().reset());

  it("sin aplicación previa: botón habilitado, sin aviso y región viva vacía", () => {
    const html = montar(A);
    expect(boton(html)).not.toMatch(/\sdisabled=""/);
    expect(boton(html)).toContain("Confirmar y adaptar respuestas");
    expect(html).not.toContain('data-testid="codificacion-aplicar-omitidas"');
    expect(html).toMatch(/<span class="pulso-codif-adaptar-estado" role="status" aria-live="polite"><\/span>/);
  });

  it("el botón se deshabilita y anuncia que trabaja mientras espera el POST", async () => {
    let resolver: (r: CodifAplicarRespuesta) => void = () => {};
    const enCurso = aplicarCodificacion(A, () => new Promise((r) => { resolver = r; }));

    const durante = montar(A);
    expect(boton(durante)).toMatch(/\sdisabled=""/);
    expect(boton(durante)).toContain('aria-busy="true"');
    expect(boton(durante)).toContain("Aplicando…");
    expect(durante).toMatch(/role="status" aria-live="polite">[^<]+<\/span>/);
    expect(durante).toContain("La codificación se está aplicando.");

    resolver(respuesta);
    await enCurso;
    // Con el job corriendo sigue deshabilitado, pero ya no «aplicando».
    const despues = montar(A);
    expect(boton(despues)).toMatch(/\sdisabled=""/);
    expect(boton(despues)).not.toContain("aria-busy");
    expect(despues).toContain("La adaptación ya está corriendo.");
  });

  it("el aviso sobrevive a desmontar y volver a montar el panel", async () => {
    await aplicarCodificacion(A, async () => respuesta);
    const primero = montar(A);
    expect(primero).toContain('data-testid="codificacion-aplicar-omitidas"');

    // Fin del job: la página desmonta el panel y lo vuelve a montar.
    useAplicarAvisosStore.getState().terminar(A, { data: "file-data", inst: "file-inst" });
    const remontado = montar(A);
    expect(remontado).toContain('data-testid="codificacion-aplicar-omitidas"');
    expect(remontado).toContain("1 pregunta del catálogo no se aplicó");
    expect(remontado).toContain('data-testid="codificacion-sin-recodificar"');
    expect(remontado).toContain("data_adaptada.xlsx");
    expect(remontado).toContain("file-data");
    // El título es enfocable por programa, no un tab stop.
    expect(remontado).toMatch(/<strong[^>]*tabindex="-1"[^>]*>1 pregunta del catálogo no se aplicó/);
  });

  it("otra base no pinta los avisos de la aplicación anterior", async () => {
    await aplicarCodificacion(A, async () => respuesta);
    const html = montar(B);
    expect(html).not.toContain('data-testid="codificacion-aplicar-omitidas"');
    expect(html).not.toContain('data-testid="codificacion-sin-recodificar"');
    expect(boton(html)).not.toMatch(/\sdisabled=""/);
  });
});
