/**
 * Control › Supervisión, rondas (T9): la lista con su estado, la migración de
 * la Ronda 1 sin guardar y los dos diálogos (Nueva ronda y Publicar).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { MonitoreoSource } from "../../../../../api/client";
import { DialogoNuevaRonda } from "./DialogoNuevaRonda";
import { DialogoPublicarRonda } from "./DialogoPublicarRonda";
import { RondasDeSupervision } from "./RondasDeSupervision";
import type { FilaDeRonda } from "./rondasModel";

// El portal se pinta en línea: el render estático no tiene `document`.
vi.stubGlobal("document", { body: {} });
vi.mock("react-dom", async (original) => ({ ...(await original<typeof import("react-dom")>()), createPortal: (nodo: unknown) => nodo }));

const RONDA = (numero: number, extra: Partial<FilaDeRonda> = {}): FilaDeRonda => ({
  numero, guardada: true, generadaEl: "2026-10-23T09:00:00", porcentaje: 20, semilla: 7, universo: 10, corte: "c",
  sorteados: 2, agregados: 0, casos: 2, publicadaEn: "", publicadaEl: "", lectura: "", leidaEl: "", ...extra,
});

function lista(rondas: FilaDeRonda[]) {
  return renderToStaticMarkup(
    <MemoryRouter><RondasDeSupervision rondas={rondas} actual={rondas.at(-1)?.numero ?? null} proxima={rondas.length + 1} nuevas={4}
      onElegir={() => {}} onNueva={() => {}} onPublicar={() => {}} onGuardada={() => {}} /></MemoryRouter>,
  ).replace(/<!-- -->/g, "");
}

describe("RondasDeSupervision", () => {
  it("cada ronda dice si está guardada o publicada y en qué pestaña; la guardada sin publicar lleva a Material (ADR 0125 A3)", () => {
    const html = lista([RONDA(1, { publicadaEn: "Ronda 1" }), RONDA(2)]);
    expect(html).toContain("Publicada en &quot;Ronda 1&quot;");
    expect(html).toContain("Guardada");
    expect(html.match(/Armar la base en Material/g)).toHaveLength(1);
    expect(html).toContain("/material-campo?modo=supervision&amp;campana=supervision.ronda-2");
    expect(html).toContain("4 efectivas nuevas desde la última");
    expect(html).toContain('aria-pressed="true"');
  });

  it("la Ronda 1 sin guardar se ofrece guardar tal cual y bloquea la nueva", () => {
    const html = lista([RONDA(1, { guardada: false, porcentaje: null, universo: 24 })]);
    expect(html).toContain("Guardar la Ronda 1 tal cual");
    expect(html).toContain("Ronda 1 sin guardar");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Nueva ronda/);
    expect(html).not.toContain("Armar la base en Material");
  });

  it('sin efectivas nuevas "Nueva ronda" se apaga y dice por qué (Gonzalo, 2026-10-27)', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><RondasDeSupervision rondas={[RONDA(1)]} actual={1} proxima={2} nuevas={0}
        onElegir={() => {}} onNueva={() => {}} onPublicar={() => {}} onGuardada={() => {}} /></MemoryRouter>,
    ).replace(/<!-- -->/g, "");
    const boton = /<button[^>]*>(?:(?!<\/button>).)*Nueva ronda<\/button>/.exec(html)?.[0] ?? "";
    expect(boton).toContain('disabled=""');
    expect(boton).toContain('aria-describedby="mon-sup-rondas-motivo"');
    expect(html).toMatch(/id="mon-sup-rondas-motivo"[^>]*>Sin efectivas nuevas desde la última ronda/);
    // Con nuevas, habilitado y sin motivo.
    expect(lista([RONDA(1)])).not.toMatch(/disabled=""[^>]*>(?:(?!<\/button>).)*Nueva ronda/);
  });

  it("los datos de la ronda van en piezas que se parten entre sí, no dentro", () => {
    const html = lista([RONDA(1, { casos: 9, universo: 360, porcentaje: null, semilla: 20261027 })]);
    expect(html).toContain('class="mon-sup-ronda-datos"');
    expect(html).toContain("<span>9 casos</span><span>de 360 efectivas</span>");
    expect(html).toContain("<span>semilla 20261027</span>");
  });

  it("con hoja y una ronda publicada ofrece leer resultados; marca la pestaña borrada y pinta el aviso", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><RondasDeSupervision rondas={[RONDA(1, { publicadaEn: "Ronda 1", lectura: "pestana_borrada" }), RONDA(2, { publicadaEn: "Ronda 2", lectura: "leida", leidaEl: "2026-10-24T09:00:00" })]}
        actual={2} proxima={3} nuevas={0} hojaConectada avisos={['La Ronda 1 se publicó en "Ronda 1", pero esa pestaña ya no está.']}
        onElegir={() => {}} onNueva={() => {}} onPublicar={() => {}} onGuardada={() => {}} /></MemoryRouter>,
    ).replace(/<!-- -->/g, "");
    expect(html).toContain("Leer resultados");
    expect(html).toContain("La pestaña &quot;Ronda 1&quot; ya no está");
    expect(html).toContain("Resultados leídos el");
    expect(html).toContain("pero esa pestaña ya no está");
    // Sin hoja no se ofrece leer.
    expect(lista([RONDA(1, { publicadaEn: "Ronda 1" })])).not.toContain("Leer resultados");
  });

  it("sin rondas explica de dónde sale la primera", () => {
    expect(lista([])).toContain("Todavía no hay rondas");
  });
});

describe("DialogoNuevaRonda", () => {
  const base = [
    { codigo: "P1", progres: "CGU1", enumerador: "Ana", categoria: "", fechaKobo: "", responseId: "", ronda: 1 },
    { codigo: "P2", progres: "", enumerador: "Ana", categoria: "", fechaKobo: "", responseId: "", ronda: null },
    { codigo: "P3", progres: "", enumerador: "Beto", categoria: "", fechaKobo: "", responseId: "", ronda: null },
  ];

  it("pinta las nuevas, el porcentaje y el reparto previo; avisa cuando es aproximado", () => {
    const html = renderToStaticMarkup(
      <DialogoNuevaRonda numero={2} base={base} nuevas={5} porcentajeInicial={50} onCerrar={() => {}} onHecha={() => {}} />,
    ).replace(/<!-- -->/g, "");
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Nueva ronda: Ronda 2");
    expect(html).toContain("efectivas nuevas desde la última ronda");
    expect(html).toContain('value="50"');
    expect(html).toContain("Reparto aproximado");
    expect(html).toContain("Generar la Ronda 2");
  });
});

describe("DialogoPublicarRonda", () => {
  const hoja = { id: "s", label: "Supervisión", enabled: true, role: "supervision" } as unknown as MonitoreoSource;

  it('avisa que se crea la pestaña "Ronda N" sin tocar otra y lista las preguntas', () => {
    const html = renderToStaticMarkup(
      <DialogoPublicarRonda numero={2} hoja={hoja} preguntas={[{ nombre: "p1", etiqueta: "¿Edad?" }]} onCerrar={() => {}} onIrAFuentes={() => {}} onHecha={() => {}} />,
    );
    expect(html).toContain("Se crea la pestaña &quot;Ronda 2&quot;");
    expect(html).toContain("No se toca ninguna otra pestaña");
    expect(html).toContain("¿Edad?");
    expect(html).toContain("Crear la pestaña &quot;Ronda 2&quot;");
  });

  it("sin hoja de supervisión lo dice y lleva a Fuentes", () => {
    const html = renderToStaticMarkup(
      <DialogoPublicarRonda numero={2} hoja={null} preguntas={[]} onCerrar={() => {}} onIrAFuentes={() => {}} onHecha={() => {}} />,
    );
    expect(html).toContain("No hay hoja de supervisión conectada");
    expect(html).toContain("Ir a Fuentes");
  });
});
