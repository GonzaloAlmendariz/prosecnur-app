/**
 * Un proyecto recién creado no tiene marco, y la pantalla debe decir eso.
 *
 * Medido abriendo un `.pulso` nuevo: `state.aulas.frame` llega como `{}`, no
 * como `null`. Con `Boolean(frame)` ese objeto vacío contaba como marco
 * construido, y la cadena de mensajes de Criterios del estudiante acababa
 * diciendo «El marco ejecutado no es verificable contra su radiografía.
 * Reconstruye el marco para recuperar cifras acreditables» a alguien que nunca
 * lo había construido —pidiendo rehacer algo inexistente y tapando el mensaje
 * correcto, que ya estaba escrito más abajo en la misma cadena—.
 */
import { describe, expect, it } from "vitest";

import { frameIntegrity, marcoFueConstruido } from "../frameIntegrity";
import type { CalcMuestraAulasState } from "../../../../../api/client";

const frame = (v: unknown) => v as CalcMuestraAulasState["frame"];

describe("marcoFueConstruido", () => {
  it("el objeto vacío del proyecto nuevo NO cuenta como marco", () => {
    // EL caso medido. `{}` es como llega un marco ausente desde el backend.
    expect(marcoFueConstruido(frame({}))).toBe(false);
    expect(marcoFueConstruido(null)).toBe(false);
    expect(marcoFueConstruido(undefined)).toBe(false);
  });

  it("un marco con hash sí cuenta", () => {
    expect(marcoFueConstruido(frame({ frame_hash: "e9ca263081" }))).toBe(true);
  });

  it("un hash vacío o no textual no cuenta", () => {
    // Sin hash utilizable no hubo construcción que verificar; tratarlo como
    // marco devuelve el mensaje equivocado.
    expect(marcoFueConstruido(frame({ frame_hash: "" }))).toBe(false);
    expect(marcoFueConstruido(frame({ frame_hash: "   " }))).toBe(false);
    expect(marcoFueConstruido(frame({ frame_hash: 0 }))).toBe(false);
    expect(marcoFueConstruido(frame({ frame_hash: null }))).toBe(false);
  });

  it("no basta con que el marco traiga otras claves", () => {
    // Un frame a medio serializar tampoco es un marco construido.
    expect(marcoFueConstruido(frame({ aula_frame: [], perfil: {} }))).toBe(false);
  });

  it("distingue ausencia de no-verificabilidad, que es el punto", () => {
    // `frameIntegrity` clasifica el marco vacío como "unverifiable" porque no
    // tiene proyecciones que contrastar. Eso está bien para lo suyo, pero no
    // puede leerse como «se construyó y no se puede verificar»: son dos
    // situaciones con acciones opuestas —calcular por primera vez contra
    // reconstruir—.
    expect(frameIntegrity(frame({})).status).toBe("unverifiable");
    expect(marcoFueConstruido(frame({}))).toBe(false);
  });
});
