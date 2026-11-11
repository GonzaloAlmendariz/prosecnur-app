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

const { AdaptarAplicacionResumenVista, AdaptarAplicacionVista, pulsarAdaptar } = await import(
  "./AdaptarAplicacion"
);
const { ID_AVISO_APLICAR, irAlAviso, revelarAviso } = await import("./AplicarOmitidasAviso");
const { EFECTO_APLICAR, EFECTO_SIN_APLICAR } = await import("./aplicar/modeloAplicar");
const { aplicarCodificacion, claveAplicar, selectAplicarEntrada, tieneAvisos, useAplicarAvisosStore } = await import(
  "./aplicarAvisosStore"
);

// AdaptarPane se desmonta cuando el job de `/aplicar` termina (la página pinta
// "Cargando base de codificación…" y lo remonta). Lo que la aplicación dejó
// —avisos, sin recodificar, descargas— tiene que seguir ahí al volver.
//
// Sin DOM, "montar" es pintar una instancia nueva desde lo que hay en el store
// en ese momento: exactamente lo que hace el remontaje real, que no hereda nada
// del componente anterior. (El SSR de zustand lee el estado inicial, por eso se
// pinta la vista con la entrada del store y no el contenedor.)

const A = claveAplicar("sid-1", "base_a");
const B = claveAplicar("sid-1", "base_b");

