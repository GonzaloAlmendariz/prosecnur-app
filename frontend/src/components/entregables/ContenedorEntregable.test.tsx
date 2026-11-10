// @vitest-environment happy-dom
/**
 * ContenedorEntregable: cada forma en cada fase (ADR 0133, fase 4). Lo que se
 * vigila es lo que pidió Gonzalo: una sola señal en movimiento (la línea), nada
 * resaltado ni subrayado (sin <a> ni botones primarios), «Mostrar en la
 * carpeta» y rutas de Windows, y en el navegador sin Abrir ni carpeta.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProsecnurApi } from "../../features/project/types";
import type { EstadoGeneracion, FormaContenedor } from "./tipos";

const espia = vi.hoisted(() => ({ descargar: vi.fn(), copiar: vi.fn(async () => undefined) }));
vi.mock("../../lib/descargas", () => ({ descargarArchivo: espia.descargar }));
vi.mock("../../lib/portapapeles", () => ({ copiarTexto: espia.copiar }));
vi.mock("../../api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/core")>()),
  downloadUrl: (fileId: string) => `/api/files/${fileId}/download`,
}));

const { ContenedorEntregable } = await import("./ContenedorEntregable");

const GUARDADO = "C:\\Users\\ana\\Estudios\\HSVG2026\\Entregables\\Procesamiento\\HSVG2026_Frecuencias_07_11_26.xlsx";

const ESTADOS: Record<string, Exclude<EstadoGeneracion, { fase: "inactiva" }>> = {
  indeterminada: { fase: "en_curso", titulo: "Frecuencias", porcentaje: null, cancelar: () => undefined },
  conAvance: { fase: "en_curso", titulo: "Cruces", paso: 2, pasos: 4, mensaje: "Calculando cruces", porcentaje: 40, cancelar: () => undefined },
  lista: {
    fase: "lista", titulo: "Frecuencias", rutaDescargada: null,
    archivos: [{ fileId: "f1", nombre: "HSVG2026_Frecuencias_07_11_26.xlsx", formato: "xlsx", tamano: 49152, guardadoEn: GUARDADO }],
  },
  fallo: { fase: "fallo", titulo: "Frecuencias", causa: "No hay base activa.", codigo: "E_ANALITICA_SIN_BASE", reintentar: () => undefined },
};
const FORMAS: FormaContenedor[] = ["bloque", "anclada", "fila"];

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  espia.descargar.mockClear();
  espia.copiar.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  delete window.prosecnurApi;
});

function escritorio() {
  const api = {
    saveEntregableDialog: vi.fn(async () => null),
    abrirArchivo: vi.fn(async () => ({ ok: true })),
    mostrarEnCarpeta: vi.fn(async () => ({ ok: true })),
    onDescargaTerminada: () => () => undefined,
  };
  window.prosecnurApi = api as unknown as ProsecnurApi;
  return api;
}

async function montar(estado: EstadoGeneracion, forma: FormaContenedor, onCerrar = vi.fn()) {
  await act(async () => { root.render(<ContenedorEntregable estado={estado} forma={forma} onCerrar={onCerrar} />); });
  return host.querySelector<HTMLElement>("[data-entregable-fase]");
}

function boton(nombre: string): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    .find((b) => b.getAttribute("aria-label") === nombre || b.textContent?.trim() === nombre) ?? null;
}

describe("cada forma en cada fase", () => {
  for (const forma of FORMAS) {
    for (const [nombre, estado] of Object.entries(ESTADOS)) {
      it(`${forma} · ${nombre}: se declara, es neutro y solo la línea se mueve`, async () => {
        escritorio();
        const el = await montar(estado, forma);
        expect(el).not.toBeNull();
        expect(el?.dataset.entregableForma).toBe(forma);
        expect(el?.dataset.entregableFase).toBe(estado.fase);
        expect(el?.getAttribute("role")).toBe(estado.fase === "fallo" ? "alert" : "status");
        expect(host.querySelectorAll("a")).toHaveLength(0);
        expect(host.querySelectorAll(".pulso-button--primary")).toHaveLength(0);
        expect(host.querySelectorAll(".pulso-spin, [class*='spin']")).toHaveLength(0);
        const lineas = host.querySelectorAll("[role='progressbar']");
        expect(lineas).toHaveLength(estado.fase === "en_curso" ? 1 : 0);
        expect(host.querySelectorAll(".pulso-barra-avance--indeterminada")).toHaveLength(nombre === "indeterminada" ? 1 : 0);
      });
    }
  }

  it("inactiva no dibuja nada", async () => {
    await montar({ fase: "inactiva" }, "bloque");
    expect(host.innerHTML).toBe("");
  });
});

describe("ícono del formato", () => {
  it("en curso y en fallo lleva la sigla esperada; sin ella, la misma hoja sin sigla", async () => {
    await montar({ fase: "en_curso", titulo: "Informe en Word", formato: "docx", porcentaje: null }, "bloque");
    expect(host.querySelector(".pulso-entregable-tile")?.textContent).toBe("DOCX");
    await montar({ fase: "fallo", titulo: "No se pudo generar el informe en PowerPoint", formato: "pptx", causa: "x" }, "anclada");
    expect(host.querySelector(".pulso-entregable-tile")?.textContent).toBe("PPTX");
    await montar({ fase: "en_curso", titulo: "Frecuencias", porcentaje: null }, "bloque");
    const neutro = host.querySelector(".pulso-entregable-tile");
    expect(neutro).not.toBeNull();
    expect(neutro?.textContent).toBe("");
  });

  it("las siglas de cuatro letras se marcan para apretar el tracking", async () => {
    await montar(ESTADOS.lista, "bloque");
    expect(host.querySelector(".pulso-entregable-tile")?.getAttribute("data-letras")).toBe("4");
    await montar({ fase: "en_curso", titulo: "x", formato: "pdf", porcentaje: null }, "bloque");
    expect(host.querySelector(".pulso-entregable-tile")?.getAttribute("data-letras")).toBeNull();
  });
});

describe("traer a la vista", () => {
  function espiarScroll(reducido: boolean) {
    const llamadas: ScrollIntoViewOptions[] = [];
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function (o?: boolean | ScrollIntoViewOptions) {
      if (typeof o === "object") llamadas.push(o);
    };
    const matchOriginal = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: reducido && q.includes("reduce"), media: q })) as unknown as typeof window.matchMedia;
    return {
      llamadas,
      restaurar: () => {
        HTMLElement.prototype.scrollIntoView = original;
        window.matchMedia = matchOriginal;
      },
    };
  }

  it("bloque: al aparecer y al cambiar de fase, scrollIntoView nearest; con movimiento reducido, sin suavizar", async () => {
    const espia = espiarScroll(true);
    try {
      await montar(ESTADOS.indeterminada, "bloque");
      await montar(ESTADOS.lista, "bloque");
      expect(espia.llamadas).toHaveLength(2);
      expect(espia.llamadas[0]).toMatchObject({ block: "nearest", behavior: "auto" });
    } finally {
      espia.restaurar();
    }
  });

  it("sin movimiento reducido se desplaza suave; anclada y fila no mueven la página", async () => {
    const espia = espiarScroll(false);
    try {
      await montar(ESTADOS.indeterminada, "bloque");
      expect(espia.llamadas[0]).toMatchObject({ block: "nearest", behavior: "smooth" });
      await act(async () => root.render(<></>));
      await montar(ESTADOS.lista, "anclada");
      await montar(ESTADOS.fallo, "fila");
      expect(espia.llamadas).toHaveLength(1);
    } finally {
      espia.restaurar();
    }
  });
});

describe("en curso", () => {
  it("dice el paso y la fase; con avance la línea lo mide; Cancelar es neutro", async () => {
    const cancelar = vi.fn();
    await montar({ ...ESTADOS.conAvance, cancelar } as EstadoGeneracion, "bloque");
    expect(host.textContent).toContain("Paso 2 de 4: calculando cruces");
    expect(host.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe("40");
    const b = boton("Cancelar");
    expect(b?.className).toContain("pulso-entregable-texto");
    await act(async () => { b?.click(); });
    expect(cancelar).toHaveBeenCalled();
    expect(boton("Cerrar")).toBeNull();
  });
});

describe("listo", () => {
  it("escritorio con copia: Guardado, peso, carpeta con «\\» y Abrir / Mostrar en la carpeta / Más", async () => {
    const api = escritorio();
    const onCerrar = vi.fn();
    await montar(ESTADOS.lista, "bloque", onCerrar);
    expect(host.textContent).toContain("HSVG2026_Frecuencias_07_11_26.xlsx");
    expect(host.textContent).toContain("Guardado");
    expect(host.textContent).toContain("48 KB");
    expect(host.textContent).toContain("Entregables\\Procesamiento");
    expect(host.querySelector(".pulso-entregable-tile")?.textContent).toBe("XLSX");
    await act(async () => { boton("Abrir")?.click(); });
    expect(api.abrirArchivo).toHaveBeenCalledWith(GUARDADO);
    await act(async () => { boton("Mostrar en la carpeta")?.click(); });
    expect(api.mostrarEnCarpeta).toHaveBeenCalledWith(GUARDADO);
    expect(boton("Finder")).toBeNull();
    await act(async () => { boton("Más")?.click(); });
    expect(boton("Guardar como…")).not.toBeNull();
    await act(async () => { boton("Copiar ruta")?.click(); });
    expect(espia.copiar).toHaveBeenCalledWith(GUARDADO);
    await act(async () => { boton("Cerrar")?.click(); });
    expect(onCerrar).toHaveBeenCalled();
    expect(api.saveEntregableDialog).not.toHaveBeenCalled();
  });

  it("escritorio sin copia: la ruta de Descargas que avisó Electron abre y muestra ese archivo", async () => {
    const api = escritorio();
    const ruta = "C:\\Users\\ana\\Downloads\\Frecuencias.xlsx";
    await montar({ fase: "lista", titulo: "Frecuencias", rutaDescargada: ruta, archivos: [{ fileId: "f2", nombre: "Frecuencias.xlsx", formato: "xlsx" }] }, "bloque");
    expect(host.textContent).toContain("Descargado");
    expect(host.textContent).toContain("C:\\Users\\ana\\Downloads");
    await act(async () => { boton("Abrir")?.click(); });
    expect(api.abrirArchivo).toHaveBeenCalledWith(ruta);
  });

  it("navegador: sin Abrir ni carpeta; Descargado y «Descargar otra vez»", async () => {
    await montar({ fase: "lista", titulo: "Frecuencias", archivos: [{ fileId: "f3", nombre: "Frecuencias.xlsx", formato: "xlsx", tamano: 900 }] }, "bloque");
    expect(boton("Abrir")).toBeNull();
    expect(boton("Mostrar en la carpeta")).toBeNull();
    expect(boton("Más")).toBeNull();
    expect(host.textContent).toContain("Descargado");
    await act(async () => { boton("Descargar otra vez")?.click(); });
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/f3/download", "Frecuencias.xlsx");
  });

  it("archivo armado en el front: sin «Guardar como…» y «Descargar otra vez» lo baja de su blob", async () => {
    escritorio();
    const crear = vi.fn(() => "blob:local-csv");
    const original = URL.createObjectURL;
    URL.createObjectURL = crear;
    try {
      const blob = new Blob(["a,b"], { type: "text/csv" });
      await montar({ fase: "lista", titulo: "Personas", archivos: [{ fileId: "local-9", nombre: "personas.csv", formato: "csv", tamano: 3, local: blob }] }, "bloque");
      expect(host.textContent).toContain("Descargado");
      // Sin ruta avisada no hay Abrir ni carpeta, y sin backend no hay Guardar como…
      expect(boton("Más")).toBeNull();
      await act(async () => { boton("Descargar otra vez")?.click(); });
      expect(crear).toHaveBeenCalledWith(blob);
      expect(espia.descargar).toHaveBeenCalledWith("blob:local-csv", "personas.csv");
    } finally {
      URL.createObjectURL = original;
    }
  });

  it("el aviso de guardado se lee como nota junto al archivo", async () => {
    const aviso = "La ruta pasa de 240 caracteres: el archivo no se copió junto al proyecto.";
    await montar({ fase: "lista", titulo: "Frecuencias", archivos: [{ fileId: "f4", nombre: "F.xlsx", formato: "xlsx", avisoGuardado: aviso }] }, "bloque");
    expect(host.querySelector(".pulso-entregable-nota")?.textContent).toBe(aviso);
  });

  it("fila: mini-ícono y solo Abrir / Mostrar en la carpeta", async () => {
    escritorio();
    await montar(ESTADOS.lista, "fila");
    expect(host.querySelector(".pulso-entregable-tile[data-chico='true']")).not.toBeNull();
    expect(boton("Abrir")).not.toBeNull();
    expect(boton("Mostrar en la carpeta")).not.toBeNull();
    expect(boton("Más")).toBeNull();
  });
});

describe("fallo", () => {
  it("causa, código copiable y Reintentar neutro; ✕ cierra", async () => {
    const reintentar = vi.fn();
    const onCerrar = vi.fn();
    await montar({ ...ESTADOS.fallo, reintentar } as EstadoGeneracion, "bloque", onCerrar);
    expect(host.textContent).toContain("No hay base activa.");
    expect(host.querySelector(".pulso-entregable-codigo")?.textContent).toBe("E_ANALITICA_SIN_BASE");
    await act(async () => { boton("Copiar el código")?.click(); });
    expect(espia.copiar).toHaveBeenCalledWith("E_ANALITICA_SIN_BASE");
    const r = boton("Reintentar");
    expect(r?.className).toContain("pulso-entregable-texto");
    await act(async () => { r?.click(); });
    expect(reintentar).toHaveBeenCalled();
    await act(async () => { boton("Cerrar")?.click(); });
    expect(onCerrar).toHaveBeenCalled();
  });

  it("fila: el error va en la misma fila, con Reintentar", async () => {
    await montar(ESTADOS.fallo, "fila");
    const el = host.querySelector("[data-entregable-forma='fila']");
    expect(el?.textContent).toContain("No hay base activa.");
    expect(boton("Reintentar")).not.toBeNull();
  });

  it("fila: la causa recortada se lee entera en el `title`, no el código", async () => {
    await montar(ESTADOS.fallo, "fila");
    const texto = host.querySelector(".pulso-entregable-fila-texto");
    expect(texto?.getAttribute("title")).toBe("No hay base activa.");
    expect(host.innerHTML).not.toContain("E_ANALITICA_SIN_BASE");
  });
});

describe("hoja de estilos", () => {
  const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "entregables.css"), "utf8");

  it("con movimiento reducido la línea indeterminada se detiene", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*\.pulso-barra-avance--indeterminada > span\s*\{\s*animation: none;/);
  });

  /** Cuerpo de la primera regla cuyo selector es exactamente `selector`. */
  function regla(selector: string): string {
    const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const i = limpio.indexOf(`${selector} {`);
    expect(i, `no hay regla para ${selector}`).toBeGreaterThanOrEqual(0);
    return limpio.slice(i, limpio.indexOf("}", i));
  }

  it("H1: el bloque tiene alto propio en cualquier padre (no crece en una columna flex)", () => {
    const bloque = regla('.pulso-entregable[data-entregable-forma="bloque"]');
    expect(bloque).toMatch(/flex:\s*0 0 auto;/);
    expect(bloque).toMatch(/align-self:\s*stretch;/);
    expect(bloque).not.toMatch(/flex:\s*1\b|flex-grow:\s*[1-9]|height:\s*100%/);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/data-entregable-forma="bloque"\][^{]*\{[^}]*flex:\s*1/);
  });

  it("H4: botones de texto, íconos, cerrar, menú y bandeja tienen anillo de foco visible", () => {
    const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const m = /((?:[^{}]*:focus-visible,?\s*)+)\{([^}]*)\}/.exec(limpio.slice(limpio.indexOf(".pulso-entregable .pulso-button:focus-visible")));
    expect(m).not.toBeNull();
    const [, selectores, cuerpo] = m ?? ["", "", ""];
    for (const s of [
      ".pulso-entregable .pulso-button:focus-visible",
      ".pulso-entregable-bandeja .pulso-button:focus-visible",
      ".pulso-entregable-cerrar:focus-visible",
      ".pulso-entregable-menu-item:focus-visible",
      ".pulso-entregable-bandeja-boton:focus-visible",
    ]) expect(selectores).toContain(s);
    // Un solo anillo en toda la app (317d53c95): el del kit, `var(--mov-foco)`, y no un halo propio.
    expect(cuerpo).toMatch(/outline:\s*var\(--mov-foco\)/);
    // Más específico que el `box-shadow: none` de los botones neutros (0,2,0).
    expect(".pulso-entregable .pulso-button:focus-visible".match(/[.:]/g)?.length).toBeGreaterThan(2);
  });

  it("el filete de los metadatos viaja con el dato anterior y la sigla no se parte", () => {
    expect(regla(".pulso-entregable-meta > :not(:last-child)")).toMatch(/border-right:/);
    expect(css).not.toMatch(/\.pulso-entregable-meta > \* \+ \*/);
    expect(regla(".pulso-entregable-tile")).toMatch(/white-space:\s*nowrap/);
  });

  it("fila: en curso, lista y fallo miden lo mismo (la QA midió 28, 34 y 28 px con `min-height`)", () => {
    const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const fila = regla('.pulso-entregable[data-entregable-forma="fila"]');
    const alto = Number(/(?:^|[\s;{])height:\s*(\d+)px;/.exec(fila)?.[1]);
    expect(alto, "la fila declara un alto fijo en px").toBeGreaterThan(0);
    expect(fila).not.toMatch(/min-height|max-height/);
    expect(fila).toMatch(/box-sizing:\s*border-box/);
    // Ninguna fase cambia la caja: ni alto, ni relleno, ni borde, ni interlineado.
    const porFase = Array.from(limpio.matchAll(/\.pulso-entregable\[data-entregable-forma="fila"\]\[data-entregable-fase="[a-z_]+"\]\s*\{([^}]*)\}/g), (m) => m[1]);
    expect(porFase.length).toBeGreaterThan(0);
    for (const cuerpo of porFase) expect(cuerpo).not.toMatch(/(?:^|[\s;])(?:height|min-height|max-height|padding[a-z-]*|border(?:-[a-z]+)*-width|border|line-height)\s*:/);
    // Lo más alto que lleva cada fase cabe en ese alto: el mini-ícono de la lista y el ícono de Reintentar.
    const tileChico = Number(/height:\s*(\d+)px/.exec(regla('.pulso-entregable-tile[data-chico="true"]'))?.[1]);
    expect(tileChico).toBeGreaterThan(0);
    expect(tileChico).toBeLessThanOrEqual(alto);
    const tokens = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../app/tokens.css"), "utf8");
    const control = Number(/--pulso-control-height-sm:\s*(\d+)px/.exec(tokens)?.[1]);
    expect(control).toBeGreaterThan(0);
    expect(control).toBeLessThanOrEqual(alto);
  });

  it("fila: su texto no impone ancho a la celda ni encoge a sus hermanos (Monitoreo › Salidas, 463 → 0 px)", () => {
    // La causa va en una línea (`nowrap`). Si su ancho al medir la celda es el de la frase entera, una columna
    // `auto` de la fila se ensancha hasta dejar en 0 px la columna del texto vecino. Aporta un ancho fijo y
    // modesto, crece con `flex-grow` y se recorta con elipsis.
    const texto = regla(".pulso-entregable-fila-texto");
    expect(texto).toMatch(/white-space:\s*nowrap/);
    expect(texto, "ancho fijo al medir la celda").toMatch(/(?:^|[\s;{])width:\s*\d+(?:ch|px|em|rem);/);
    expect(texto).toMatch(/min-width:\s*0;/);
    expect(texto).toMatch(/flex:\s*1\b/);
    expect(texto).toMatch(/text-overflow:\s*ellipsis/);
    expect(texto).not.toMatch(/contain:|max-content|fit-content/);
    // En curso (rejilla) ocupa el ancho de la fila sin aportarlo: sólo porcentajes.
    const enCurso = regla('.pulso-entregable[data-entregable-forma="fila"][data-entregable-fase="en_curso"] > .pulso-entregable-fila-texto');
    expect(enCurso).toMatch(/min-width:\s*100%/);
    expect(enCurso).toMatch(/max-width:\s*100%/);
    expect(enCurso).not.toMatch(/(?:^|[\s;{])width:/);
  });

  it("anclada: cuelga del eje del botón (`--pulso-entregable-eje`), sin salirse del ancla", () => {
    const fin = regla('.pulso-entregable[data-entregable-forma="anclada"]');
    expect(fin).toMatch(/right:\s*max\(0px,\s*var\(--pulso-entregable-eje,\s*0px\)\)/);
    const inicio = regla('.pulso-entregable[data-entregable-forma="anclada"][data-entregable-alinear="inicio"]');
    expect(inicio).toMatch(/right:\s*auto/);
    expect(inicio).toMatch(/left:\s*max\(0px,\s*var\(--pulso-entregable-eje,\s*0px\)\)/);
  });

  it("el contenedor que recibe el foco lleva el anillo del kit", () => {
    expect(regla(".pulso-entregable:focus-visible")).toMatch(/outline:\s*var\(--mov-foco\)/);
  });

  it("no anima nada propio: la única animación es la de la línea del kit", () => {
    const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sinComentarios).not.toMatch(/@keyframes/);
    expect(sinComentarios.match(/animation\s*:/g) ?? []).toHaveLength(1);
  });
});

