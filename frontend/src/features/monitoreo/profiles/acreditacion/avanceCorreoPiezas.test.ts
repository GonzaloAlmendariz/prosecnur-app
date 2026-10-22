import { describe, expect, it } from "vitest";

import { normalizeMonitoreoMailchimpEstado } from "../../../../api/monitoreoMailchimp";
import { cronologiaDeEnvios, nodoInicial, TAMANO_MAX, TAMANO_MIN } from "./avanceCorreoCronologiaModelo";
import { anchoDePaso, embudoCorreo, serieDeRespuestas, tramoDelPublico } from "./avanceCorreoEmbudoModelo";
import {
  barraDeRespuesta,
  haceCuanto,
  nivelBaja,
  nivelQueja,
  ordenarPublicos,
  todosSinEnvios,
} from "./avanceCorreoMatriz";
import { ESTADO_CORREO_INICIAL, reducirCorreo } from "./avanceCorreoModelo";

const UMBRALES = { baja_espaciar: 0.005, queja_espaciar: 0.001, queja_detener: 0.003 };

const envio = (o: Record<string, unknown>) => ({
  titulo: "", asunto: "", etiqueta: "", tipo: "invitacion", orden: 1, rebotes_duros: 0, rebotes_blandos: 0,
  aperturas: 0, aperturas_sin_proxy: 0, clics: 0, bajas: 0, quejas: 0, respuestas: 0,
  tasa_apertura: null, tasa_clic: null, tasa_baja: null, tasa_queja: null, por_actor: [], ...o,
});

// Dos públicos: A recibe invitación (27/10) y recordatorio (30/10); el
// recordatorio también tocó a B (desglose por público).
const ESTADO = normalizeMonitoreoMailchimpEstado({
  conectado: true, list_id: "l", leido_at: "2026-10-30T15:00:00Z",
  envios: [
    envio({ campaign_id: "c2", enviado_at: "2026-10-30T13:00:00Z", actor: "A", orden: 2, tipo: "recordatorio",
      enviados: 120, entregados: 118, rebotes_duros: 2, aperturas: 60, aperturas_sin_proxy: 40, clics: 20, respuestas: 12,
      por_actor: [
        { actor: "A", enviados: 100, entregados: 99, rebotes_duros: 1, aperturas: 50, aperturas_sin_proxy: null, clics: 15, respuestas: 10 },
        { actor: "B", enviados: 20, entregados: 19, rebotes_duros: 1, aperturas: 10, aperturas_sin_proxy: null, clics: 5, respuestas: 2 },
      ] }),
    envio({ campaign_id: "c1", enviado_at: "2026-10-27T13:00:00Z", actor: "A",
      enviados: 200, entregados: 190, rebotes_duros: 8, rebotes_blandos: 2, aperturas: 120, aperturas_sin_proxy: 80, clics: 50, respuestas: 30 }),
  ],
});

describe("embudo del correo", () => {
  it("sin filtro suma todos los envíos y usa las aperturas sin Apple", () => {
    const e = embudoCorreo(ESTADO.envios, "");
    expect(e.envios).toBe(2);
    expect(e.aperturasConApple).toBe(false);
    expect(e.pasos.map((p) => [p.clave, p.valor])).toEqual([
      ["enviados", 320], ["entregados", 308], ["abrieron", 120], ["clic", 70], ["respondieron", 42],
    ]);
    const entregados = e.pasos[1];
    expect(entregados.perdida).toEqual({ etiqueta: "rebotaron", valor: 12 });
    expect(entregados.sobreAnterior).toBeCloseTo(308 / 320);
    expect(e.pasos[4].sobreAnterior).toBeCloseTo(42 / 70);
    expect(e.pasos[4].sobreInicio).toBeCloseTo(42 / 320);
    expect(e.pasos[4].baseAnterior).toEqual({ valor: 70, nombre: "con clic" });
  });

  it("filtrado por público toma su tramo del desglose y avisa que las aperturas incluyen Apple", () => {
    const e = embudoCorreo(ESTADO.envios, "A");
    expect(e.envios).toBe(2);
    expect(e.pasos.map((p) => p.valor)).toEqual([300, 289, 170, 65, 40]);
    expect(e.aperturasConApple).toBe(true);
    expect(e.pasos[2].etiqueta).toBe("Abrieron (con Apple)");
    const b = embudoCorreo(ESTADO.envios, "B");
    expect(b.envios).toBe(1);
    expect(b.pasos[0].valor).toBe(20);
  });

  it("un público sin envíos da un embudo vacío, no ceros inventados", () => {
    const e = embudoCorreo(ESTADO.envios, "C");
    expect(e.envios).toBe(0);
    expect(e.pasos.every((p) => p.valor === null)).toBe(true);
  });

  it("si las respuestas superan a los clics no se inventa una pérdida negativa", () => {
    const e = embudoCorreo([ESTADO.envios[1]].map((x) => ({ ...x, respuestas: 60 })), "");
    expect(e.pasos[4].perdida).toBeNull();
  });

  it("el tramo de un envío sin desglose es el envío entero solo para su público", () => {
    const c1 = ESTADO.envios.find((x) => x.campaign_id === "c1")!;
    expect(tramoDelPublico(c1, "A")?.parcial).toBe(false);
    expect(tramoDelPublico(c1, "B")).toBeNull();
  });

  it("ancho de paso con piso visible", () => {
    expect(anchoDePaso(1, 10000)).toBe(0.6);
    expect(anchoDePaso(0, 10)).toBe(0);
    expect(anchoDePaso(null, 10)).toBe(0);
    expect(anchoDePaso(5, 10)).toBe(50);
  });

  it("la serie del público sigue el orden de salida: invitación, recordatorio 1", () => {
    expect(serieDeRespuestas(ESTADO.envios, "A").map((p) => [p.rotuloCorto, p.respuestas])).toEqual([["Inv.", 30], ["R1", 10]]);
    // Para B el recordatorio de A es su primer correo: su invitación.
    expect(serieDeRespuestas(ESTADO.envios, "B").map((p) => p.rotulo)).toEqual(["Invitación"]);
  });
});

