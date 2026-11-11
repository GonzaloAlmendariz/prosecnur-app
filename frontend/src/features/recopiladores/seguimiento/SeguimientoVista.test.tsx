// Correo > Seguimiento pintado con payloads de ejemplo del contrato: las tres
// pestañas con cero, pocas y varias campañas; C1 declarado en el markup; los
// pasos de la prueba con su estado; las cifras con su base; la promesa de que
// la app no envía; y ninguna palabra del motor en pantalla.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand";

import { normalizeOpciones } from "../../../api/mailchimpSync";
import { normalizeEstadoSeguimiento, normalizeResultadosDeHorario, type EstadoSeguimiento } from "../../../api/mailSeguimiento";
import { jergaVisibleEn } from "../../../lib/qa/textoVisible";

// El render en servidor lee el estado inicial del store; se le da el actual.
vi.mock("zustand", async (importOriginal) => {
  const real = await importOriginal<typeof import("zustand")>();
  const create = <T,>(init: StateCreator<T, [], []>) => {
    const api = real.createStore<T>()(init);
    api.getInitialState = api.getState;
    return Object.assign(<U,>(selector: (s: T) => U) => real.useStore(api, selector), api);
  };
  return { ...real, create };
});

const { QuienRespondio } = await import("./QuienRespondio");
const { PruebaDeHorarios } = await import("./PruebaDeHorarios");
const { CorreoPersonal } = await import("./CorreoPersonal");
const { TarjetaDeRonda } = await import("./ResultadosDeHorarios");
const { SeguimientoShell } = await import("./SeguimientoShell");
const { useSeguimientoStore } = await import("./store");

const aqui = path.dirname(fileURLToPath(import.meta.url));

function campana(i: number, extra: Record<string, unknown> = {}) {
  return {
    campaign_id: `c${i}`, nombre: `Público ${i}`, publico: `Público ${i}`,
    recordatorios: [{ send_id: "r1", etiqueta: "Recordatorio 1" }, { send_id: "r2", etiqueta: "Recordatorio 2" }],
    encuesta: i % 2 ? "123456" : "", contactos: true, personas: 1000 * i, con_enlace: 990 * i,
    respondieron: i === 1 ? null : 400 * i, a_medias: i === 1 ? null : 12, leido_en: i === 1 ? "" : "2026-11-11T15:00:00Z",
    archivados: false, grupos: { A: 495 * i, B: 495 * i }, segundo_correo: { personal: 80, control: 20, cargados: 78, rechazados: 2 },
    ...extra,
  };
}

function estado(n: number, horario: Record<string, unknown> = {}, correo: Record<string, unknown> = {}): EstadoSeguimiento {
  const ids = Array.from({ length: n }, (_, i) => `c${i + 1}`);
  return normalizeEstadoSeguimiento({
    config: { list_id: n ? "abc123" : "", tag: "Respondió", archivar: true, antes_de_envio: { activo: true, minutos: 30 }, ultima_at: "" },
    campanas: ids.map((_, i) => campana(i + 1)),
    horario: {
      campanas: ids, oficina: ids.slice(0, 1), rondas: n ? [{ ronda: 1, etiqueta: "Recordatorio 1" }, { ronda: 2, etiqueta: "Recordatorio 2" }] : [],
      plan: ids.flatMap((id) => [{ ronda: 1, campaign_id: id, grupo: "A", programado: "2026-11-12T09:30", mailchimp_id: "abc123" }, { ronda: 1, campaign_id: id, grupo: "B", programado: "2026-11-12T20:00" }]),
      avisos: n ? [{ tipo: "falta_hora", ronda: 2, campaign_id: "c1", texto: "Recordatorio 2, Público 1: falta la hora de un grupo." }] : [],
      sorteado_en: n ? "2026-11-11T10:00:00Z" : "", semilla: n ? 20261111 : null, etiquetado_en: "",
      ...horario,
    },
    correo_personal: {
      proporcion: 0.8, campanas: ids.map((id, i) => ({ campaign_id: id, publico: `Público ${i + 1}`, columna: i ? "" : "correo2", candidatas: i === 2 ? [] : [{ key: "correo2", label: "Correo personal" }] })),
      ...correo,
    },
  });
}