const respuesta: CodifAplicarRespuesta = {
  ok: true,
  job_id: "job-1",
  kind: "codif_aplicar",
  avisos_incompletos: [],
  omitidas: [
    { pregunta: "P66", motivo: "sin_columna_texto", mensaje: 'Falta "P66_otro".', variable_nueva: null },
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
      onCerrarEntrega={nada}
      onEnfocado={nada}
    />,
  );

function boton(html: string): string {
  const m = html.match(/<button[^>]*data-testid="codificacion-adaptar-boton"[^>]*>[\s\S]*?<\/button>/);
  if (!m) throw new Error("no se encontró el botón Aplicar a la base");
  return m[0];
}

describe("AdaptarAplicacionVista", () => {
  beforeEach(() => useAplicarAvisosStore.getState().reset());

  it("sin aplicación previa: botón habilitado, sin aviso y región viva vacía", () => {
    const html = montar(A);
    expect(boton(html)).not.toMatch(/\sdisabled=""/);
    expect(boton(html)).toContain("Aplicar a la base");
    // El pie dice el efecto antes de pulsar: qué se escribe y dónde.
    expect(html).toContain(EFECTO_APLICAR);
    // En lo que se lee no queda "adaptar"; los identificadores (id, data-testid) lo conservan.
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(/adapta/i);
    expect(html).not.toContain('data-testid="codificacion-aplicar-omitidas"');
    expect(html).toMatch(
      /<span id="codificacion-adaptar-estado" class="pulso-codif-adaptar-estado pulso-sr-only" role="status" aria-live="polite"><\/span>/,
    );
  });

  it("el botón se deshabilita y anuncia que trabaja mientras espera el POST", async () => {
    let resolver: (r: CodifAplicarRespuesta) => void = () => {};
    const enCurso = aplicarCodificacion(A, () => new Promise((r) => { resolver = r; }));

    const durante = montar(A);
    expect(boton(durante)).toMatch(/\sdisabled=""/);
    expect(boton(durante)).toContain('aria-busy="true"');
    // Sólo se deshabilita: no gira ni cambia de rótulo; lo que se mueve es la línea del contenedor.
    expect(boton(durante)).toContain("Aplicar a la base");
    expect(boton(durante)).not.toContain("pulso-codif-adaptar-giro");
    expect(durante).toContain('data-entregable-forma="bloque"');
    expect(durante).toContain('data-entregable-fase="en_curso"');
    expect(durante).toMatch(/role="status" aria-live="polite">[^<]+<\/span>/);
    expect(durante).toContain("La codificación se está aplicando.");

    resolver(respuesta);
    await enCurso;
    // Con el job corriendo sigue deshabilitado, pero ya no "aplicando".
    const despues = montar(A);
    expect(boton(despues)).toMatch(/\sdisabled=""/);
    expect(boton(despues)).not.toContain("aria-busy");
    expect(despues).toContain("La aplicación ya está en curso.");
    // Una sola señal en pantalla: la región de estado es sólo para el lector; la línea del contenedor informa.
    expect(despues).toMatch(/<span id="codificacion-adaptar-estado" class="pulso-codif-adaptar-estado pulso-sr-only"/);
  });

  it("el aviso sobrevive a desmontar y volver a montar el panel", async () => {
    await aplicarCodificacion(A, async () => respuesta);
    const primero = montar(A);
    expect(primero).toContain('data-testid="codificacion-aplicar-omitidas"');

    // Fin del job: la página desmonta el panel y lo vuelve a montar.
    useAplicarAvisosStore.getState().terminar(A, {
      archivos: [
        { fileId: "file-data", nombre: "HSVG2026_Data_adaptada_10_11_26.xlsx", formato: "xlsx", tamano: 2048 },
        { fileId: "file-inst", nombre: "HSVG2026_Instrumento_adaptado_10_11_26.xlsx", formato: "xlsx", tamano: 1024 },
      ],
    });
    const remontado = montar(A);
    expect(remontado).toContain('data-testid="codificacion-aplicar-omitidas"');
    expect(remontado).toContain("1 pregunta no se aplicó");
    expect(remontado).toContain('data-testid="codificacion-sin-recodificar"');
    // Los dos archivos, con su nombre real, en un solo contenedor en bloque; sin el panel "Resultado".
    expect(remontado).toContain('data-entregable-fase="lista"');
    expect(remontado).toContain("HSVG2026_Data_adaptada_10_11_26.xlsx");
    expect(remontado).toContain("HSVG2026_Instrumento_adaptado_10_11_26.xlsx");
    expect(remontado).not.toContain("Archivos adaptados listos para descargar");
    expect(remontado).not.toMatch(/<a\b[^>]*href=/);
    // El bloque de archivos lleva su título: el contenedor del kit solo pinta los nombres que pone el motor.
    const titulo = remontado.indexOf('<h4 class="pulso-aplicar-resultado-titulo">Archivos codificados</h4>');
    const contenedor = remontado.indexOf('data-entregable-forma="bloque"');
    const resumen = remontado.indexOf('data-testid="codificacion-adaptar-resumen"');
    const aviso = remontado.indexOf('data-testid="codificacion-aplicar-omitidas"');
    expect(titulo).toBeGreaterThan(remontado.indexOf('class="pulso-aplicar-resultado"'));
    expect(contenedor).toBeGreaterThan(titulo);
    // "Terminó con 1 aviso" va en el bloque de resultado, tras los archivos y antes del aviso: no sobre la franja.
    expect(resumen).toBeGreaterThan(contenedor);
    expect(aviso).toBeGreaterThan(resumen);
    expect(remontado).toContain("La aplicación terminó con 1 aviso.");
    // El título es enfocable por programa, no un tab stop.
    expect(remontado).toMatch(/<strong[^>]*tabindex="-1"[^>]*>1 pregunta no se aplicó/);
    // El aviso pide corregir y volver a aplicar: la acción sigue en el pie, habilitada, tras una aplicación.
    expect(boton(remontado)).not.toMatch(/\sdisabled=""/);
  });

  it("los archivos listos dicen qué son; sin archivos a la vista no hay título", async () => {
    const sinAvisos = { ...respuesta, omitidas: [], textos_sin_codigo: [], sin_recodificar: [] };
    await aplicarCodificacion(A, async () => sinAvisos);
    // Con el job corriendo todavía no hay archivos: ni título ni nota.
    expect(montar(A)).not.toContain("pulso-aplicar-resultado-cab");
    useAplicarAvisosStore.getState().terminar(A, {
      archivos: [
        { fileId: "file-data", nombre: "HSVG2026_Data_adaptada_10_11_26.xlsx", formato: "xlsx", rotulo: "Base codificada" },
        { fileId: "file-inst", nombre: "HSVG2026_Instrumento_adaptado_10_11_26.xlsx", formato: "xlsx", rotulo: "Formulario codificado" },
      ],
    });
    const listo = montar(A);
    expect(listo).toContain('<h4 class="pulso-aplicar-resultado-titulo">Archivos codificados</h4><p class="pulso-aplicar-resultado-nota">Base codificada y formulario codificado</p>');
    // Sin avisos no hay línea de resumen.
    expect(listo).not.toContain('data-testid="codificacion-adaptar-resumen"');
    // Al cerrar el contenedor de archivos, su título se va con él.
    useAplicarAvisosStore.getState().cerrarEntrega(A);
    expect(montar(A)).not.toContain("pulso-aplicar-resultado-cab");
    // Un fallo no es una lista de archivos: sin título.
    useAplicarAvisosStore.getState().fallar(B, "E_JOB");
    expect(montar(B)).not.toContain("pulso-aplicar-resultado-cab");
  });

  it("sin preguntas por aplicar: el botón queda deshabilitado, con su motivo, y el pie dice que no se escribe nada", () => {
    const html = montar(A, 0);
    expect(boton(html)).toMatch(/\sdisabled=""/);
    expect(boton(html)).toContain('aria-describedby="codificacion-adaptar-disabled-reason"');
    expect(html).toContain("No hay preguntas con códigos por aplicar.");
    expect(html).toContain(EFECTO_SIN_APLICAR);
    expect(html).not.toContain(EFECTO_APLICAR);
  });

  it("el avance, los archivos y los avisos van en el cuerpo del panel, que desplaza; el pie cierra el panel aparte", async () => {
    await aplicarCodificacion(A, async () => respuesta);
    const html = montar(A);
    const resultado = html.indexOf('class="pulso-aplicar-resultado"');
    const cierre = html.indexOf('<div class="pulso-aplicar-cierre">');
    const pie = html.indexOf('<footer class="pulso-pie-efecto pulso-aplicar-pie"');
    expect(html.startsWith('<div class="pulso-aplicar-cuerpo">')).toBe(true);
    expect(resultado).toBeGreaterThan(-1);
    // El pie no va dentro del cuerpo: queda a la vista aunque el cuerpo desplace.
    expect(cierre).toBeGreaterThan(resultado);
    expect(pie).toBeGreaterThan(cierre);
    for (const marca of ['data-entregable-forma="bloque"', 'data-testid="codificacion-aplicar-omitidas"', 'data-testid="codificacion-sin-recodificar"']) {
      const i = html.indexOf(marca);
      expect(i, marca).toBeGreaterThan(resultado);
      expect(i, marca).toBeLessThan(cierre);
    }
    // Lo que AdaptarPane le pasa (la lista y las preguntas que no se pueden aplicar) va primero en el cuerpo.
    const conLista = renderToStaticMarkup(
      <AdaptarAplicacionVista
        entrada={selectAplicarEntrada(A)(useAplicarAvisosStore.getState())} nPreguntas={2}
        onBackToCodificar={nada} onBackToMatrices={nada} onAdaptar={nada} onCerrarEntrega={nada} onEnfocado={nada}
      >
        <ul data-prueba="lista" />
      </AdaptarAplicacionVista>,
    );
    expect(conLista.startsWith('<div class="pulso-aplicar-cuerpo"><ul data-prueba="lista"></ul><div class="pulso-aplicar-resultado">')).toBe(true);
    // Sin nada que decir, la zona de resultado queda vacía y la hoja la oculta (`:empty`).
    expect(montar(B)).toContain('<div class="pulso-aplicar-resultado"></div>');
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
// scroll en 0 y el foco en BODY. Sin jsdom, un "montaje" es lo que hacen sus
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
    useAplicarAvisosStore.getState().terminar(A, { archivos: [{ fileId: "f1", nombre: "Data.xlsx", formato: "xlsx" }, { fileId: "f2", nombre: "Instrumento.xlsx", formato: "xlsx" }] });
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
    useAplicarAvisosStore.getState().terminar(A, { archivos: [{ fileId: "f1", nombre: "Data.xlsx", formato: "xlsx" }, { fileId: "f2", nombre: "Instrumento.xlsx", formato: "xlsx" }] });
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

  it('"Ver los avisos" de arriba aparece al terminar con avisos y lleva al aviso', async () => {
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
    useAplicarAvisosStore.getState().terminar(A, { archivos: [{ fileId: "f1", nombre: "Data.xlsx", formato: "xlsx" }, { fileId: "f2", nombre: "Instrumento.xlsx", formato: "xlsx" }] });
    const html = vista(A);
    expect(html).toContain('data-testid="codificacion-adaptar-resumen"');
    expect(html).toContain("La aplicación terminó con 1 aviso.");
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

  it("pide el foco para el contenedor antes de aplicar: el pedido llega antes de que el botón se deshabilite", () => {
    const orden: string[] = [];
    pulsarAdaptar(() => orden.push("foco"), () => orden.push("adaptar"));
    expect(orden).toEqual(["foco", "adaptar"]);
  });

  it("la región viva anuncia sin recibir el foco y no queda vacía mientras trabaja", async () => {
    let resolver: (r: CodifAplicarRespuesta) => void = () => {};
    const enCurso = aplicarCodificacion(A, () => new Promise((r) => { resolver = r; }));
    const region = (html: string) => html.match(/<span id="codificacion-adaptar-estado"[^>]*>/)?.[0] ?? "";
    const estado = (html: string) =>
      html.match(/<span id="codificacion-adaptar-estado"[^>]*>([^<]*)<\/span>/)?.[1] ?? null;
    // Era el destino del foco: un `span` invisible de 1 px, sin contorno.
    expect(region(montar(A))).not.toMatch(/tabindex/);
    expect(region(montar(A))).toMatch(/aria-live="polite"/);
    expect(estado(montar(A))).toContain("Revisando la codificación");
    resolver({ ...respuesta, omitidas: [], textos_sin_codigo: [] });
    await enCurso;
    // Sin avisos el foco sigue ahí durante el job: tiene que decir algo.
    expect(estado(montar(A))).toBe("La codificación se está aplicando a la base; el avance se muestra bajo la lista de preguntas.");
  });
});