describe("matriz de públicos", () => {
  const P = normalizeMonitoreoMailchimpEstado({
    publicos: [
      { actor: "Beta", universo: 100, tasa_alcanzable: 0.1, tasa_universo: 0.09, ritmo: "seguir" },
      { actor: "Alfa", universo: 500, tasa_alcanzable: null, ritmo: "sin_envios" },
      { actor: "Gama", universo: 50, tasa_alcanzable: 0.4, tasa_universo: 0.38, ritmo: "espaciar" },
    ],
  }).publicos;

  it("ordena por tasa (sin dato al final), universo o nombre", () => {
    expect(ordenarPublicos(P, "tasa").map((p) => p.actor)).toEqual(["Gama", "Beta", "Alfa"]);
    expect(ordenarPublicos(P, "universo").map((p) => p.actor)).toEqual(["Alfa", "Beta", "Gama"]);
    expect(ordenarPublicos(P, "nombre").map((p) => p.actor)).toEqual(["Alfa", "Beta", "Gama"]);
  });

  it("«sin envíos» colapsa solo si nadie recibió envíos", () => {
    expect(todosSinEnvios(P)).toBe(false);
    expect(todosSinEnvios(P.map((p) => ({ ...p, ritmo: "sin_envios" as const })))).toBe(true);
    expect(todosSinEnvios([])).toBe(false);
  });

  it("bajas y quejas se colorean solo al cruzar el umbral", () => {
    expect(nivelBaja(0.004, UMBRALES)).toBe("ok");
    expect(nivelBaja(0.005, UMBRALES)).toBe("advertencia");
    expect(nivelQueja(0.0005, UMBRALES)).toBe("ok");
    expect(nivelQueja(0.001, UMBRALES)).toBe("advertencia");
    expect(nivelQueja(0.003, UMBRALES)).toBe("alerta");
    expect(nivelQueja(null, UMBRALES)).toBe("sin-dato");
  });

  it("la barra: relleno sobre la base alcanzable y marca sobre el universo", () => {
    expect(barraDeRespuesta({ tasa_alcanzable: 0.137, tasa_universo: 0.1367 })).toEqual({ relleno: 13.700000000000001, marca: 13.669999999999998 });
    expect(barraDeRespuesta({ tasa_alcanzable: null, tasa_universo: null })).toEqual({ relleno: 0, marca: null });
  });

  it("tiempo relativo de la lectura", () => {
    const t = Date.parse("2026-10-22T16:00:00Z");
    expect(haceCuanto("2026-10-22T15:59:40Z", t)).toBe("hace un momento");
    expect(haceCuanto("2026-10-22T15:48:00Z", t)).toBe("hace 12 min");
    expect(haceCuanto("2026-10-22T13:00:00Z", t)).toBe("hace 3 h");
    expect(haceCuanto("2026-10-20T16:00:00Z", t)).toBe("hace 2 días");
    expect(haceCuanto("", t)).toBe("");
  });

  it("elegir el mismo público dos veces lo suelta", () => {
    const uno = reducirCorreo(ESTADO_CORREO_INICIAL, { tipo: "publico", publico: "A" });
    expect(uno.publico).toBe("A");
    expect(reducirCorreo(uno, { tipo: "publico", publico: "A" }).publico).toBe("");
    expect(reducirCorreo(uno, { tipo: "publico", publico: "" }).publico).toBe("");
  });
});

describe("cronología", () => {
  it("un carril por público, nodos en orden y escala de tamaño por respuestas", () => {
    const c = cronologiaDeEnvios(ESTADO.envios);
    expect(c.carriles.map((x) => x.publico)).toEqual(["A", "B"]);
    const a = c.carriles[0].nodos;
    expect(a.map((n) => [n.envio.campaign_id, n.tipo, n.rotulo])).toEqual([
      ["c1", "invitacion", "Invitación"], ["c2", "recordatorio", "Recordatorio 1"],
    ]);
    expect(a[0].x).toBeLessThan(a[1].x);
    expect(a[0].tamano).toBe(TAMANO_MAX);
    expect(c.carriles[1].nodos[0].tamano).toBeGreaterThan(TAMANO_MIN - 1);
    expect(c.fechas.map((f) => f.rotulo)).toHaveLength(2);
  });

  it("dos envíos del mismo día en un carril no se montan", () => {
    const mismos = ESTADO.envios.map((e) => ({ ...e, enviado_at: "2026-10-27T13:00:00Z", por_actor: [] }));
    const [n1, n2] = cronologiaDeEnvios(mismos).carriles[0].nodos;
    expect(n2.x - n1.x).toBeGreaterThanOrEqual(3);
  });

  it("el nodo inicial es el último envío", () => {
    expect(nodoInicial(cronologiaDeEnvios(ESTADO.envios))?.envio.campaign_id).toBe("c2");
    expect(nodoInicial(cronologiaDeEnvios([]))).toBeNull();
  });
});
