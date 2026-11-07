import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasConfig, MonitoreoAulasDashboard, MonitoreoSource } from "../../../../../api/monitoreo";
import { construirFuentes, fechaCorta, readinessDeFuentes } from "./fuentesModelo";
import { FuentesAulas } from "./FuentesAulas";
import type { ContextoDeInsumos } from "./contextoDeInsumos";

// Ficha I1 (Insumos › Fuentes) con las cifras de HSVG 2026: 174 titulares,
// 1,173 reservas y 45 del banco; 3,610 respuestas, 39 sin curso-horario y 37
// fuera del operativo.

const config = {
  imported_at: "2026-09-02T14:05:00Z",
  selection_run_id: "a1b2c3d4e5f6",
  libro_publicado: {
    publicado_en: "2026-09-18T16:40:00Z",
    detalle: [
      { hoja: "Agenda", accion: "respetada", filas: 0 },
      { hoja: "Partes de campo", accion: "respetada", filas: 0 },
      { hoja: "Avance de campo", accion: "actualizada", filas: 22 },
      { hoja: "Control de facultad", accion: "sembrada", filas: 15 },
    ],
  },
} as unknown as MonitoreoAulasConfig;

const fuentes = [
  { id: "kobo", kind: "kobo", label: "Encuesta HSVG", enabled: true, last_sync_at: "2026-09-18T16:42:00Z", last_sync_mode: "incremental" },
] as unknown as MonitoreoSource[];

function tablero(): MonitoreoAulasDashboard {
  return {
    course_status_rol_y_estado: { titulares: { total: 174 }, reemplazos: { total: 1173 }, banco: { total: 45 } },
    libro: {
      importado_en: "2026-09-18T16:30:00Z",
      hojas: [{ hoja: "Agenda", vino: true }, { hoja: "Partes de campo", vino: true }, { hoja: "Control", vino: false }],
      hojas_ausentes: 1,
      control_sin_nombre: 0,
      estados_desconocidos: [{ valor: "LLAMAR LUEGO", filas: 3 }],
      codigos_sin_plan: [{ codigo: "CH 999", filas: 2 }],
      reservas_sin_cadena: [],
      resumen: { unidades: 1392, titulares: 174, reservas: 1173 },
    },
    respuestas_desglose: {
      total: { observadas: 3610, efectivas: 3327, fuera_del_operativo: 37, no_pasan_criterio: 250, sin_aula: 39 },
      facultades: [],
    },
  } as unknown as MonitoreoAulasDashboard;
}

const contexto: ContextoDeInsumos = { config, fuentes, ocupado: false, importarPlan: () => {}, operaciones: null };

describe("construirFuentes", () => {
  it("una fila por fuente: plan, respuestas y libro, con volumen, lectura y estado", () => {
    const m = construirFuentes(tablero(), config, fuentes);
    expect(m.filas.map((f) => f.clave)).toEqual(["plan", "fuente-kobo", "libro"]);
    expect(m.filas[0]).toMatchObject({ fuente: "Plan del sorteo", volumen: "174 + 1,173 + 45", estado: { texto: "Importado", tono: "ok" } });
    expect(m.filas[1]).toMatchObject({ volumen: "3,610 respuestas", lectura: "18 set, 16:42", estado: { texto: "Leída (incremental)" } });
    expect(m.filas[2]).toMatchObject({ volumen: "1,392 cursos-horario", estado: { texto: "Falta 1 hoja", tono: "riesgo" } });
    expect(m.cursosDelPlan).toBe(174 + 1173 + 45);
  });

  it("el recibo dice cada comprobación aunque esté bien (C3)", () => {
    const r = construirFuentes(tablero(), config, fuentes).recibo!;
    expect(r.comprobaciones.map((c) => [c.clave, c.resultado])).toEqual([
      ["hojas", "Faltan 1"],
      ["campos", "Todas reconocidas"],
      ["estados", "3 filas"],
      ["sin-plan", "1 código"],
      ["sin-cadena", "Ninguna"],
      ["control", "Ninguna"],
    ]);
    expect(r.comprobaciones[0].detalle).toBe("Control");
  });

  it("el libro separa las hojas del equipo de las que escribe la app", () => {
    const l = construirFuentes(tablero(), config, fuentes).libro!;
    expect(l.equipo.map((h) => h.hoja)).toEqual(["Agenda", "Partes de campo"]);
    expect(l.app.map((h) => h.hoja)).toEqual(["Avance de campo", "Control de facultad"]);
  });

  it("la unión de las respuestas cuadra con lo leído", () => {
    const u = construirFuentes(tablero(), config, fuentes).union!;
    expect(u.pasos.map((p) => p.valor)).toEqual([3610, 3610 - 39 - 37, 39, 37]);
  });

  it("sin tablero igual hay plan por importar y nada que inventar", () => {
    const m = construirFuentes(null, { imported_at: "" } as unknown as MonitoreoAulasConfig, []);
    expect(m.filas.map((f) => f.clave)).toEqual(["plan"]);
    expect(m.filas[0].estado).toEqual({ texto: "Sin importar", tono: "aviso" });
    expect(m.recibo).toBeNull();
    expect(m.union).toBeNull();
  });

  it("fechas cortas en el formato del operativo", () => {
    expect(fechaCorta("2026-09-18T16:42:00Z")).toBe("18 set, 16:42");
    expect(fechaCorta("2026-09-02")).toBe("2 set");
    expect(fechaCorta("")).toBe("");
  });
});

describe("FuentesAulas", () => {
  it("publica su marca, declara superficies y no tiene botones que escriban en un Sheets", () => {
    const html = renderToStaticMarkup(<FuentesAulas dashboard={tablero()} cargando={false} contexto={contexto} />);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-insumos-fuentes"');
    expect(html).toContain('data-qa-geometry-group="aulas-insumos-fuentes"');
    expect(html).toContain("Fuentes del estudio");
    expect(html).toContain("Recibo de la última lectura del libro");
    expect(html).toContain("Cómo se une cada respuesta a su curso-horario");
    expect(html).not.toMatch(/Publicar/);
    expect(readinessDeFuentes(true)).toBe("false");
  });

  it("sin libro, el recibo y el libro publican su vacío legítimo", () => {
    const html = renderToStaticMarkup(<FuentesAulas dashboard={null} cargando={false} contexto={contexto} />);
    expect(html.match(/data-qa-geometry-empty="legitimo"/g)?.length).toBe(2);
  });
});
