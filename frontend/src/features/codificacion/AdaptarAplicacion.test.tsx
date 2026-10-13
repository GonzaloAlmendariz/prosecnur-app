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

const { AdaptarAplicacionResumenVista, AdaptarAplicacionVista, ID_ESTADO_ADAPTAR, pulsarAdaptar } = await import(
  "./AdaptarAplicacion"
);
const { ID_AVISO_APLICAR, irAlAviso, revelarAviso } = await import("./AplicarOmitidasAviso");
const { aplicarCodificacion, claveAplicar, selectAplicarEntrada, tieneAvisos, useAplicarAvisosStore } = await import(
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
    expect(html).toMatch(
      /<span id="codificacion-adaptar-estado" class="pulso-codif-adaptar-estado" role="status" aria-live="polite" tabindex="-1"><\/span>/,
    );
  });

  it("el botón se deshabilita y anuncia que trabaja mientras espera el POST", async () => {
    let resolver: (r: CodifAplicarRespuesta) => void = () => {};
    const enCurso = aplicarCodificacion(A, () => new Promise((r) => { resolver = r; }));

    const durante = montar(A);
    expect(boton(durante)).toMatch(/\sdisabled=""/);
    expect(boton(durante)).toContain('aria-busy="true"');
    expect(boton(durante)).toContain("Aplicando…");
    expect(durante).toMatch(/role="status" aria-live="polite" tabindex="-1">[^<]+<\/span>/);
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

// ---------------------------------------------------------------------------
// Re-QA C4: el remontaje del fin del job dejaba el aviso en y≈4735 con el
// scroll en 0 y el foco en BODY. Sin jsdom, un «montaje» es lo que hacen sus
// dos efectos, en el orden real: AdaptarAplicacion llama `alMontar` y el aviso
// revela si la entrada pide enfocar. Los objetivos son dobles que cuentan.

type Dobles = { scroll: ScrollIntoViewOptions[]; foco: (FocusOptions | undefined)[] };
const dobles = (): Dobles => ({ scroll: [], foco: [] });

function efectoDelAviso(clave: string, d: Dobles) {
  const e = selectAplicarEntrada(clave)(useAplicarAvisosStore.getState());
  if (!e.enfocarPendiente || !tieneAvisos(e.avisos)) return;
  revelarAviso(
    { scrollIntoView: (o) => d.scroll.push(o) },
    { focus: (o) => d.foco.push(o) },
  );
  useAplicarAvisosStore.getState().marcarEnfocado(clave);
}

function montaje(clave: string, d: Dobles) {
  useAplicarAvisosStore.getState().alMontar(clave);
  efectoDelAviso(clave, d);
}

describe("el aviso vuelve a la vista tras el remontaje del fin del job", () => {
  beforeEach(() => useAplicarAvisosStore.getState().reset());

  it("la marca hace scroll y foco una sola vez, en el primer montaje posterior al job", async () => {
    await aplicarCodificacion(A, async () => respuesta);
    // 1. Llega la respuesta: la instancia viva lo lleva a la vista.
    const alResponder = dobles();
    efectoDelAviso(A, alResponder);
    expect(alResponder.scroll).toHaveLength(1);

    // Un remontaje con el job todavía corriendo no mueve nada.
    const duranteJob = dobles();
    montaje(A, duranteJob);
    expect(duranteJob).toEqual(dobles());

    // 2. Termina el job y la página remonta el panel: vuelve a la vista.
    useAplicarAvisosStore.getState().terminar(A, { data: "f1", inst: "f2" });
    const remontaje = dobles();
    montaje(A, remontaje);
    expect(remontaje.scroll).toEqual([{ block: "nearest" }]);
    expect(remontaje.foco).toEqual([{ preventScroll: true }]);
    // Y el remontaje pinta el aviso con su título enfocable por programa.
    expect(montar(A)).toMatch(/<section[^>]*id="codificacion-aplicar-omitidas"/);

    // 3. Un montaje posterior (volver a la pestaña) ya no lo mueve.
    const despues = dobles();
    montaje(A, despues);
    montaje(A, despues);
    expect(despues).toEqual(dobles());
  });

  it("un montaje sin marca no mueve scroll ni foco", async () => {
    // Sin aplicación.
    const vacio = dobles();
    montaje(A, vacio);
    expect(vacio).toEqual(dobles());

    // Aplicación sin avisos, job terminado.
    await aplicarCodificacion(A, async () => ({ ...respuesta, omitidas: [], textos_sin_codigo: [] }));
    useAplicarAvisosStore.getState().terminar(A, { data: "f1", inst: "f2" });
    const sinAvisos = dobles();
    montaje(A, sinAvisos);
    expect(sinAvisos).toEqual(dobles());

    // Job que falla o se cancela: no hay remontaje que reparar; la marca cae.
    for (const fin of ["fallar", "cancelar"] as const) {
      await aplicarCodificacion(B, async () => respuesta);
      efectoDelAviso(B, dobles());
      if (fin === "fallar") useAplicarAvisosStore.getState().fallar(B, "E_JOB");
      else useAplicarAvisosStore.getState().cancelar(B);
      const tras = dobles();
      montaje(B, tras);
      expect(tras).toEqual(dobles());
    }
  });

  it("«Ver los avisos» de arriba aparece al terminar con avisos y lleva al aviso", async () => {
    const vista = (clave: string) =>
      renderToStaticMarkup(
        <AdaptarAplicacionResumenVista
          entrada={selectAplicarEntrada(clave)(useAplicarAvisosStore.getState())}
          onVerAvisos={nada}
        />,
      );
    await aplicarCodificacion(A, async () => respuesta);
    // Con el job corriendo todavía no hay nada que resumir.
    expect(vista(A)).toBe("");
    useAplicarAvisosStore.getState().terminar(A, { data: "f1", inst: "f2" });
    const html = vista(A);
    expect(html).toContain('data-testid="codificacion-adaptar-resumen"');
    expect(html).toContain("La adaptación terminó con 1 aviso.");
    expect(html).toMatch(/<button type="button"[^>]*>Ver el aviso<\/button>/);

    const d = dobles();
    const titulo = { focus: (o?: FocusOptions) => d.foco.push(o) };
    const seccion = {
      scrollIntoView: (o: ScrollIntoViewOptions) => d.scroll.push(o),
      querySelector: () => titulo,
    };
    const doc = {
      getElementById: (id: string) => (id === ID_AVISO_APLICAR ? seccion : null),
    } as unknown as Pick<Document, "getElementById">;
    expect(irAlAviso(doc)).toBe(true);
    expect(d.scroll).toEqual([{ block: "nearest" }]);
    expect(d.foco).toEqual([{ preventScroll: true }]);
  });
});

describe("el foco durante el POST de /aplicar", () => {
  beforeEach(() => useAplicarAvisosStore.getState().reset());

  it("pasa a la región de estado antes de que el botón se deshabilite: no cae a BODY", () => {
    // Doble del documento: un botón que se deshabilita suelta el foco a BODY.
    const body = { nombre: "BODY" };
    const boton = { nombre: "Adaptar" };
    const region = { nombre: ID_ESTADO_ADAPTAR, focus: () => { doc.activeElement = region; } };
    const doc: { activeElement: object } = { activeElement: boton };
    const adaptar = () => {
      if (doc.activeElement === boton) doc.activeElement = body;
    };
    pulsarAdaptar(region, adaptar);
    expect(doc.activeElement).toBe(region);
  });

  it("la región que recibe el foco es enfocable por programa y no queda vacía mientras trabaja", async () => {
    let resolver: (r: CodifAplicarRespuesta) => void = () => {};
    const enCurso = aplicarCodificacion(A, () => new Promise((r) => { resolver = r; }));
    const estado = (html: string) =>
      html.match(/<span id="codificacion-adaptar-estado"[^>]*tabindex="-1">([^<]*)<\/span>/)?.[1] ?? null;
    expect(estado(montar(A))).toContain("Revisando el catálogo");
    resolver({ ...respuesta, omitidas: [], textos_sin_codigo: [] });
    await enCurso;
    // Sin avisos el foco sigue ahí durante el job: tiene que decir algo.
    expect(estado(montar(A))).toBe("La adaptación está corriendo; el avance se muestra abajo.");
  });
});
