import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MonitoreoMailchimpEnvio, MonitoreoMailchimpEstado, MonitoreoMailchimpPublico } from "../../../../../../api/monitoreoMailchimp";
import { campanas, csvDeInvalidos, secuenciaDeEnvios, tasasPorPublico } from "./correoModelo";
import { CorreoVista } from "./Correo";

const cifras = (entregados: number, abrieron: number, clics: number, respuestas: number) => ({
  enviados: entregados, entregados, rebotes_duros: 0, rebotes_blandos: 0, aperturas: abrieron, aperturas_sin_proxy: abrieron,
  clics, bajas: 0, quejas: 0, respuestas, tasa_apertura: null, tasa_clic: null, tasa_baja: 0, tasa_queja: 0,
});
const envio = (campaign_id: string, titulo: string, enviado_at: string, orden: number, actor: string, c: ReturnType<typeof cifras>): MonitoreoMailchimpEnvio => ({
  ...c, campaign_id, titulo, asunto: "", enviado_at, etiqueta: "PRUEBA ACREDITA", tipo: orden > 1 ? "recordatorio" : "invitacion", orden, actor, por_actor: [],
});
const publico = (actor: string, universo: number, extra: Partial<MonitoreoMailchimpPublico> = {}): MonitoreoMailchimpPublico => ({
  actor, universo, invitados: null, invalidos: 0, alcanzable: universo, efectivas: null, tasa_universo: null, tasa_alcanzable: null,
  bajas: 0, quejas: 0, envios: 0, ultimo: null, ritmo: "sin_envios", ritmo_motivo: "El público todavía no recibe envíos.", ...extra,
});

const envios = [
  envio("eb505ad1d8", "Recordatorio piloto", "2026-10-21T21:02:00Z", 2, "Piloto", cifras(5, 4, 0, 0)),
  envio("6d3c158034", "Invitación piloto", "2026-10-21T18:03:00Z", 1, "Piloto", cifras(7, 7, 2, 2)),
];
const publicos = [
  publico("Estudiantes de pregrado", 22820),
  publico("Piloto", 7, { efectivas: 2, tasa_alcanzable: 0.286, ritmo: "seguir", envios: 2 }),
];
const estado: MonitoreoMailchimpEstado = {
  ok: true, conectado: true, list_id: "e1a9ab97a5", leido_at: "2026-10-22T19:10:00Z", preparando: false,
  umbrales: { baja_espaciar: 0.005, queja_espaciar: 0.001, queja_detener: 0.003 }, avisos: [], publicos, envios,
  invalidos: { total: 0, por_actor: [], filas: [] },
};

describe("Control › Correo", () => {
  it("arma la secuencia por público en el orden de envío, con la siguiente columna vacía", () => {
    const secuencia = secuenciaDeEnvios(publicos, envios);
    expect(secuencia.columnas).toBe(3);
    expect(secuencia.filas[0].publico.actor).toBe("Piloto");
    expect(secuencia.filas[0].celdas.map((celda) => celda?.entregados ?? null)).toEqual([7, 5, null]);
    expect(secuencia.filas[1].celdas.every((celda) => celda === null)).toBe(true);
  });

  it("dice de qué invitación es recordatorio cada campaña", () => {
    const lista = campanas(publicos, envios);
    expect(lista.map((campana) => campana.campaignId)).toEqual(["6d3c158034", "eb505ad1d8"]);
    expect(lista[0].papeles).toEqual([{ publico: "Piloto", posicion: 1, rotulo: "Invitación", recordatorioDe: null }]);
    expect(lista[1].papeles[0]).toMatchObject({ rotulo: "Recordatorio 1", recordatorioDe: "Invitación piloto" });
  });

  it("ordena la tasa sobre la base alcanzable con los sin dato al final", () => {
    expect(tasasPorPublico(publicos).map((item) => item.publico)).toEqual(["Piloto", "Estudiantes de pregrado"]);
  });

  it("exporta inválidos solo con tokens y rótulos legibles", () => {
    const csv = csvDeInvalidos([{ token: "t1", actor: "Piloto", motivo: "rebote_duro", campaign_id: "6d3c158034", fecha: "2026-10-21" }], new Map([["6d3c158034", "Invitación piloto"]]), () => "Rebote");
    expect(csv.split("\n")[1]).toBe("t1,Piloto,Rebote,Invitación piloto,2026-10-21");
  });

  it("dibuja matriz, embudos, campañas y la columna derecha sin claves técnicas", () => {
    const html = renderToStaticMarkup(
      <CorreoVista estado={estado} audiencias={[{ id: "e1a9ab97a5", name: "PULSO PUCP", member_count: 7 }]} foco="Piloto" lectura={null} onElegirPublico={() => {}} onLeer={() => {}} onCambiarAudiencia={() => {}} />,
    );
    for (const texto of ["Secuencia de envíos por público", "Invitación", "Recordatorio 1", "Campañas", "PULSO PUCP", "Umbrales de ritmo", "Tasa sobre la base alcanzable", "Correos inválidos", "Sin envío"]) {
      expect(html).toContain(texto);
    }
    expect(html).toContain("Base alcanzable de 7");
    expect(html).not.toMatch(/sin_envios|rebote_duro|tasa_alcanzable|>seguir</);
  });
});
