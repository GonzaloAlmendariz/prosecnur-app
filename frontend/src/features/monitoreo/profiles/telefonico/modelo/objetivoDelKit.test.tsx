/**
 * Modelo › Cuotas: «Objetivo total» y la meta de cada cuota son el campo del
 * kit (Gonzalo, 2026-10-27: el `<input type=number>` nativo mostraba las
 * flechitas del navegador, un foco doble y la cifra pegada a las flechas).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Cuotas } from "./Cuotas";

function pintar() {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/monitoreo?modo=telefonico&seccion=modelo&pestana=cuotas"]}>
      <Cuotas
        variable="dim_actor"
        etiquetaDeVariable="Actor"
        candidatas={[{ name: "dim_actor", label: "Actor", categories: 2, universe: 400, meta: 200, enUso: true }]}
        onElegir={vi.fn()}
        onUsar={vi.fn()}
        variableGuardada
        filas={[{ value: "Pre visa humanitaria", universe: 200, meta: 100, effective: 99 }, { value: "Pandemia", universe: 200, meta: 100, effective: 95 }]}
        pendientes={{}}
        onMeta={vi.fn()}
        cambiadas={0}
        etiquetaConfirmar="Confirmar"
        onConfirmar={vi.fn()}
        onDescartar={vi.fn()}
        onQuitar={vi.fn()}
        onAgregar={vi.fn()}
        objetivoTotal={400}
        onObjetivoTotal={vi.fn()}
        filtro=""
        calendario={{ ventana: "", reporte: "", fases: 0, dias: [], nota: "" }}
        estado={null}
      />
    </MemoryRouter>,
  );
}

describe("Modelo › Cuotas con los campos del kit", () => {
  it("el objetivo total y las metas son PulsoInput numéricos, sin type=number", () => {
    const html = pintar();
    const objetivo = /<input[^>]*aria-label="Objetivo total"[^>]*>/.exec(html)?.[0] ?? "";
    expect(objetivo).toContain("pulso-input");
    expect(objetivo).toContain("is-numeric");
    expect(objetivo).toMatch(/inputmode="numeric"/i);
    expect(objetivo).toContain('value="400"');
    expect(html).not.toContain('type="number"');
    const meta = /<input[^>]*aria-label="Meta de Pre visa humanitaria"[^>]*>/.exec(html)?.[0] ?? "";
    expect(meta).toContain("is-numeric");
  });
});
