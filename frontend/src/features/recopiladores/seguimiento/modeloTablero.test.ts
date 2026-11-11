import { describe, expect, it } from "vitest";

import { normalizeEstadoSeguimiento, normalizeResultadosDeHorario, type FilaDelPlan } from "../../../api/mailSeguimiento";
import {
  anchosComparados,
  cabeceraDeRonda,
  cifrasDeCorreoPersonal,
  cifrasDeHorarios,
  cifrasDeRespondieron,
  escalaDeIntervalos,
  estadoDeCelda,
  faltaDelPaso,
  pasoAbierto,
  posicionEnEscala,
  resumenDelPaso,
  veredictoDeRonda,
} from "./modeloTablero";

const estado = normalizeEstadoSeguimiento({
  campanas: [
    { campaign_id: "e", publico: "Egresados", contactos: true, personas: 100, con_enlace: 90, respondieron: 30, a_medias: 4, leido_en: "2026-11-10T10:00:00Z", grupos: { A: 45, B: 45 }, segundo_correo: { personal: 8, control: 2, cargados: 7, rechazados: 1 } },
    { campaign_id: "d", publico: "Docentes", contactos: true, personas: 50, con_enlace: 50, respondieron: null, a_medias: null, grupos: { A: 25, B: 25 } },
  ],
  horario: {
    campanas: ["e", "d"], oficina: ["d"], semilla: 20261103, sorteado_en: "2026-11-11T15:00:00", etiquetado_en: "2026-11-11T16:00:00",
    rondas: [{ ronda: 1, etiqueta: "Recordatorio 1" }, { ronda: 2, etiqueta: "Recordatorio 2" }],
    plan: [
      { ronda: 1, campaign_id: "e", grupo: "A", programado: "2026-11-12T09:30", mailchimp_id: "abc123" },
      { ronda: 1, campaign_id: "e", grupo: "B", programado: "2026-11-12T20:00", mailchimp_id: "" },
    ],
  },
});

describe("cifras de cabecera", () => {
  it("respondieron se lee sobre quienes tienen enlace en las campañas leídas", () => {
    expect(cifrasDeRespondieron(estado.campanas)).toEqual({
      conEnlace: 140, personas: 150, respondieron: 30, baseLeida: 90, aMedias: 4,
      ultimaLectura: "2026-11-10T10:00:00Z", leidas: 1, campanas: 2,
    });
    expect(cifrasDeRespondieron([]).respondieron).toBeNull();
  });

  it("prueba de horarios: personas, borradores y el resultado del último recordatorio comparado", () => {
    const sin = cifrasDeHorarios(estado, null);
    expect(sin).toMatchObject({ personas: 140, comparados: null, recordatorios: 2, borradores: 1, conHora: 2, ganador: null });
    const r = normalizeResultadosDeHorario({
      rondas: [
        { ronda: 1, comparable: true, ganador: "B", horaA: "9:30 a. m.", horaB: "8:00 p. m." },
        { ronda: 2, comparable: false },
      ],
    });
    expect(cifrasDeHorarios(estado, r)).toMatchObject({ comparados: 1, ganador: "Ganó 8:00 p. m." });
  });

  it("correo personal suma por campaña", () => {
    expect(cifrasDeCorreoPersonal(estado.campanas)).toEqual({ personal: 8, control: 2, cargados: 7, rechazados: 1 });
  });
});

