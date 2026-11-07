// @vitest-environment happy-dom
/**
 * L9 — la base integrada y el paquete .sav se pueden cancelar mientras corren.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const jobs = vi.hoisted(() => ({ apiJobCancel: vi.fn(async () => ({ ok: true })) }));
vi.mock("../../api/jobs", () => jobs);

import { BotonCancelarImport, useCancelarImport } from "./cancelarImport";

let host: HTMLDivElement;
let root: Root;
let api: ReturnType<typeof useCancelarImport>;

function Prueba() {
  api = useCancelarImport();
  return api.jobId ? <BotonCancelarImport cancelando={api.cancelando} onCancelar={() => void api.cancelar()} /> : null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  jobs.apiJobCancel.mockClear();
  act(() => root.render(<Prueba />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

test("sin job no hay botón ni llamada", async () => {
  expect(host.querySelector("button")).toBeNull();
  await act(async () => { await api.cancelar(); });
  expect(jobs.apiJobCancel).not.toHaveBeenCalled();
});

test("con el job registrado, Cancelar lo cancela en el backend y queda «Cancelando…»", async () => {
  act(() => api.registrar("job-7"));
  const boton = host.querySelector("button");
  expect(boton?.textContent).toContain("Cancelar");
  await act(async () => { boton?.click(); });
  expect(jobs.apiJobCancel).toHaveBeenCalledWith("job-7");
  expect(host.querySelector("button")?.textContent).toContain("Cancelando…");
  expect(host.querySelector("button")?.disabled).toBe(true);

  act(() => api.limpiar());
  expect(host.querySelector("button")).toBeNull();
});
