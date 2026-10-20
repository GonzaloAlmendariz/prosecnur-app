import { describe, expect, it } from "vitest";

import { mailSendInvitation, type MailSend } from "../../../api/materialMail";
import {
  MAX_ENVIOS,
  agregarRecordatorio,
  asuntoDelEnvio,
  avisosDeFechas,
  cerrarApertura,
  conApertura,
  editarEnvio,
  enviosCambiados,
  enviosParaGuardar,
  esIdLocal,
  fechaCorta,
  pasosEnSurveyMonkey,
  quitarEnvio,
  reconciliarEnvios,
  rotuloDeEnvio,
} from "./modeloEnvios";

const INV: MailSend = { ...mailSendInvitation(), date: "2026-09-02" };

describe("modeloEnvios", () => {
  it("agrega recordatorios al final, sin fecha inventada, hasta 6 envíos", () => {
    let envios: MailSend[] = [INV];
    const ids: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const out = agregarRecordatorio(envios);
      envios = out.envios;
      if (out.sendId) ids.push(out.sendId);
    }
    expect(envios).toHaveLength(MAX_ENVIOS);
    expect(ids).toHaveLength(MAX_ENVIOS - 1);
    expect(envios[1]).toEqual({ send_id: ids[0], kind: "recordatorio", label: "Recordatorio 1", audience: "sin_respuesta" });
    expect(envios.map((e) => e.label).slice(1)).toEqual(["Recordatorio 1", "Recordatorio 2", "Recordatorio 3", "Recordatorio 4", "Recordatorio 5"]);
    expect(ids.every(esIdLocal)).toBe(true);
    // Sin la invitación, se pone la de fábrica primero.
    expect(agregarRecordatorio([]).envios[0].kind).toBe("invitacion");
  });

  it("quitar renumera los rótulos por defecto y respeta los escritos a mano; la invitación no se quita", () => {
    const a = agregarRecordatorio([INV]);
    const b = agregarRecordatorio(a.envios);
    const c = agregarRecordatorio(editarEnvio(b.envios, b.sendId!, { label: "Último aviso" }));
    const sin1 = quitarEnvio(c.envios, a.sendId!);
    expect(sin1.map((e) => e.label)).toEqual(["Invitación", "Último aviso", "Recordatorio 2"]);
    expect(quitarEnvio(sin1, "invitacion")).toHaveLength(3);
  });

  it("editar: un opcional vacío vuelve al de la plantilla; la invitación va a todos", () => {
    const [inv, r1] = agregarRecordatorio([INV]).envios;
    let envios = editarEnvio([inv, r1], r1.send_id, { subject: "Aún puede responder", audience: "ambos" });
    expect(envios[1]).toMatchObject({ subject: "Aún puede responder", audience: "ambos" });
    envios = editarEnvio(envios, r1.send_id, { subject: "  " });
    expect("subject" in envios[1]).toBe(false);
    expect(editarEnvio(envios, "invitacion", { audience: "parcial" })[0].audience).toBe("todos");
    expect(asuntoDelEnvio(envios[1], { subject: "Invitación" })).toBe("Invitación");
  });

  it("avisa si un recordatorio no viene después del envío previo", () => {
    const [inv, r1] = agregarRecordatorio([INV]).envios;
    expect(avisosDeFechas([inv, { ...r1, date: "2026-09-08" }])).toEqual([]);
    const aviso = avisosDeFechas([inv, { ...r1, date: "2026-09-02" }]);
    expect(aviso).toHaveLength(1);
    expect(aviso[0].sendId).toBe(r1.send_id);
    expect(aviso[0].detalle).toContain("02/09");
  });

  it("rótulos y fechas cortas", () => {
    expect(fechaCorta("2026-09-02")).toBe("02/09");
    expect(fechaCorta("2/9")).toBe("");
    expect(rotuloDeEnvio(INV)).toBe("Invitación · 02/09");
    expect(rotuloDeEnvio({ label: "Recordatorio 1" })).toBe("Recordatorio 1");
  });

  it("guardar manda sin ids locales y reconcilia por posición con los del servidor", () => {
    const { envios, sendId } = agregarRecordatorio([INV]);
    const enviados = enviosParaGuardar(envios);
    expect(enviados[1].send_id).toBe("");
    expect(enviados[0].send_id).toBe("invitacion");
    const vuelta: MailSend[] = [INV, { send_id: "recordatorio-4", kind: "recordatorio", label: "Recordatorio 1", audience: "sin_respuesta" }];
    const out = reconciliarEnvios(envios, vuelta);
    expect(out.ids).toEqual({ [sendId!]: "recordatorio-4" });
    expect(out.envios[1].send_id).toBe("recordatorio-4");
    expect(enviosCambiados(envios, out.envios)).toBe(true);
    expect(enviosCambiados(out.envios, [...out.envios])).toBe(false);
  });

  it("la apertura escrita sobre el correo va al envío; vacía al terminar, se quita", () => {
    const { envios, sendId } = agregarRecordatorio([INV]);
    const escrita = conApertura(envios, sendId!, "Le recordamos que aún puede responder hasta el **viernes**.");
    expect(escrita[1].opening).toContain("**viernes**");
    expect(escrita[0].opening).toBeUndefined();
    const vacia = conApertura(escrita, sendId!, "");
    expect(vacia[1].opening).toBe("");
    expect("opening" in cerrarApertura(vacia, sendId!)[1]).toBe(false);
    expect(cerrarApertura(escrita, sendId!)[1].opening).toContain("viernes");
  });

  it("pasos en SurveyMonkey: la invitación por el recopilador; el recordatorio por seguimiento y su audiencia", () => {
    expect(pasosEnSurveyMonkey(INV)).toEqual(["Recopilador", "Invitación por correo", "Mensaje", "HTML personalizado"]);
    expect(pasosEnSurveyMonkey({ kind: "recordatorio", audience: "sin_respuesta" })).toEqual(["Seguimiento", "Enviar recordatorio", "Sin respuesta"]);
  });
});
