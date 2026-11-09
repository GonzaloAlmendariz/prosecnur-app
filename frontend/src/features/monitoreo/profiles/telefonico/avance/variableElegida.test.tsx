import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { phoneQuotaCardsForDashboard } from "../TelefonicoMonitoreoPage";
import { CuotasFaltanteDelCorte } from "./CuotasFaltanteDelCorte";
import { entradaDeCuotasFaltante } from "./entradaDeCuotas";
import { segmentoDeCuotas } from "./ritmoModel";

function reportes(filas: Array<Record<string, unknown>>): MonitoreoAcreditacionReports {
  return {
    sheets: [{ id: "monitoreo_telefonico", title: "Telefónico", blocks: [{ id: "cuotas_variable", title: "Cuotas", columns: [], rows: filas }] }],
  } as unknown as MonitoreoAcreditacionReports;
}

const FILAS = [
  { Actor: "Total", Variable: "Actor", Valor: "Homologación", Universo: 156, Meta: 80, Efectivas: 55 },
  { Actor: "Total", Variable: "Actor", Valor: "Vinculación", Universo: 27, Meta: 20, Efectivas: 14 },
  { Actor: "Total", Variable: "Sexo", Valor: "Mujer", Universo: 90, Meta: 50, Efectivas: 40 },
  { Actor: "Total", Variable: "Sexo", Valor: "Hombre", Universo: 93, Meta: 50, Efectivas: 29 },
];

function pintar(ruta: string, filas = FILAS) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[ruta]}>
      <CuotasFaltanteDelCorte reports={reportes(filas)} state={null} tarjetas={phoneQuotaCardsForDashboard} />
    </MemoryRouter>,
  );
}

describe("R5 paso 2: la variable de cuota se elige y la dirección la guarda", () => {
  it("sin elección se ve la de siempre (Actor); con `panel=variable&foco=Sexo`, Sexo, en tarjetas, Ritmo y modelo a la vez", () => {
    expect(pintar("/monitoreo?seccion=avance&pestana=cuotas")).toContain("cuánto falta por actor");
    const conSexo = pintar("/monitoreo?seccion=avance&pestana=cuotas&panel=variable&foco=Sexo");
    expect(conSexo).toContain("cuánto falta por sexo");
    expect(conSexo).toContain("Mujer");
    expect(segmentoDeCuotas(reportes(FILAS), "Sexo")).toBe("Sexo");
    expect(entradaDeCuotasFaltante(reportes(FILAS), null, phoneQuotaCardsForDashboard(reportes(FILAS), "Sexo"), "Sexo").modelo.segmento).toBe("Sexo");
  });

  it("con metas en una sola variable no hay selector; un foco que no es variable de cuota no cambia nada", () => {
    const una = FILAS.slice(0, 2);
    expect(pintar("/monitoreo?seccion=avance&pestana=cuotas", una)).not.toContain("mon-tel-cuotas-variable");
    expect(pintar("/monitoreo?seccion=avance&pestana=cuotas")).toContain("mon-tel-cuotas-variable");
    expect(pintar("/monitoreo?seccion=avance&pestana=cuotas&panel=variable&foco=Distrito")).toContain("cuánto falta por actor");
  });
});

describe('la variable elegida trae su propia serie diaria (no "Sin serie diaria")', () => {
  it("con Sexo elegido, cada tarjeta de sexo lleva sus puntos por día", () => {
    const reports = {
      sheets: [{ id: "monitoreo_telefonico", title: "Telefónico", blocks: [
        { id: "cuotas_variable", title: "Cuotas", columns: [], rows: FILAS },
        { id: "avance_efectivo_variable_dia", title: "Día", columns: [], rows: [
          { Variable: "Actor", Valor: "Homologación", Fecha: "2026-08-04", "Efectivas Kobo": 12, Efectivas: 12 },
          { Variable: "Sexo", Valor: "Mujer", Fecha: "2026-08-04", "Efectivas Kobo": 7, Efectivas: 7 },
          { Variable: "Sexo", Valor: "Mujer", Fecha: "2026-08-05", "Efectivas Kobo": 5, Efectivas: 5 },
          { Variable: "Sexo", Valor: "Hombre", Fecha: "2026-08-04", "Efectivas Kobo": 4, Efectivas: 4 },
        ] },
      ] }],
    } as unknown as MonitoreoAcreditacionReports;
    const mujer = phoneQuotaCardsForDashboard(reports, "Sexo").find((t) => t.actor === "Mujer");
    expect(mujer?.dailyPoints.map((p) => p.effective)).toEqual([7, 5]);
    // Sin elección, Sexo no es la variable a la vista y no lleva serie.
    expect(phoneQuotaCardsForDashboard(reports).find((t) => t.actor === "Homologación")?.dailyPoints.length).toBe(1);
  });
});
