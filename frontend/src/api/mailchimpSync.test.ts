import { afterEach, describe, expect, it, vi } from "vitest";

import { apiSincronizarRespuestas, normalizeResultado } from "./mailchimpSync";

describe("Actualizar quién respondió, con archivado", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("manda archivar al backend cuando se pide", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, job_id: "j1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "sid-test"), setItem: vi.fn(), removeItem: vi.fn() });
    await apiSincronizarRespuestas({ campaign_id: "egresados", survey_id: "123", list_id: "abc", tag: "Respondió", archivar: true });
    const cuerpo = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(cuerpo).toMatchObject({ campaign_id: "egresados", archivar: true });
  });

  it("lee archivados, inactivos y personas a medias; sin ellos, cero", () => {
    expect(normalizeResultado({ archive: true, archived: 5, archived_second: 2, inactive: 1, partial_people: 3 }))
      .toMatchObject({ archive: true, archived: 5, archived_second: 2, inactive: 1, partial_people: 3 });
    expect(normalizeResultado({})).toMatchObject({ archive: false, archived: 0, archived_second: 0, inactive: 0, partial_people: 0 });
  });
});
