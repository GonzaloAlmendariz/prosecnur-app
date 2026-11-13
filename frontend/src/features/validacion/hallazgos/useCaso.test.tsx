// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CasoCompleto } from "../../../api/validacionAuditoria";

const apiCaso = vi.fn();
vi.mock("../../../api/validacionAuditoria", async (original) => ({ ...(await original<object>()), apiCaso: (...a: unknown[]) => apiCaso(...a) }));

import { useCaso, type LecturaDelCaso } from "./useCaso";

let host: HTMLDivElement;
let root: Root;
let ultima: LecturaDelCaso & { releer: () => void; reintentar: () => void };
const fases: string[] = [];

function Sonda({ id }: { id: string | null }) {
  ultima = useCaso(id, "base");
  fases.push(ultima.fase);
  return null;
}

const caso = (marca: string) => ({ id_caso: "E-17", marca }) as unknown as CasoCompleto;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  apiCaso.mockReset();
  fases.length = 0;
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("lectura del caso", () => {
  // Ítem 49 (QA30b): confirmada una corrección, la ficha abierta no se actualizaba.
  test("releer vuelve a pedir el caso y deja el anterior a la vista mientras llega", async () => {
    apiCaso.mockResolvedValueOnce(caso("antes"));
    await act(async () => root.render(<Sonda id="E-17" />));
    expect(ultima.fase).toBe("lista");
    apiCaso.mockResolvedValueOnce(caso("despues"));
    fases.length = 0;
    await act(async () => ultima.releer());
    expect(apiCaso).toHaveBeenCalledTimes(2);
    expect(fases).not.toContain("cargando");
    expect(ultima.fase === "lista" && (ultima.caso as unknown as { marca: string }).marca).toBe("despues");
  });

  test("si releer falla, conserva el caso que ya tenía", async () => {
    apiCaso.mockResolvedValueOnce(caso("antes"));
    await act(async () => root.render(<Sonda id="E-17" />));
    apiCaso.mockRejectedValueOnce(new Error("sin red"));
    await act(async () => ultima.releer());
    expect(ultima.fase === "lista" && (ultima.caso as unknown as { marca: string }).marca).toBe("antes");
  });
});
