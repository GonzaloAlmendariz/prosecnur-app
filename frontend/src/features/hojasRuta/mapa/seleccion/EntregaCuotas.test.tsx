import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { EnvioMeta } from "../../../../api/materialTerritorial";
import { EntregaCuotas } from "./EntregaCuotas";

vi.mock("../../../project/ProjectModulesContext", () => ({ useProjectModules: () => ({ addModule: () => undefined }) }));

const meta = (extra: Partial<EnvioMeta>): EnvioMeta => ({
  kind: "cuotas", n_zonas: 2, n_entrevistas: 198, enviado_at: "2026-11-02T08:00:00Z", sorteado_en: null,
  sample_fingerprint: "h", n_titulares: 0, n_reemplazos: 0, desactualizado: false, ...extra,
});
const html = (props: Partial<Parameters<typeof EntregaCuotas>[0]>) => renderToStaticMarkup(
  <MemoryRouter><EntregaCuotas envio={null} distritos={2} nObjetivo={200} fase="field" {...props} /></MemoryRouter>,
);

describe("Entrega por cuotas", () => {
  it("sin envío dice qué se envía y habilita enviar", () => {
    const h = html({});
    expect(h).toContain("Se envían 2 zonas con su cuota por sexo y edad, para 200 entrevistas");
    expect(h).toContain("Enviar a Material");
    expect(h).not.toContain("disabled");
  });

  it("sin distritos o sin N no se envía y dice qué falta", () => {
    expect(html({ distritos: 0 })).toContain("confirma los distritos en Territorio y fija el N en Muestra");
    expect(html({ nObjetivo: null })).toContain("disabled");
  });

  it("enviada cuenta zonas y entrevistas; desactualizada lo avisa", () => {
    expect(html({ envio: meta({}) })).toContain("2 zonas y 198 entrevistas");
    expect(html({ envio: meta({}) })).toContain("Abrir en Material de campo");
    expect(html({ envio: meta({ desactualizado: true }) })).toContain("Las cuotas cambiaron desde el envío");
    // P6: el estado del envío es EstadoChip del kit.
    expect(html({ envio: meta({}) })).toMatch(/pulso-estado-chip[^>]*>[\s\S]*?Al día/);
    expect(html({ envio: meta({ desactualizado: true }) })).toMatch(/pulso-estado-chip[^>]*>[\s\S]*?Desactualizado/);
  });

  it("un envío por UMP anterior no cuenta como el de cuotas", () => {
    expect(html({ envio: meta({ kind: "ump" }) })).toContain("Enviar a Material");
    expect(html({ envio: meta({ kind: "ump" }) })).not.toContain("Abrir en Material de campo");
  });
});
