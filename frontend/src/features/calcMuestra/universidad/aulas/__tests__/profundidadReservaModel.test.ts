/**
 * El semáforo de reservas se mide contra el objetivo DECLARADO.
 *
 * La cabecera pintaba alerta bajo 1 y «holgado» a partir de 2, escritos a mano.
 * Coinciden con `reserve_depth_target: 1` de fábrica y por eso nunca se notó,
 * pero el objetivo es configurable y el motor sí lo respeta: avisa
 * «Profundidad de reservas menor al objetivo» cuando la media de `depth_ratio`
 * queda por debajo. Con un objetivo de 3, la pantalla decía «holgado» con 2
 * mientras el motor avisaba.
 */
import { describe, expect, it } from "vitest";
import { profundidadReserva } from "../profundidadReservaModel";

describe("profundidadReserva", () => {
  it("con el objetivo de fábrica se comporta como siempre", () => {
    // Compatibilidad: 1 y 2 eran los números escritos a mano, y con objetivo 1
    // el modelo los reproduce exactamente.
    expect(profundidadReserva(0.5, 1)?.tono).toBe("alerta");
    expect(profundidadReserva(1, 1)?.tono).toBeUndefined();
    expect(profundidadReserva(1.9, 1)?.tono).toBeUndefined();
    expect(profundidadReserva(2, 1)?.tono).toBe("ok");
    expect(profundidadReserva(11, 1)?.tono).toBe("ok");
  });

  it("un objetivo más exigente mueve el semáforo", () => {
    // EL caso: con objetivo 3, dos reservas por titular NO son holgura — el
    // motor ya avisaba y la pantalla decía lo contrario.
    expect(profundidadReserva(2, 3)?.tono).toBe("alerta");
    expect(profundidadReserva(3, 3)?.tono).toBeUndefined();
    expect(profundidadReserva(6, 3)?.tono).toBe("ok");
  });

  it("marca cuando el objetivo no es el de fábrica", () => {
    // Un tono sólo se lee si se sabe contra qué se mide.
    expect(profundidadReserva(2, 3)?.objetivoExplicito).toBe(true);
    expect(profundidadReserva(2, 1)?.objetivoExplicito).toBe(false);
  });

  it("un objetivo inválido cae al de fábrica en vez de pintar todo verde", () => {
    // Con objetivo 0 la comparación degenera y todo quedaría en "ok".
    expect(profundidadReserva(0.5, 0)?.objetivo).toBe(1);
    expect(profundidadReserva(0.5, 0)?.tono).toBe("alerta");
    expect(profundidadReserva(0.5, null)?.tono).toBe("alerta");
    expect(profundidadReserva(0.5, Number.NaN)?.tono).toBe("alerta");
    expect(profundidadReserva(0.5, -3)?.objetivo).toBe(1);
  });

  it("sin mínimo medible no hay semáforo", () => {
    expect(profundidadReserva(Number.NaN, 1)).toBeNull();
    expect(profundidadReserva(Number.POSITIVE_INFINITY, 1)).toBeNull();
  });
});