const OPCIONES = normalizeOpciones({
  mailchimp: { connected: true, audiences: [{ id: "abc123", name: "Acreditación", member_count: 45078 }] },
  surveymonkey: { connected: true, surveys: [{ id: "123456", title: "Egresados 2026", response_count: 900 }] },
});

function pintar(nodo: React.ReactNode, e: EstadoSeguimiento | null) {
  useSeguimientoStore.setState({ estado: e, carga: e ? "lista" : "cargando", opciones: OPCIONES, error: "", errorOpciones: "" });
  return renderToStaticMarkup(<MemoryRouter>{nodo}</MemoryRouter>);
}

const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ");

beforeEach(() => useSeguimientoStore.getState().reset());

describe("Quién respondió", () => {
  it.each([0, 1, 3])("con %i campañas declara su superficie y mantiene el marco", (n) => {
    const html = pintar(<QuienRespondio />, estado(n));
    expect(html).toContain('data-qa-geometry-group="material-campo/correo/seguimiento/respondieron/acciones"');
    expect(html).toContain('data-qa-geometry-contract="equal"');
    expect(html).toContain("Actualizar todas las campañas");
    expect(html).toContain("Archivar en Mailchimp a quienes respondieron");
    expect(html).toContain("Actualizar antes de cada envío programado");
    expect(html).toContain('role="switch"');
    if (!n) expect(texto(html)).toContain("El estudio no tiene campañas de correo en Mailchimp.");
  });

  it("dice las cifras con su base y distingue sin leer de cero", () => {
    const t = texto(pintar(<QuienRespondio />, estado(3)));
    expect(t).toContain("800 (40.4 %)");
    expect(t).toContain("Sin leer");
    expect(t).toContain("Falta la encuesta");
  });

  it("mientras lee, una carga y no un vacío", () => {
    expect(texto(pintar(<QuienRespondio />, null))).toContain("Leyendo las campañas del estudio");
  });
});

