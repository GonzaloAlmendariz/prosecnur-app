// @vitest-environment happy-dom
/**
 * Dashboard › Base de datos › «Descargar» (descargas unificadas, fase 1, 2026-11-07).
 *
 * 1. Si la descarga falla, la pestaña lo dice: antes la promesa no tenía
 *    `.catch`, el botón volvía a «Descargar» y nada avisaba.
 * 2. En la publicación (`<DashboardPage publicMode />`, PublicArtifactApp) la
 *    tarjeta «Descargar» no se muestra: el lector del tablero publicado no
 *    exporta la base. El modo público llega como prop, igual que a DashboardPage.
 * 3. Fase 5 (ADR 0133): la descarga va por el kit de entregables en forma
 *    bloque dentro de la tarjeta. El botón sólo se deshabilita (sin
 *    «Generando…») y el error lo dice el contenedor, con su código y Reintentar.
 */
import fs from "node:fs";
import path from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const api = vi.hoisted(() => ({
  apiDashboardBaseDatosDescargar: vi.fn(),
  descargar: vi.fn(),
}));

vi.mock("../../../../lib/descargas", () => ({ descargarArchivo: api.descargar }));
vi.mock("../../../../api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../api/core")>()),
  downloadUrl: (fileId: string) => `/api/files/${fileId}/download`,
}));

// `api/client` es el barrel de `api/dashboard`: mockear el módulo de dominio cubre los dos imports.
vi.mock("../../../../api/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../api/dashboard")>()),
  apiDashboardBaseDatosDescargar: api.apiDashboardBaseDatosDescargar,
}));

vi.mock("../../useDashboardData", () => ({
  useBaseDatosEstructura: () => ({
    loading: false,
    error: null,
    payload: { secciones: [{ id: "s1", label: "Sección 1", variables: [{ name: "p1", label: "Pregunta 1", tipo: "so" }] }] },
  }),
  useBaseDatosData: () => ({ loading: false, error: null, payload: null }),
  useDiccionarioVariable: () => ({ loading: false, error: null, payload: null }),
}));

import { BaseDatosTab } from "./index";
import { useDashboardStore } from "../../store";
import { Toaster } from "../../../../components/Toaster";
import { useToasterStore } from "../../../../components/toasterStore";
import { useBandejaEntregables } from "../../../../components/entregables/bandejaStore";

let host: HTMLDivElement;
let root: Root;

/** El prop que DashboardPage le pasa en la publicación. Sin tipar: hoy BaseDatosTab no lo declara. */
const Tab = BaseDatosTab as unknown as (props: { publicMode?: boolean }) => ReturnType<typeof BaseDatosTab>;

function montar(publicMode?: boolean) {
  act(() =>
    root.render(
      <>
        <Toaster />
        <Tab publicMode={publicMode} />
      </>,
    ),
  );
}

function botonDescargar(): HTMLButtonElement | undefined {
  return [...host.querySelectorAll("button")].find((b) => /Descargar|Generando/.test(b.textContent ?? ""));
}

function tituloDescargar(): Element | undefined {
  return [...host.querySelectorAll("h2, h3")].find((h) => h.textContent?.trim() === "Descargar");
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useToasterStore.setState({ toasts: [] });
  useDashboardStore.getState().resetBaseDatos();
  useDashboardStore.getState().setBaseDatosVariables(["p1"]);
  api.apiDashboardBaseDatosDescargar.mockReset();
  api.descargar.mockClear();
  useBandejaEntregables.getState().vaciar();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useToasterStore.setState({ toasts: [] });
});

test("si la descarga falla, la pestaña muestra el error en vez de callar", async () => {
  api.apiDashboardBaseDatosDescargar.mockRejectedValue(new Error("No se pudo descargar el archivo (HTTP 500)."));
  montar();

  const boton = botonDescargar();
  expect(boton, 'la tarjeta "Descargar" está en el admin').toBeDefined();
  expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0);

  await act(async () => {
    boton?.click();
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

  expect(api.apiDashboardBaseDatosDescargar).toHaveBeenCalledTimes(1);
  // El error se ve: en la pestaña (ErrorBlock del kit) o en el deck de errores del toaster.
  const alertas = [...document.querySelectorAll('[role="alert"]')].filter((n) => (n.textContent ?? "").trim().length > 0);
  expect(alertas.length, "un mensaje de error visible tras la descarga fallida").toBeGreaterThan(0);
  // Y el botón queda usable para reintentar.
  expect(botonDescargar()?.disabled).toBe(false);
});

test("la base sale por el kit: el botón sólo se deshabilita y el archivo queda en el contenedor de la tarjeta", async () => {
  let resolver: (v: unknown) => void = () => undefined;
  api.apiDashboardBaseDatosDescargar.mockReturnValue(new Promise((res) => { resolver = res; }));
  montar();
  await act(async () => { botonDescargar()?.click(); });

  expect(api.apiDashboardBaseDatosDescargar).toHaveBeenCalledWith(expect.objectContaining({ variables: ["p1"], formato: "xlsx" }));
  expect(botonDescargar()?.disabled).toBe(true);
  expect(botonDescargar()?.textContent?.trim()).toBe("Descargar");
  const enCurso = host.querySelector<HTMLElement>("[data-entregable-forma='bloque']");
  expect(enCurso?.dataset.entregableFase).toBe("en_curso");
  expect(enCurso?.closest(".dash-cardbox")).not.toBeNull();

  await act(async () => { resolver({ file_id: "b1", filename: "HSVG2026_Base_de_datos_del_dashboard_10_11_26.xlsx" }); });
  const lista = host.querySelector<HTMLElement>("[data-entregable-forma='bloque']");
  expect(lista?.dataset.entregableFase).toBe("lista");
  expect(lista?.querySelectorAll("a")).toHaveLength(0);
  expect(api.descargar).toHaveBeenCalledWith("/api/files/b1/download", "HSVG2026_Base_de_datos_del_dashboard_10_11_26.xlsx");
  expect(botonDescargar()?.disabled).toBe(false);
});

test('en la publicación la tarjeta "Descargar" no se muestra', () => {
  montar(true);
  expect(tituloDescargar()).toBeUndefined();
  expect(botonDescargar()).toBeUndefined();
});

test('en el admin la tarjeta "Descargar" sí se muestra', () => {
  montar(false);
  expect(tituloDescargar()).toBeDefined();
  expect(botonDescargar()).toBeDefined();
});

test("DashboardPage le pasa el modo público a la pestaña Base de datos", () => {
  const pagina = fs.readFileSync(path.join(__dirname, "..", "..", "DashboardPage.tsx"), "utf8");
  const montajes = [...pagina.matchAll(/<BaseDatosTab\b[^>]*\/?>/g)].map((m) => m[0]);
  expect(montajes.length).toBeGreaterThan(0);
  for (const montaje of montajes) expect(montaje).toMatch(/\bpublicMode\b/);
});
