// La pestaña Contactos pintada con payloads de ejemplo del contrato (ADR 0112
// §4): 0, pocos y muchos contactos; C1 declarado en el markup; vacíos con su
// causa y su arreglo; y ninguna palabra de la plomería en pantalla.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand";

import {
  normalizarPaginaDeContactos,
  normalizarPerfilDeContactos,
  type PaginaDeContactos,
  type PerfilDeContactos,
} from "../../../../api/mailContactos";
import { jergaVisibleEn } from "../../../../lib/qa/textoVisible";

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
const { ContactosVista } = await import("./ContactosVista");
const { useContactosStore } = await import("./store");

const aqui = path.dirname(fileURLToPath(import.meta.url));

function pagina(total: number, extra: Partial<Record<string, unknown>> = {}): PaginaDeContactos {
  return normalizarPaginaDeContactos({
    total,
    page: 1,
    per_page: 50,
    columnas: [{ key: "carrera", label: "Carrera" }, { key: "sexo", label: "Sexo" }, { key: "anio", label: "Año de egreso" }],
    rows: Array.from({ length: Math.min(total, 50) }, (_, i) => ({
      fila: i + 1,
      email: `persona${i + 1}@example.org`,
      nombre: `Persona ${i + 1}`,
      estado: i === 0 ? "repetido" : "efectivo",
      tiene_enlace: i % 2 === 0,
      respondio: i % 3 === 0,
      valores: { carrera: i % 2 ? "Derecho" : "Medicina", sexo: i % 2 ? "F" : "M", anio: "2020" },
    })),
    resumen: {
      importados: total, efectivos: Math.max(0, total - 1), sin_correo: 0, correo_invalido: 0,
      repetidos: total ? 1 : 0, con_enlace: Math.ceil(total / 2), respondieron: total ? Math.ceil(total / 3) : null,
      leido_en: total ? "2026-10-22T14:30:00Z" : null,
    },
    ...extra,
  });
}

function perfil(categorias: number, base: number, extra: Partial<Record<string, unknown>> = {}): PerfilDeContactos {
  const cats = Array.from({ length: categorias }, (_, i) => ({
    valor: `Carrera ${i + 1}`, n: 0, pct: null, respondieron: 0, tasa: null,
  }));
  // Reparte la base entre las categorías y deja 2 sin dato.
  let resto = base - 2;
  cats.forEach((c, i) => {
    c.n = i === cats.length - 1 ? resto : Math.floor((base - 2) / categorias);
    resto -= i === cats.length - 1 ? 0 : c.n;
    c.respondieron = Math.floor(c.n / 3);
  });
  return normalizarPerfilDeContactos({
    base,
    control: ["carrera", "sexo"],
    candidatas: [
      { key: "carrera", label: "Carrera", distintos: categorias, tipo: categorias > 12 ? "muchas" : "categorica" },
      { key: "sexo", label: "Sexo", distintos: 2, tipo: "categorica" },
      { key: "anio", label: "Año de egreso", distintos: 5, tipo: "categorica" },
    ],
    variables: [
      { key: "carrera", label: "Carrera", categorias: cats, sin_dato: { n: 2, pct: null } },
      {
        key: "sexo", label: "Sexo",
        categorias: [{ valor: "F", n: base - Math.floor(base / 2), respondieron: 1 }, { valor: "M", n: Math.floor(base / 2), respondieron: 1 }],
        sin_dato: { n: 0 },
      },
    ],
    cruce: { a: "carrera", b: "sexo", filas: ["Carrera 1", "Carrera 2"], columnas: ["F", "M"], celdas: [[2, 1], [1, 0]] },
    respuestas_leidas: true,
    ...extra,
  });
}

function pintar(estado: Partial<ReturnType<typeof useContactosStore.getState>>): string {
  useContactosStore.setState({
    campana: "egresados",
    perfilCarga: "lista",
    listaCarga: "lista",
    ...estado,
  });
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/material-campo?modo=correo&campana=correo.egresados&seccion=correo&pestana=contactos"]}>
      <ContactosVista campaignId="egresados" onIrAImportar={() => undefined} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useContactosStore.getState().abrirCampana(null);
});

