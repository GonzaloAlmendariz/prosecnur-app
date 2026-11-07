// @vitest-environment happy-dom
/**
 * Descargas unificadas, fase 1 (2026-11-07).
 *
 * En Electron `setWindowOpenHandler` (desktop/main.cjs) deniega toda ventana
 * nueva, así que `window.open(downloadUrl(...))` no descarga nada. La descarga
 * se hace con un `<a download>` efímero: el navegador y Electron la tratan como
 * descarga (will-download), no como ventana.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { descargarArchivo } from "./descargas";

type Clic = { href: string | null; download: string | null; conectado: boolean; ancla: HTMLAnchorElement };

let clics: Clic[];

beforeEach(() => {
  clics = [];
  // El click real navegaría; aquí sólo se registra cómo estaba el enlace al pulsarse.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clics.push({
      href: this.getAttribute("href"),
      download: this.getAttribute("download"),
      conectado: this.isConnected,
      ancla: this,
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

test("descarga con un <a download> conectado al documento y lo retira después", () => {
  descargarArchivo("/api/files/abc/download", "HSVG2026_Selección.pdf");

  expect(clics).toHaveLength(1);
  const [clic] = clics;
  expect(clic.href).toBe("/api/files/abc/download");
  expect(clic.download).toBe("HSVG2026_Selección.pdf");
  expect(clic.conectado).toBe(true);
  expect(clic.ancla.isConnected).toBe(false);
  expect(document.querySelectorAll("a")).toHaveLength(0);
});

test("sin nombre, el atributo download queda vacío y el nombre lo pone el servidor", () => {
  descargarArchivo("/api/hojas-ruta/reporte?inline=0");

  expect(clics).toHaveLength(1);
  expect(clics[0].href).toBe("/api/hojas-ruta/reporte?inline=0");
  expect(clics[0].download).toBe("");
  expect(clics[0].ancla.isConnected).toBe(false);
});

test("no abre ventanas: Electron las deniega", () => {
  const abrir = vi.spyOn(window, "open").mockImplementation(() => null);
  descargarArchivo("/api/files/abc/download", "a.xlsx");
  expect(abrir).not.toHaveBeenCalled();
});
