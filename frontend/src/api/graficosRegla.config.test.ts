// R5-12: POST /api/graficos/resumenes/regla manda la config del editor (sus presets), como la vista previa.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn(async () => new Response(JSON.stringify({ ok: true, total: 0, candidatas: [] }))));
vi.mock("./core", () => ({
  apiFetch: fetchMock,
  headers: (extra: Record<string, string> = {}) => extra,
  handle: async (res: Response) => res.json(),
}));

import { apiGraficosConteoRegla } from "./graficosRegla";

const cuerpo = (): Record<string, unknown> => {
  const init = (fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit] | undefined)?.[1];
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
};

describe("apiGraficosConteoRegla", () => {
  beforeEach(() => fetchMock.mockClear());

  it("manda `config` cuando se da", async () => {
    await apiGraficosConteoRegla({ graficador: "p_dumbbell", args: { corte: "4,5" }, config: { presets: { dumbbell: { decimales: 1 } } } });
    expect(cuerpo()).toEqual({ graficador: "p_dumbbell", args: { corte: "4,5" }, config: { presets: { dumbbell: { decimales: 1 } } } });
  });

  it("sin `config`, el cuerpo de siempre", async () => {
    await apiGraficosConteoRegla({ graficador: "p_panorama", args: {}, scope: "consolidated" });
    expect(cuerpo()).toEqual({ graficador: "p_panorama", args: {}, scope: "consolidated" });
  });
});
