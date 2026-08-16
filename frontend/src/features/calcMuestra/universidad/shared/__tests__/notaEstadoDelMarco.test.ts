/**
 * La cabecera no puede pedir REconstruir un marco que nunca se construyó.
 *
 * Medido sobre un proyecto recién creado en una pila limpia: los dos KPIs de
 * elegibles decían «frame no verificable · reconstruye». `frameIntegrity`
 * clasifica el marco ausente como `unverifiable` —correcto para lo suyo: sin
 * proyecciones no hay nada que contrastar—, pero esa etiqueta se estaba leyendo
 * como «se construyó y no cuadra», que pide la acción contraria.
 *
 * Es el mismo defecto que ya se reparó en Criterios del estudiante, y aquí pesa
 * más: esta tira acompaña a todas las pestañas del módulo.
 */
import { describe, expect, it } from "vitest";

import type { CalcMuestraAulasState } from "../../../../../api/client";
import { frameIntegrity, notaEstadoDelMarco } from "../frameIntegrity";

const frame = (value: unknown) => value as CalcMuestraAulasState["frame"];

/** Marco construido y cuadrado: las cuatro proyecciones dan el mismo conteo. */
const marcoSano = frame({
  frame_hash: "e9ca263081",
  aula_frame: [{ included: true }, { included: true }, { included: false }],
  perfil: { marco_aulas: 2, universo: 100, poblacion_n: 80 },
  exploracion: { totales: { ch_elegibles: 2 } },
  audit: [{ metric: "classroom_included_n", value: 2 }],
});

describe("notaEstadoDelMarco", () => {
  it("un proyecto recién creado no pide reconstruir nada", () => {
    // EL caso medido. `{}` es como llega un marco ausente desde el backend.
    expect(notaEstadoDelMarco(frame({}))).toBe("sin construir · calcula elegibles");
    expect(notaEstadoDelMarco(null)).toBe("sin construir · calcula elegibles");
    expect(notaEstadoDelMarco(undefined)).toBe("sin construir · calcula elegibles");

    // Y lo que hace falso al mensaje viejo: sin marco, la integridad dice
    // «unverifiable», que es de donde salía el «reconstruye».
    expect(frameIntegrity(frame({})).status).toBe("unverifiable");
    expect(notaEstadoDelMarco(frame({}))).not.toContain("reconstruye");
  });

  it("un marco construido que no se puede verificar sí pide reconstruirlo", () => {
    // Hay hash —hubo construcción real— pero faltan proyecciones que contrastar.
    const sinProyecciones = frame({ frame_hash: "e9ca263081", perfil: { marco_aulas: 2 } });
    expect(frameIntegrity(sinProyecciones).status).toBe("unverifiable");
    expect(notaEstadoDelMarco(sinProyecciones)).toBe("frame no verificable · reconstruye");
  });

  it("un marco cuyas proyecciones se contradicen se nombra incoherente", () => {
    const incoherente = frame({
      frame_hash: "e9ca263081",
      aula_frame: [{ included: true }, { included: true }],
      perfil: { marco_aulas: 7 },
      exploracion: { totales: { ch_elegibles: 7 } },
    });
    expect(frameIntegrity(incoherente).status).toBe("inconsistent");
    expect(notaEstadoDelMarco(incoherente)).toBe("frame incoherente · reconstruye");
  });

  it("un marco sano no advierte nada", () => {
    expect(frameIntegrity(marcoSano).status).toBe("consistent");
    expect(notaEstadoDelMarco(marcoSano)).toBeNull();
  });

  it("los tres estados se distinguen entre sí", () => {
    // Sin este contraste, una implementación que devolviera siempre el mismo
    // texto para todo lo que no está sano pasaría los casos de arriba leídos
    // uno a uno.
    const notas = [
      notaEstadoDelMarco(frame({})),
      notaEstadoDelMarco(frame({ frame_hash: "e9ca263081", perfil: { marco_aulas: 2 } })),
      notaEstadoDelMarco(frame({
        frame_hash: "e9ca263081",
        aula_frame: [{ included: true }],
        perfil: { marco_aulas: 9 },
        exploracion: { totales: { ch_elegibles: 9 } },
      })),
      notaEstadoDelMarco(marcoSano),
    ];
    expect(new Set(notas).size).toBe(4);
  });

  it("un hash vacío cuenta como no construido, no como marco roto", () => {
    // Un frame a medio serializar no acredita una construcción.
    expect(notaEstadoDelMarco(frame({ frame_hash: "" }))).toBe("sin construir · calcula elegibles");
    expect(notaEstadoDelMarco(frame({ frame_hash: "   " }))).toBe("sin construir · calcula elegibles");
    expect(notaEstadoDelMarco(frame({ aula_frame: [], perfil: {} }))).toBe("sin construir · calcula elegibles");
  });
});
