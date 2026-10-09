import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard, MonitoreoRow } from "../../../../api/monitoreo";
import { AulasPestanaRendimiento } from "./AulasPestanaRendimiento";

/**
 * A17 (checklist operativo 2026-08-31): la frontera del payload.
 *
 * `avance_cuota.meta_operativa` está tipado `number | null`, pero el JSON de R
 * lo serializa a veces como STRING —`"NA"` con «Todas las facultades», y los
 * números pueden llegar como `"3750"`—. El `?? null` de esta pestaña dejaba
 * pasar cualquiera de los dos: el `"NA"` volvía NaN el techo del eje y el
 * «Acumulado por día» quedaba en blanco bajo una leyenda con cifras.
 *
 * La pestaña es la FRONTERA donde el payload se lee, así que aquí se normaliza:
 * número finito o `null`, nada más. El gráfico tiene además su propia defensa
 * (`AulasSerieDeRendimiento` filtra no-finitos del techo), y por eso el caso
 * que distingue esta capa es el string NUMÉRICO: sin la frontera, `"500"` no es
 * finito para el filtro y la sobremuestra desaparecería del eje.
 */

function aplicada(fecha: string, efectivas: number, codigo: string): MonitoreoRow {
  return {
    faculty: "Derecho",
    applied_at: fecha,
    effective_surveys: efectivas,
    operational_code: codigo,
  } as unknown as MonitoreoRow;
}

function agendada(fecha: string, codigo: string): MonitoreoRow {
  return {
    faculty: "Derecho",
    scheduled_date: fecha,
    eligible_n: 40,
    operational_code: codigo,
  } as unknown as MonitoreoRow;
}

function tablero(metaOperativa: unknown): MonitoreoAulasDashboard {
  return {
    partes_campo: [
      aplicada("2026-08-10", 20, "A1"),
      aplicada("2026-08-11", 22, "A2"),
      aplicada("2026-08-12", 19, "A3"),
    ],
    agenda: [agendada("2026-08-17", "B1")],
    quotas_sex_faculty: [],
    control_calidad: [],
    avance_cuota: { meta_operativa: metaOperativa },
  } as unknown as MonitoreoAulasDashboard;
}

function pintar(metaOperativa: unknown) {
  return renderToStaticMarkup(
    <AulasPestanaRendimiento
      dashboard={tablero(metaOperativa)}
      pestana="rendimiento"
      facultadEnFoco={undefined}
      onFoco={() => {}}
      diasDeCampoDelCorte={() => 3}
    />);
}

describe("la pestaña normaliza meta_operativa en la frontera (A17, C5)", () => {
  it("un string numérico del JSON de R sigue siendo la sobremuestra del eje", () => {
    // Con datos por debajo de 65 y sobremuestra 500, el escalón superior del
    // acumulado tiene que decir 500: el string se convirtió en número, no se
    // descartó en silencio ni pasó crudo.
    const html = pintar("500");
    expect(html).toContain(">500<");
    expect(html).not.toContain("NaN");
  });

  it("el \"NA\" de R es una sobremuestra ausente, no un NaN", () => {
    const html = pintar("NA");
    expect(html).not.toContain("NaN");
    expect(html).toContain("Sobremuestra no declarada por el estudio");
    // Y el acumulado se dibuja: sin esto, un lienzo en blanco también pasaría.
    expect(html).toMatch(/<polyline points="[\d.]+,[\d.]+/);
  });

  it("un número de verdad pasa intacto", () => {
    const html = pintar(500);
    expect(html).toContain(">500<");
  });
});
