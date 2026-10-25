import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MonitoreoAcreditacion } from "../../../../../api/client";
import type { AcreditacionAdvanceCard } from "./tarjetasDeAvance";
import { estadoDelCierre, publicacionesFrenteAlCorte, puedeCerrar } from "./salidasModelo";
import { SalidasVista } from "./Salidas";
import { DialogoCerrarCampo } from "./DialogoCerrarCampo";

const tarjeta = (actor: string, effective: number, meta: number | null) => ({ id: actor, actor, universe: 500, effective, partial: 0, refusals: 0, pending: 0, meta, missing: null, progress: null }) as AcreditacionAdvanceCard;
const acreditacion = { modo_trabajo: "seguimiento_campo", plan_refuerzo: "", aprobacion_metodologica: false, cierre_at: "", dashboard: { cierre_habilitado: false, cards: [], alertas: [], bloqueos: 2 } } as unknown as MonitoreoAcreditacion;

describe("Avance › Salidas", () => {
  it("compara cada publicación con el corte", () => {
    const [cliente, interno] = publicacionesFrenteAlCorte("2026-07-23T18:09:00Z", { spreadsheet_id: "a", updated_at: "2026-07-21T10:00:00Z" }, { spreadsheet_id: "b", updated_at: "2026-07-24T08:00:00Z" });
    expect(cliente.alDia).toBe(false);
    expect(interno.alDia).toBe(true);
    expect(publicacionesFrenteAlCorte(null, null, null)[0]).toEqual({ salida: "Sheets del cliente", fecha: null, alDia: null, enlace: null });
  });

  it("cuenta las metas cumplidas y lo pendiente del cierre", () => {
    const cierre = estadoDelCierre({
      tarjetas: [tarjeta("A", 120, 100), tarjeta("B", 40, 100), tarjeta("C", 10, null)],
      esperan: 23,
      publicaciones: publicacionesFrenteAlCorte("2026-07-23T18:09:00Z", { spreadsheet_id: "a", updated_at: "2026-07-21T10:00:00Z" }, null),
      acreditacion,
    });
    expect(cierre.metasCumplidas).toBe(1);
    expect(cierre.metasDeclaradas).toBe(2);
    expect(cierre.bloqueado).toBe(true);
    expect(cierre.puntos.map((punto) => punto.valor)).toEqual(["1 de 2", "23", "Anterior al corte", "Sin aprobar"]);
  });

  it("sigue la regla del motor para cerrar", () => {
    expect(puedeCerrar(true, "", false)).toBe(false);
    expect(puedeCerrar(true, "Refuerzo por teléfono", false)).toBe(true);
    expect(puedeCerrar(true, "", true)).toBe(true);
    expect(puedeCerrar(false, "", false)).toBe(true);
  });

  it("dibuja publicaciones y cierre sin claves técnicas", () => {
    const cierre = estadoDelCierre({ tarjetas: [tarjeta("A", 120, 100)], esperan: 0, publicaciones: [], acreditacion });
    const html = renderToStaticMarkup(<SalidasVista corte="2026-07-23T18:09:00Z" publicaciones={publicacionesFrenteAlCorte("2026-07-23T18:09:00Z", null, null)} cierre={cierre} onAbrirCierre={() => {}} />);
    expect(html).toContain("Publicaciones frente al corte");
    expect(html).toContain("Cerrar campo");
    expect(html).toContain("Sin publicar");
    expect(html).not.toMatch(/cierre_habilitado|aprobacion_metodologica|seguimiento_campo/);
  });

  it("el diálogo dice lo pendiente y nombra el botón con la cifra", () => {
    const cierre = estadoDelCierre({ tarjetas: [tarjeta("A", 120, 100), tarjeta("B", 40, 100)], esperan: 3, publicaciones: [], acreditacion });
    const html = renderToStaticMarkup(<DialogoCerrarCampo cierre={cierre} planInicial="" aprobacionInicial={false} guardando={false} onCerrarCampo={() => {}} onCerrar={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Lo pendiente");
    expect(html).toContain("Cerrar con 1 de 2 metas");
    expect(html).toContain("disabled");
  });
});
