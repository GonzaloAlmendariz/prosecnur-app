import { describe, expect, it } from "vitest";
import { SIN_CIFRA } from "../../../lib/formatoNumero";

import { normalizeEstadoSeguimiento, normalizeHorario, type FilaDelPlan, type HorarioSeguimiento } from "../../../api/mailSeguimiento";
import {
  aProgramado,
  conteoConPct,
  diferenciaConIntervalo,
  faltaEnCampana,
  faltaParaActualizar,
  formatoPct,
  formatoPuntos,
  grillaDelPlan,
  pasosDeLaPrueba,
  planConHora,
  planCompleto,
  resumenDeActualizacion,
  resumenDeEtiquetas,
  semillaDeHoy,
  tasaConBase,
  textoDeVeredicto,
} from "./modeloSeguimiento";
import { resolverPestanaDeSeguimiento } from "./navegacionSeguimiento";

const fila = (ronda: number, campaign_id: string, grupo: "A" | "B", extra: Partial<FilaDelPlan> = {}): FilaDelPlan => ({
  ronda, campaign_id, grupo, programado: `2026-11-1${ronda}T${grupo === "A" ? "09:30" : "20:00"}`, mailchimp_id: "", enviado: "", enviados: null, hora_txt: "", ...extra,
});

function horario(extra: Partial<HorarioSeguimiento> = {}): HorarioSeguimiento {
  return { ...normalizeHorario({}), campanas: ["e", "d"], rondas: [{ ronda: 1, etiqueta: "Recordatorio 1" }, { ronda: 2, etiqueta: "Recordatorio 2" }], ...extra };
}

describe("cifras", () => {
  it("conteo y porcentaje juntos, decimal con punto y coma de millares", () => {
    expect(conteoConPct(421, 800)).toBe("421 (52.6 %)");
    expect(tasaConBase(784, 18648)).toBe("4.20 % (784 de 18,648)");
    expect(tasaConBase(784, 18648, 4.2)).toBe("4.20 % (784 de 18,648)");
    expect(formatoPct(52.63)).toBe("52.6 %");
    expect(formatoPct(null)).toBe(SIN_CIFRA);
    expect(tasaConBase(0, 0)).toBe(SIN_CIFRA);
  });

  it("la diferencia lleva signo y su intervalo", () => {
    expect(formatoPuntos(3.1)).toBe("+3.10 pp");
    expect(formatoPuntos(-12.25)).toBe("−12.3 pp");
    expect(diferenciaConIntervalo({ dif_pp: 3.1, dif_li: -0.8, dif_ls: 5.4 })).toBe("+3.10 pp (IC 95 %: −0.80 a +5.40 pp)");
    expect(diferenciaConIntervalo({ dif_pp: 3.1, dif_li: null, dif_ls: null })).toBe("+3.10 pp");
  });

  it("el veredicto nombra al brazo que gana y avisa los pocos casos", () => {
    expect(textoDeVeredicto("A", "el grupo A (9:30 a. m.)", "el grupo B", false)).toBe("Gana el grupo A (9:30 a. m.)");
    expect(textoDeVeredicto("B", "el correo personal", "el control", true)).toBe("Gana el control (pocos casos)");
    expect(textoDeVeredicto("empate", "a", "b")).toBe("Sin diferencia clara");
    expect(textoDeVeredicto("sin_datos", "a", "b")).toBe("Sin datos");
  });

  it("semilla de hoy y hora del plan en minutos", () => {
    expect(semillaDeHoy(new Date(2026, 10, 11))).toBe(20261111);
    expect(aProgramado("2026-11-11T20:00:00")).toBe("2026-11-11T20:00");
    expect(aProgramado("mañana")).toBe("");
  });
});

