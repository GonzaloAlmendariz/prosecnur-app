import { describe, expect, it } from "vitest";

import { alternarTelefonico, canalesDesde, quitarRonda, sumarRonda, tieneTelefonico } from "./canalesDelPublicoModelo";

// ADR 0125 §5: los canales de un público son una lista que crece por rondas.
describe("canales del público", () => {
  it("un público con el switch telefónico y sin canales migra a [correo, telefónico]", () => {
    const c = canalesDesde({ phone: { enabled: true, role: "target" } });
    expect(c.map((x) => x.canal)).toEqual(["correo", "telefonico"]);
    expect(canalesDesde({ phone: { enabled: false, role: "none" } })).toEqual([]);
  });

  it("sumar una ronda agrega la siguiente sin tocar las anteriores; quitar no renumera", () => {
    const base = canalesDesde({ phone: { enabled: false, role: "none" }, canales: [{ ronda: 1, canal: "telefonico" }] });
    const dos = sumarRonda(base, "correo");
    expect(dos).toEqual([{ ronda: 1, canal: "telefonico" }, { ronda: 2, canal: "correo" }]);
    expect(quitarRonda(sumarRonda(dos, "presencial"), 2).map((c) => c.ronda)).toEqual([1, 3]);
  });

  it("el switch telefónico suma o quita las rondas telefónicas", () => {
    const on = alternarTelefonico([]);
    expect(on).toEqual([{ ronda: 1, canal: "correo" }, { ronda: 2, canal: "telefonico" }]);
    expect(tieneTelefonico(alternarTelefonico(on))).toBe(false);
    expect(alternarTelefonico(on)).toEqual([{ ronda: 1, canal: "correo" }]);
  });

  it("descarta canales desconocidos y rondas repetidas, y ordena", () => {
    const c = canalesDesde({
      phone: { enabled: false, role: "none" },
      canales: [{ ronda: 3, canal: "correo" }, { ronda: 1, canal: "fax" }, { ronda: 2, canal: "presencial" }, { ronda: 2, canal: "correo" }],
    });
    expect(c).toEqual([{ ronda: 2, canal: "presencial" }, { ronda: 3, canal: "correo" }]);
  });
});