describe("ver sin entregar y alineación de la anclada", () => {
  const SIN_DESCARGAR: EstadoGeneracion = {
    fase: "lista", titulo: "Imagen de una ficha", rutaDescargada: null, sinDescargar: true,
    archivos: [{ fileId: "png1", nombre: "Ficha.png", formato: "png", tamano: 2048 }],
  };

  it("bloque: dice «Listo» (no «Descargado») y ofrece «Descargar», no «Descargar otra vez»", async () => {
    await montar(SIN_DESCARGAR, "bloque");
    expect(host.querySelector(".pulso-entregable-ok")?.textContent).toBe("Listo");
    expect(host.textContent).not.toContain("Descargado");
    expect(boton("Descargar")).not.toBeNull();
    expect(boton("Descargar otra vez")).toBeNull();
    await act(async () => { boton("Descargar")?.click(); });
    expect(espia.descargar).toHaveBeenCalledWith("/api/files/png1/download", "Ficha.png");
  });

  it("fila: también dice «Listo» y el ícono se llama «Descargar»", async () => {
    await montar(SIN_DESCARGAR, "fila");
    expect(host.querySelector(".pulso-entregable-fila-texto")?.textContent).toBe("Listo");
    expect(boton("Descargar")).not.toBeNull();
  });

  it("anclada: `alinear=\"inicio\"` se declara y su regla la abre hacia la derecha; por defecto no se escribe", async () => {
    await act(async () => { root.render(<ContenedorEntregable estado={ESTADOS.lista} forma="anclada" alinear="inicio" onCerrar={() => undefined} />); });
    expect(host.querySelector("[data-entregable-forma='anclada']")?.getAttribute("data-entregable-alinear")).toBe("inicio");
    await act(async () => { root.render(<ContenedorEntregable estado={ESTADOS.lista} forma="anclada" onCerrar={() => undefined} />); });
    expect(host.querySelector("[data-entregable-forma='anclada']")?.hasAttribute("data-entregable-alinear")).toBe(false);
    // En bloque la alineación no aplica.
    await act(async () => { root.render(<ContenedorEntregable estado={ESTADOS.lista} forma="bloque" alinear="inicio" onCerrar={() => undefined} />); });
    expect(host.querySelector("[data-entregable-alinear]")).toBeNull();
    const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "entregables.css"), "utf8");
    const regla = /\.pulso-entregable\[data-entregable-forma="anclada"\]\[data-entregable-alinear="inicio"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(regla).toMatch(/left:\s*max\(0px/);
    expect(regla).toMatch(/right:\s*auto/);
  });
});

