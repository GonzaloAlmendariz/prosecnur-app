// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const pedidos: string[] = [];
let respuesta: () => Promise<unknown> = () => Promise.resolve({ ok: true, preparando: false, key: "", total: 0, personas: [] });

let sesion = "sid-a";
vi.mock("../../../../../../api/core", () => ({
  getSession: () => sesion,
  registerMonitoreoMutationInvalidator: () => undefined,
}));
vi.mock("../../../../../../api/client", () => ({
  apiMonitoreoAcreditacionAssignmentPool: (key: string) => { pedidos.push(key); return respuesta(); },
}));

import { usePersonasAsignables, vaciarPersonasAsignables, type PersonasAsignables } from "./personasAsignables";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const columnas = {
  formato: "columnas_v1",
  n: 2,
  campos: {
    candidate_id: { niveles: ["codigo:A1", "codigo:A2"], codigos: [0, 1] },
    person_label: { niveles: ["Ana", "Beto"], codigos: [0, 1] },
    already_effective: { niveles: [false], codigos: [0, 0] },
  },
};

let ultimo: PersonasAsignables | null = null;
function Sonda({ clave, corte, activo = true }: { clave?: string; corte: object; activo?: boolean }) {
  ultimo = usePersonasAsignables(clave, corte, activo);
  return null;
}

async function montar(props: { clave?: string; corte: object; activo?: boolean }) {
  const raiz = createRoot(document.createElement("div"));
  await act(async () => { raiz.render(<Sonda {...props} />); });
  return raiz;
}

describe("usePersonasAsignables", () => {
  beforeEach(() => {
    pedidos.length = 0;
    ultimo = null;
    vaciarPersonasAsignables();
    respuesta = () => Promise.resolve({ ok: true, preparando: false, key: "docentes", total: 2, personas: columnas });
  });
  afterEach(() => vaciarPersonasAsignables());

  test('arranca "cargando" y decodifica el transporte en columnas', async () => {
    respuesta = () => new Promise(() => undefined);
    const raiz = await montar({ clave: "docentes", corte: {} });
    expect(ultimo?.estado).toBe("cargando");
    raiz.unmount();

    respuesta = () => Promise.resolve({ ok: true, preparando: false, key: "docentes", total: 2, personas: columnas });
    vaciarPersonasAsignables();
    const otra = await montar({ clave: "docentes", corte: {} });
    expect(ultimo?.estado).toBe("listo");
    expect(ultimo?.personas.map((p) => p.person_label)).toEqual(["Ana", "Beto"]);
    otra.unmount();
  });

  test("pide una sola vez por público aunque se abran varios casos o llegue otro corte", async () => {
    const a = await montar({ clave: "docentes", corte: {} });
    const b = await montar({ clave: "docentes", corte: {} });
    expect(pedidos).toEqual(["docentes"]);
    const c = await montar({ clave: "administrativos", corte: {} });
    expect(pedidos).toEqual(["docentes", "administrativos"]);
    [a, b, c].forEach((raiz) => raiz.unmount());
  });

  test("otro proyecto con un público homónimo no recibe el padrón del anterior", async () => {
    const a = await montar({ clave: "docentes", corte: {} });
    a.unmount();
    sesion = "sid-b";
    const b = await montar({ clave: "docentes", corte: {} });
    expect(pedidos).toEqual(["docentes", "docentes"]);
    b.unmount();
    sesion = "sid-a";
  });

  test("sin público o sin decisión posible no pide nada", async () => {
    const a = await montar({ clave: undefined, corte: {} });
    expect(ultimo?.estado).toBe("sin-publico");
    const b = await montar({ clave: "docentes", corte: {}, activo: false });
    expect(ultimo?.estado).toBe("sin-publico");
    expect(pedidos).toEqual([]);
    [a, b].forEach((raiz) => raiz.unmount());
  });

  test("si el corte aún se prepara avisa y no deja la caché envenenada", async () => {
    respuesta = () => Promise.resolve({ ok: true, preparando: true, key: "docentes", total: 0, personas: null });
    const a = await montar({ clave: "docentes", corte: {} });
    expect(ultimo?.estado).toBe("error");
    expect(ultimo && "mensaje" in ultimo ? ultimo.mensaje : "").toMatch(/recalculando/);
    a.unmount();
    respuesta = () => Promise.resolve({ ok: true, preparando: false, key: "docentes", total: 2, personas: columnas });
    const b = await montar({ clave: "docentes", corte: {} });
    expect(ultimo?.estado).toBe("listo");
    expect(pedidos).toEqual(["docentes", "docentes"]);
    b.unmount();
  });
});