describe("pasos plegados y abiertos", () => {
  it("el que sigue va siempre abierto; resultados, si hay datos; el resto, a pedido", () => {
    expect(pasoAbierto("etiquetas", "sigue", {}, false)).toBe(true);
    expect(pasoAbierto("asignacion", "hecho", {}, false)).toBe(false);
    expect(pasoAbierto("asignacion", "hecho", { asignacion: true }, false)).toBe(true);
    expect(pasoAbierto("resultados", "pendiente", {}, true)).toBe(true);
    expect(pasoAbierto("resultados", "pendiente", {}, false)).toBe(false);
  });

  it("un paso hecho se resume en una línea con sus cifras", () => {
    expect(resumenDelPaso("publicos", estado)).toBe("2 públicos en la prueba, 1 con horario de oficina (08:30 a 17:00)");
    expect(resumenDelPaso("asignacion", estado)).toBe("Asignados el 11/11 con la semilla 20261103: 140 personas, 50/50");
    expect(resumenDelPaso("etiquetas", estado)).toBe('"Envío mañana" y "Envío tarde" puestas el 11/11');
  });

  it("un paso pendiente dice lo que le falta", () => {
    expect(faltaDelPaso("borradores", estado)).toBe("1 de 2 borradores creados.");
    expect(faltaDelPaso("plan", estado)).toBe("Falta la hora de cada grupo en cada recordatorio.");
    const vacio = normalizeEstadoSeguimiento({});
    expect(faltaDelPaso("publicos", vacio)).toBe("El estudio no tiene campañas de correo en Mailchimp.");
    expect(faltaDelPaso("asignacion", vacio)).toBe("Primero, los públicos de la prueba.");
  });
});

describe("veredicto e intervalos", () => {
  it("la píldora dice la hora que ganó, o que va ganando si sigue en curso", () => {
    expect(veredictoDeRonda({ comparable: true, ganador: "B", horaA: "9:30 a. m.", horaB: "8:00 p. m.", en_curso: false })).toEqual({ texto: "Ganó 8:00 p. m.", tono: "gana" });
    expect(veredictoDeRonda({ comparable: true, ganador: "A", horaA: "9:30 a. m.", horaB: "", en_curso: true }).texto).toBe("Va ganando 9:30 a. m.");
    expect(veredictoDeRonda({ comparable: true, ganador: "empate", horaA: "", horaB: "", en_curso: false })).toEqual({ texto: "Sin diferencia clara", tono: "neutro" });
  });

  it("la escala es simétrica y el cero va al medio", () => {
    const escala = escalaDeIntervalos([{ dif_pp: 1, dif_li: -0.5, dif_ls: 4 }, { dif_pp: null, dif_li: null, dif_ls: null }]);
    expect(escala).toBe(4);
    expect(posicionEnEscala(0, escala)).toBe(50);
    expect(posicionEnEscala(-4, escala)).toBe(0);
    expect(posicionEnEscala(9, escala)).toBe(100);
    expect(escalaDeIntervalos([{ dif_pp: 0.1, dif_li: 0, dif_ls: 0.2 }])).toBe(2);
  });

  it("las barras de A y B se comparan contra la mayor", () => {
    expect(anchosComparados(4, 2)).toEqual({ A: 100, B: 50 });
    expect(anchosComparados(null, null)).toEqual({ A: 0, B: 0 });
  });
});

describe("plan", () => {
  const f = (extra: Partial<FilaDelPlan>): FilaDelPlan => ({ ronda: 1, campaign_id: "e", grupo: "A", programado: "2026-11-12T09:30", mailchimp_id: "", enviado: "", enviados: null, hora_txt: "", ...extra });

  it("el estado de una celda: sin hora, sin borrador, borrador creado o salió", () => {
    expect(estadoDeCelda(null).texto).toBe("Sin hora");
    expect(estadoDeCelda(f({}))).toEqual({ texto: "Sin borrador", tono: "neutro" });
    expect(estadoDeCelda(f({ mailchimp_id: "abc123" }))).toEqual({ texto: "Borrador creado", tono: "info" });
    expect(estadoDeCelda(f({ mailchimp_id: "abc123", enviado: "2026-11-12T09:31:00" })).texto).toMatch(/^Salió /);
  });

  it("la banda del recordatorio lleva su fecha y si ya salió", () => {
    expect(cabeceraDeRonda(estado.horario.plan, 1)).toEqual({ fecha: "12/11", salio: false });
    expect(cabeceraDeRonda(estado.horario.plan, 2)).toEqual({ fecha: "", salio: false });
  });
});