describe("pestaña Contactos", () => {
  it("cero contactos: el vacío dice la causa y lleva a importar", () => {
    const html = pintar({ lista: pagina(0, { cargados: false }), perfil: null, perfilCarga: "lista" });
    expect(html).toContain("Esta campaña todavía no tiene contactos");
    expect(html).toContain("Importar la lista");
    expect(html).not.toContain("contactos-perfil");
  });

  it("pocos contactos: resumen par, distribuciones, cruce con totales y lista", () => {
    const html = pintar({ lista: pagina(5), perfil: perfil(2, 4) });
    expect(html).toContain('data-qa-geometry-group="material-campo/correo/contactos/resumen"');
    expect(html).toContain('data-qa-geometry-contract="equal"');
    expect(html).toContain('data-qa-geometry-group="material-campo/correo/contactos/distribuciones"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Sin dato");
    expect(html).toContain("Respondieron");
    // El porcentaje siempre con su base.
    expect(html).toContain("base 4");
    expect(html).toMatch(/<tfoot>.*Total.*<\/tfoot>/s);
    expect(html).toContain("persona2@example.org");
    expect(html).toContain("1–5 de 5");
    expect(html).toContain("Enlace personal a la encuesta");
  });

  it("muchos contactos: cifras con coma de millares y doce categorías a la vista", () => {
    const html = pintar({ lista: pagina(5000), perfil: perfil(20, 4999) });
    expect(html).toContain("5,000");
    expect(html).toContain("Ver 8 categorías más");
    expect(html).toContain("1–50 de 5,000");
    expect(html).toContain("Página 1 de 100");
  });

  it("«Sin dato» filtra y «Otros» no", () => {
    const base = perfil(2, 4);
    base.variables[0].categorias.push({ valor: "Otros", n: 0, pct: null, respondieron: null, tasa: null, con_enlace: null, otros: true });
    const html = pintar({ lista: pagina(5), perfil: base, filtros: { carrera: [""] } });
    expect(html).toContain("Quitar el filtro Carrera: Sin dato");
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Carrera: Sin dato/);
    expect(html).toContain("is-otros");
  });

  it("sin variables elegidas: invita a elegirlas y no pinta cruce", () => {
    const html = pintar({ lista: pagina(5), perfil: perfil(2, 4, { control: [], variables: [], cruce: null }) });
    expect(html).toContain("Elegir variables de control");
    expect(html).not.toContain("contactos-cruce");
  });

  it("filtros que dejan la base en cero: lo dice y ofrece quitarlos", () => {
    const html = pintar({ lista: pagina(5), perfil: perfil(2, 0), filtros: { carrera: ["Carrera 1"] } });
    expect(html).toContain("Ningún contacto efectivo cumple todos los filtros a la vez");
    expect(html).toContain("Quitar el filtro Carrera: Carrera 1");
  });
});

describe("sin jerga en pantalla", () => {
  const archivos = fs.readdirSync(aqui).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
  it("el guardián encuentra los archivos que vigila", () => {
    expect(archivos.length).toBeGreaterThan(10);
  });
  it.each(archivos)("%s", (archivo) => {
    const fuente = fs.readFileSync(path.join(aqui, archivo), "utf8");
    expect(jergaVisibleEn(fuente, ["token", "custom variable", "variable personalizada", "t=", "payload", "endpoint", "backend"]))
      .toEqual([]);
  });

  it("ni en lo que se pinta", () => {
    const html = pintar({ lista: pagina(5), perfil: perfil(2, 4) }).replace(/<[^>]+>/g, " ");
    expect(html).not.toMatch(/\btoken\b|custom variable|\bt=/i);
  });
});

describe("QA de Contactos (2026-10-22)", () => {
  it("ninguna casilla: los encendidos son interruptores de la casa (dictado de Gonzalo)", () => {
    const archivos = fs.readdirSync(aqui).filter((f) => /\.tsx$/.test(f) && !f.includes(".test."));
    for (const archivo of archivos) {
      const fuente = fs.readFileSync(path.join(aqui, archivo), "utf8");
      expect({ archivo, casilla: /type=["']checkbox["']/.test(fuente) }).toEqual({ archivo, casilla: false });
    }
    const html = pintar({ lista: pagina(5), perfil: perfil(2, 4), todasLasColumnas: true });
    expect(html).not.toContain('type="checkbox"');
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"[^>]*aria-label="Todas las columnas"/);
  });

  it("la tarjeta de la variable filtrada mantiene todas sus categorías y resalta la elegida", () => {
    const corte = perfil(2, 3);
    // El corte filtrado por sexo=F solo trae F; la faceta (sin ese filtro) trae F y M.
    corte.variables[1] = { ...corte.variables[1], categorias: [corte.variables[1].categorias[0]] };
    const completa = perfil(2, 4).variables[1];
    const html = pintar({
      lista: pagina(5),
      perfil: corte,
      filtros: { sexo: ["F"] },
      facetas: { sexo: { variable: completa, base: 4, clave: "" } },
    });
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Sexo: F\./);
    expect(html).toMatch(/aria-pressed="false"[^>]*aria-label="Sexo: M\./);
  });

  it("la lista dice los efectivos del corte junto al total y pone estado antes que las columnas de control", () => {
    const html = pintar({ lista: pagina(5), perfil: perfil(2, 4) });
    expect(html).toContain("5 contactos (4 efectivos)");
    const cabeza = html.slice(html.indexOf("<thead>"), html.indexOf("</thead>"));
    expect(cabeza.indexOf("Estado")).toBeLessThan(cabeza.indexOf("Carrera"));
  });
});