/** Rectángulo fijo para un elemento (happy-dom no hace layout). */
function caja(el: HTMLElement, left: number, right: number) {
  Object.defineProperty(el, "getBoundingClientRect", { configurable: true, value: () => ({ left, right, top: 0, bottom: 30, width: right - left, height: 30, x: left, y: 0 }) });
  Object.defineProperty(el, "clientLeft", { configurable: true, value: 0 });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: right - left });
}

describe("anclada: eje del botón", () => {
  function Banco({ estado, alinear, conEje = true }: { estado: EstadoGeneracion; alinear?: "inicio" | "fin"; conEje?: boolean }) {
    const eje = { current: document.getElementById("disparador") };
    return <ContenedorEntregable estado={estado} forma="anclada" alinear={alinear} eje={conEje ? eje : undefined} onCerrar={() => undefined} />;
  }

  beforeEach(() => {
    // El bloque contenedor de la anclada es su padre posicionado; happy-dom no lo calcula.
    Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get() { return (this as HTMLElement).parentElement; } });
  });
  afterEach(() => {
    delete (HTMLElement.prototype as { offsetParent?: unknown }).offsetParent;
  });

  it("publica la distancia del borde del ancla al del botón; sin `eje`, nada (queda al borde)", async () => {
    // Codificación a 1440: barra de 260 a 1412 y "Matriz para el cliente" terminando en 1139.
    caja(host, 260, 1412);
    const disparador = document.createElement("button");
    disparador.id = "disparador";
    document.body.appendChild(disparador);
    caja(disparador, 980, 1139);
    await act(async () => { root.render(<Banco estado={ESTADOS.lista} />); });
    const el = host.querySelector<HTMLElement>("[data-entregable-forma='anclada']");
    expect(el?.style.getPropertyValue("--pulso-entregable-eje")).toBe("273px");

    await act(async () => { root.render(<Banco estado={ESTADOS.lista} alinear="inicio" />); });
    expect(host.querySelector<HTMLElement>("[data-entregable-forma='anclada']")?.style.getPropertyValue("--pulso-entregable-eje")).toBe("720px");

    act(() => root.unmount());
    root = createRoot(host);
    await act(async () => { root.render(<Banco estado={ESTADOS.lista} conEje={false} />); });
    expect(host.querySelector<HTMLElement>("[data-entregable-forma='anclada']")?.style.getPropertyValue("--pulso-entregable-eje")).toBe("");
  });

  it("si el botón deja el documento conserva la última medida", async () => {
    caja(host, 0, 1000);
    const disparador = document.createElement("button");
    disparador.id = "disparador";
    document.body.appendChild(disparador);
    caja(disparador, 800, 900);
    const eje = { current: disparador as HTMLElement | null };
    const Con = () => <ContenedorEntregable estado={ESTADOS.lista} forma="anclada" eje={eje} onCerrar={() => undefined} />;
    await act(async () => { root.render(<Con />); });
    disparador.remove();
    await act(async () => { root.render(<Con />); });
    expect(host.querySelector<HTMLElement>("[data-entregable-forma='anclada']")?.style.getPropertyValue("--pulso-entregable-eje")).toBe("100px");
  });
});

