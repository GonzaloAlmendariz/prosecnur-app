/**
 * Control › Supervisión, rondas (T9): la lista con su estado, la migración de
 * la Ronda 1 sin guardar y los dos diálogos (Nueva ronda y Publicar).
 */
import { renderToStaticMarkup } from "react-dom/server";
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
    <RondasDeSupervision rondas={rondas} actual={rondas.at(-1)?.numero ?? null} proxima={rondas.length + 1} nuevas={4}
      onElegir={() => {}} onNueva={() => {}} onPublicar={() => {}} onGuardada={() => {}} />,
  ).replace(/<!-- -->/g, "");
}

describe("RondasDeSupervision", () => {
  it("cada ronda dice si está guardada o publicada y en qué pestaña; sólo la guardada sin publicar ofrece publicar", () => {
    const html = lista([RONDA(1, { publicadaEn: "Ronda 1" }), RONDA(2)]);
    expect(html).toContain("Publicada en «Ronda 1»");
    expect(html).toContain("Guardada");
    expect(html.match(/Publicar en el Sheets/g)).toHaveLength(1);
    expect(html).toContain("4 efectivas nuevas desde la última");
    expect(html).toContain('aria-pressed="true"');
  });

  it("la Ronda 1 sin guardar se ofrece guardar tal cual y bloquea la nueva", () => {
    const html = lista([RONDA(1, { guardada: false, porcentaje: null, universo: 24 })]);
    expect(html).toContain("Guardar la Ronda 1 tal cual");
    expect(html).toContain("Ronda 1 sin guardar");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Nueva ronda/);
    expect(html).not.toContain("Publicar en el Sheets");
  });

  it("con hoja y una ronda publicada ofrece leer resultados; marca la pestaña borrada y pinta el aviso", () => {
    const html = renderToStaticMarkup(
      <RondasDeSupervision rondas={[RONDA(1, { publicadaEn: "Ronda 1", lectura: "pestana_borrada" }), RONDA(2, { publicadaEn: "Ronda 2", lectura: "leida", leidaEl: "2026-10-24T09:00:00" })]}
        actual={2} proxima={3} nuevas={0} hojaConectada avisos={["La Ronda 1 se publicó en «Ronda 1», pero esa pestaña ya no está."]}
        onElegir={() => {}} onNueva={() => {}} onPublicar={() => {}} onGuardada={() => {}} />,
    ).replace(/<!-- -->/g, "");
    expect(html).toContain("Leer resultados");
    expect(html).toContain("La pestaña «Ronda 1» ya no está");
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

  it("avisa que se crea la pestaña «Ronda N» sin tocar otra y lista las preguntas", () => {
    const html = renderToStaticMarkup(
      <DialogoPublicarRonda numero={2} hoja={hoja} preguntas={[{ nombre: "p1", etiqueta: "¿Edad?" }]} onCerrar={() => {}} onIrAFuentes={() => {}} onHecha={() => {}} />,
    );
    expect(html).toContain("Se crea la pestaña «Ronda 2»");
    expect(html).toContain("No se toca ninguna otra pestaña");
    expect(html).toContain("¿Edad?");
    expect(html).toContain("Crear la pestaña «Ronda 2»");
  });

  it("sin hoja de supervisión lo dice y lleva a Fuentes", () => {
    const html = renderToStaticMarkup(
      <DialogoPublicarRonda numero={2} hoja={null} preguntas={[]} onCerrar={() => {}} onIrAFuentes={() => {}} onHecha={() => {}} />,
    );
    expect(html).toContain("No hay hoja de supervisión conectada");
    expect(html).toContain("Ir a Fuentes");
  });
});