describe("Prueba de horarios", () => {
  it("muestra los seis pasos en orden con su estado", () => {
    const html = pintar(<PruebaDeHorarios />, estado(2));
    const t = texto(html);
    const orden = ["Públicos y horario de oficina", "Asignación al azar de los grupos", "Etiquetas en Mailchimp", "Plan de recordatorios", "Borradores por grupo", "Resultados"]
      .map((p) => t.indexOf(p));
    expect(orden.every((i) => i >= 0)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
    expect(html).toContain('data-qa-geometry-group="material-campo/correo/seguimiento/horarios/pasos"');
    // Asignados y sin etiquetas: el siguiente paso es el 3.
    expect(html).toMatch(/rec-seg-paso is-sigue"[^>]*aria-labelledby="rec-seg-paso-etiquetas"/);
    expect(t).toContain("Asignados el");
    expect(t).toContain("Volver a asignar");
    expect(t).toContain("Proponer plan cruzado");
    expect(t).toContain("Recordatorio 2, Público 1: falta la hora de un grupo.");
    expect(html).toContain('aria-label="Abrir en Mailchimp"');
    expect(t).toContain("Leer envíos de Mailchimp");
    expect(t).toContain("La app no envía: revisa, programa y envía en Mailchimp.");
  });

  it("sin públicos, el primer paso es el que sigue y el plan lo dice", () => {
    const t = texto(pintar(<PruebaDeHorarios />, estado(0)));
    expect(t).toContain("Marca primero los públicos de la prueba.");
    expect(t).toContain("Los resultados aparecen después de asignar los grupos y del primer envío.");
  });

  it("una tarjeta de resultados lee A contra B con su base, la diferencia y el veredicto", () => {
    const r = normalizeResultadosDeHorario({
      rondas: [{
        ronda: 1, etiqueta: "Recordatorio 1", comparable: true, en_curso: true, horizonte_h: 24, horaA: "9:30 a. m.", horaB: "8:00 p. m.",
        fecha: "jueves 12 de noviembre",
        publicos: [
          { publico: "Público 1", nA: 18648, xA: 784, pctA: 4.2, nB: 18600, xB: 600, pctB: 3.23, dif_pp: 0.97, dif_li: 0.6, dif_ls: 1.4, veredicto: "A", horaA: "9:30 a. m.", horaB: "8:00 p. m." },
          { publico: "Público 2", nA: 40, xA: 4, pctA: 10, nB: 40, xB: 2, pctB: 5, dif_pp: 5, dif_li: -6, dif_ls: 16, veredicto: "empate", pocos_casos: true },
        ],
        total: { nA: 18688, xA: 788, pctA: 4.22, nB: 18640, xB: 602, pctB: 3.23, dif_pp: 0.99, dif_li: 0.6, dif_ls: 1.4, veredicto: "A" },
        cmh: { p: 0.0001, p_txt: "p < 0.001" }, ganador: "A",
        excluidos: [{ publico: "Público 3", motivo: "los dos grupos tuvieron la misma hora" }],
        lectura: "A las 24 horas de cada envío, el grupo A (9:30 a. m.) completó 4.22 % y el grupo B (8:00 p. m.) 3.23 %: ganaron las 9:30 a. m. (p < 0.001).",
      }],
    });
    const t = texto(pintar(<TarjetaDeRonda ronda={r.rondas[0]} />, estado(2)));
    expect(t).toContain("Recordatorio 1, jueves 12 de noviembre");
    expect(t).toContain("En curso");
    expect(t).toContain("4.22 %");
    expect(t).toContain("788 de 18,688");
    expect(t).toContain("4.20 % (784 de 18,648)");
    expect(t).toContain("+0.99 pp");
    expect(t).toContain("p < 0.001");
    expect(t).toContain("Gana el grupo A (9:30 a. m.)");
    expect(t).toContain("Sin diferencia clara");
    expect(t).toContain("Fuera de la comparación: Público 3 (los dos grupos tuvieron la misma hora).");
  });
});

describe("Correo personal", () => {
  it.each([0, 1, 3])("con %i campañas se marca opcional y declara sus pares", (n) => {
    const html = pintar(<CorreoPersonal />, estado(n));
    const t = texto(html);
    expect(t).toContain("Opcional");
    expect(html).toContain('data-qa-geometry-group="material-campo/correo/seguimiento/correo-personal/acciones"');
    expect(t).toContain("Cargar en Mailchimp");
    expect(t).toContain("Los correos que Mailchimp rechaza no se reintentan.");
    expect(t).toContain("Efecto del correo personal");
    if (n === 3) expect(t).toContain("Sin columnas con correos");
  });

  it("80 % por defecto y el efecto pide primero la asignación", () => {
    const html = pintar(<CorreoPersonal />, estado(1));
    expect(html).toContain('value="80"');
    expect(texto(html)).toContain("Asigna primero al azar.");
  });
});

describe("la sección entera", () => {
  it("publica su readiness, el rail de tres pestañas y el correo personal como opcional", () => {
    const html = pintar(<SeguimientoShell pestana="horarios" />, estado(1));
    expect(html).toContain('data-audit-ready="material-campo/correo/seguimiento/horarios"');
    expect(html).toContain('data-qa-geometry-group="material-campo/correo/seguimiento/horarios"');
    // El rail es de íconos: el nombre de cada pestaña va en su nombre accesible.
    expect(html).toMatch(/role="tab"[^>]*aria-label="Quién respondió/);
    // El correo personal va en el grupo "Opcional" del rail, sin texto de relleno.
    expect(html).toMatch(/data-rail-grupo="Opcional"[^]*aria-label="Correo personal"/);
    expect(html).toContain('aria-selected="true"');
    expect(texto(html)).toContain("Seguimiento");
  });

  it("sin el estado todavía, no se declara lista", () => {
    const html = pintar(<SeguimientoShell pestana="respondieron" />, null);
    expect(html).not.toContain('data-audit-ready="material-campo/correo/seguimiento/respondieron"');
  });
});

describe("sin jerga en pantalla", () => {
  const archivos = fs.readdirSync(aqui).filter((f) => /\.tsx$/.test(f) && !f.includes(".test."));
  it("el guardián encuentra los archivos que vigila", () => {
    expect(archivos.length).toBeGreaterThan(6);
  });
  it.each(archivos)("%s", (archivo) => {
    const fuente = fs.readFileSync(path.join(aqui, archivo), "utf8");
    expect(jergaVisibleEn(fuente, ["token", "payload", "endpoint", "backend", "job", "sorteo aleatorio", "cmh", "sorteo"])).toEqual([]);
  });
});