describe("enfocar al aparecer", () => {
  it("bloque: con `enfocar` toma el foco una vez al aparecer y no vuelve a robarlo al cambiar de fase", async () => {
    const otro = document.createElement("button");
    document.body.appendChild(otro);
    await act(async () => { root.render(<ContenedorEntregable estado={{ fase: "inactiva" }} forma="bloque" enfocar onCerrar={() => undefined} />); });
    expect(document.activeElement).not.toBe(host.querySelector("[data-entregable-fase]"));
    await act(async () => { root.render(<ContenedorEntregable estado={ESTADOS.indeterminada} forma="bloque" enfocar onCerrar={() => undefined} />); });
    const el = host.querySelector<HTMLElement>("[data-entregable-fase]");
    expect(el?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(el);
    otro.focus();
    await act(async () => { root.render(<ContenedorEntregable estado={ESTADOS.lista} forma="bloque" enfocar onCerrar={() => undefined} />); });
    expect(document.activeElement).toBe(otro);
  });

  it("sin `enfocar` no es enfocable ni toma el foco", async () => {
    await act(async () => { root.render(<ContenedorEntregable estado={ESTADOS.indeterminada} forma="bloque" onCerrar={() => undefined} />); });
    const el = host.querySelector<HTMLElement>("[data-entregable-fase]");
    expect(el?.hasAttribute("tabindex")).toBe(false);
    expect(document.activeElement).not.toBe(el);
  });
});