describe("pasos de la prueba de horarios", () => {
  it("al empezar, el primero es el que sigue", () => {
    const p = pasosDeLaPrueba(horario({ campanas: [] }));
    expect(p.map((x) => x.estado)).toEqual(["sigue", "pendiente", "pendiente", "pendiente", "pendiente", "pendiente"]);
    expect(p.map((x) => x.numero)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("marca hecho lo hecho y el siguiente pendiente como el que sigue", () => {
    const plan = ["e", "d"].flatMap((id) => [1, 2].flatMap((r) => [fila(r, id, "A"), fila(r, id, "B")]));
    const h = horario({ sorteado_en: "2026-11-11T10:00:00Z", etiquetado_en: "2026-11-11T11:00:00Z", plan });
    expect(planCompleto(h)).toBe(true);
    expect(pasosDeLaPrueba(h).map((x) => x.estado)).toEqual(["hecho", "hecho", "hecho", "hecho", "sigue", "pendiente"]);
    const conBorradores = plan.map((f) => ({ ...f, mailchimp_id: "abc123" }));
    conBorradores[0].enviado = "2026-11-11T14:30:00+00:00";
    expect(pasosDeLaPrueba({ ...h, plan: conBorradores }).every((x) => x.estado === "hecho")).toBe(true);
  });

  it("un plan al que le falta la hora de un grupo no está hecho", () => {
    const h = horario({ plan: [fila(1, "e", "A"), fila(1, "e", "B"), fila(1, "d", "A")] });
    expect(planCompleto(h)).toBe(false);
  });
});

describe("plan de recordatorios", () => {
  it("arma la grilla recordatorio por público por grupo, con sus avisos", () => {
    const h = horario({
      oficina: ["d"],
      plan: [fila(1, "e", "A"), fila(1, "e", "B")],
      avisos: [{ tipo: "falta_hora", ronda: 1, campaign_id: "d", texto: "Recordatorio 1, Docentes: falta la hora de un grupo." }],
    });
    const g = grillaDelPlan(h, { e: "Egresados", d: "Docentes" });
    expect(g.map((r) => r.ronda)).toEqual([1, 2]);
    expect(g[0].filas.map((f) => [f.publico, f.oficina, Boolean(f.A.fila), Boolean(f.B.fila)])).toEqual([
      ["Egresados", false, true, true],
      ["Docentes", true, false, false],
    ]);
    expect(g[0].avisos).toHaveLength(1);
    expect(g[1].avisos).toHaveLength(0);
  });

  it("cambia la hora de una celda conservando el borrador, o la agrega", () => {
    const plan = [fila(1, "e", "A", { mailchimp_id: "abc123" }), fila(1, "e", "B")];
    expect(planConHora(plan, { ronda: 1, campaign_id: "e", grupo: "A", programado: "2026-11-11T10:00" })[0])
      .toEqual({ ronda: 1, campaign_id: "e", grupo: "A", programado: "2026-11-11T10:00", mailchimp_id: "abc123" });
    const nuevo = planConHora(plan, { ronda: 2, campaign_id: "e", grupo: "A", programado: "2026-11-12T09:30" });
    expect(nuevo).toHaveLength(3);
    expect(nuevo[2]).toEqual({ ronda: 2, campaign_id: "e", grupo: "A", programado: "2026-11-12T09:30", mailchimp_id: "" });
  });

  it("resume las etiquetas puestas con su concordancia", () => {
    expect(resumenDeEtiquetas({
      A: { etiqueta: "Envío mañana", etiquetados: 1, inactivos: 0 },
      B: { etiqueta: "Envío tarde", etiquetados: 400, inactivos: 2 },
    })).toEqual([
      'Grupo A: 1 contacto con "Envío mañana".',
      'Grupo B: 400 contactos con "Envío tarde" (2 inactivas, sin etiqueta).',
    ]);
  });
});

describe("quién respondió", () => {
  const estado = normalizeEstadoSeguimiento({
    config: { list_id: "abc" },
    campanas: [
      { campaign_id: "e", publico: "Egresados", contactos: true, personas: 10, con_enlace: 10, encuesta: "123" },
      { campaign_id: "d", publico: "Docentes", contactos: true, personas: 5, con_enlace: 0, encuesta: "" },
    ],
  });

  it("dice por qué una campaña no está lista", () => {
    expect(faltaEnCampana(estado.campanas[0])).toBe("");
    expect(faltaEnCampana(estado.campanas[1])).toBe("Sin enlaces personales");
    expect(faltaEnCampana({ contactos: false, con_enlace: 0, encuesta: "" })).toBe("Sin contactos");
    expect(faltaEnCampana({ contactos: true, con_enlace: 3, encuesta: "" })).toBe("Falta la encuesta");
  });

  it("dice qué falta para actualizar todas", () => {
    expect(faltaParaActualizar(estado, true, true)).toBe("");
    expect(faltaParaActualizar(estado, false, true)).toBe("Falta conectar Mailchimp.");
    expect(faltaParaActualizar({ ...estado, config: { ...estado.config, list_id: "" } }, true, true)).toBe("Elige la audiencia de Mailchimp.");
  });

  it("resume el resultado por campaña, incluidas las saltadas", () => {
    const r = resumenDeActualizacion({
      campanas: [{ campaign_id: "e", ok: true, respondents: 1, tagged: 1, archived: 1, archived_second: 1, partial_people: 2, inactive: 0, error: "" }],
      saltadas: [{ campaign_id: "d", publico: "Docentes", motivo: "falta elegir su encuesta de SurveyMonkey" }],
      totales: { respondieron: 1, etiquetados: 1, archivados: 1, a_medias: 2 },
    }, { e: "Egresados", d: "Docentes" });
    expect(r.titulo).toBe("1 persona respondió, 1 correo archivado, 2 a medias.");
    expect(r.porCampana).toEqual([
      { campaign_id: "e", publico: "Egresados", texto: "1 respondió, 2 correos archivados, 2 a medias.", error: false },
      { campaign_id: "d", publico: "Docentes", texto: "No se actualizó: falta elegir su encuesta de SurveyMonkey.", error: true },
    ]);
  });
});

describe("navegación", () => {
  it("una pestaña desconocida aterriza en Quién respondió", () => {
    expect(resolverPestanaDeSeguimiento("horarios")).toBe("horarios");
    expect(resolverPestanaDeSeguimiento(" CORREO-PERSONAL ")).toBe("correo-personal");
    expect(resolverPestanaDeSeguimiento("otra")).toBe("respondieron");
    expect(resolverPestanaDeSeguimiento(null)).toBe("respondieron");
  });
});
