import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { normalizarEnvioMeta } from "../../../../api/materialTerritorial";
import { ConfirmarResorteo } from "./ConfirmarResorteo";
import { fechaDelSorteo } from "./fechaSorteo";

const nada = () => undefined;

describe("volver a sortear una muestra enviada (1 nov 2026)", () => {
  test("la fecha del sorteo se lee del ISO y falta sin dato", () => {
    expect(fechaDelSorteo("2026-11-01T15:30:00Z")).toMatch(/2026/);
    expect(fechaDelSorteo(null)).toBeNull();
    expect(fechaDelSorteo("")).toBeNull();
    expect(fechaDelSorteo("no es fecha")).toBeNull();
  });

  test("la confirmación dice que Material y Monitoreo quedan desfasados y ofrece cancelar", () => {
    const html = renderToStaticMarkup(<ConfirmarResorteo enviadoEl="2026-10-30T12:00:00Z" guardando={false} onConfirmar={nada} onCancelar={nada} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Material de campo y Monitoreo");
    expect(html).toContain("desfasados");
    expect(html).toContain("enviada el");
    expect(html).toContain("Cancelar");
    expect(html).toContain("Sortear igual");
    // Sin fecha de envío no inventa una.
    expect(renderToStaticMarkup(<ConfirmarResorteo enviadoEl={null} guardando={false} onConfirmar={nada} onCancelar={nada} />)).not.toContain("enviada el");
  });

  test("el envío publica cuándo se sorteó su muestra; uno viejo trae null", () => {
    const base = { sample_fingerprint: "sha256:" + "a".repeat(64), enviado_at: "2026-10-30T12:00:00Z", n_titulares: 150, n_reemplazos: 150, desactualizado: false };
    expect(normalizarEnvioMeta({ ...base, sorteado_en: "2026-10-29T09:00:00Z" })?.sorteado_en).toBe("2026-10-29T09:00:00Z");
    expect(normalizarEnvioMeta({ ...base, sorteado_en: "" })?.sorteado_en).toBeNull();
    expect(normalizarEnvioMeta(base)?.sorteado_en).toBeNull();
  });
});
