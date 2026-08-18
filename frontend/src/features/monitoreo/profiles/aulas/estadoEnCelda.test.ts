import { describe, expect, it } from "vitest";

import { ESTADOS_OPERATIVOS } from "./aulasPresentation";
import { colorDeEstado } from "./EstadoEnCelda";
import { TRAMOS_DE_APLICACION } from "./estadoDeAplicacion";

/**
 * Una lista cerrada que no reconoce un valor lo deja en texto plano SIN avisar,
 * y así estuvieron las 168 filas de Brechas enseñando «Planificada» en gris de
 * texto al lado de otra tabla que sí coloreaba. Estos asertos hacen ruidoso el
 * silencio: un estado nuevo en el vocabulario del motor rompe el test en vez de
 * aparecer descolorido en pantalla.
 */
describe("colorDeEstado", () => {
  it("colorea TODOS los estados operativos del vocabulario", () => {
    const sinColor = ESTADOS_OPERATIVOS.filter((e) => !colorDeEstado(e.label));
    expect(sinColor.map((e) => e.value)).toEqual([]);
  });

  it("colorea TODOS los tramos de aplicación", () => {
    const sinColor = TRAMOS_DE_APLICACION.filter((t) => !colorDeEstado(t.etiqueta));
    expect(sinColor.map((t) => t.clave)).toEqual([]);
  });

  it("los dos vocabularios coinciden donde comparten rótulo", () => {
    // «Agendada» y «Reemplazada» existen en los dos. Si divergieran, la misma
    // palabra saldría de dos colores según la tabla que la muestre.
    for (const compartido of ["Agendada", "Reemplazada"]) {
      const tramo = TRAMOS_DE_APLICACION.find((t) => t.etiqueta === compartido);
      const operativo = ESTADOS_OPERATIVOS.find((e) => e.label === compartido);
      expect(tramo && operativo, `${compartido} debería estar en los dos`).toBeTruthy();
      expect(colorDeEstado(compartido)).toBe(tramo?.color);
    }
  });

  it("un valor que no es estado no se colorea", () => {
    // Mejor sin color que con un color que signifique otra cosa.
    expect(colorDeEstado("Equipo 3")).toBeNull();
    expect(colorDeEstado("")).toBeNull();
  });

  it("«EN RESERVA 3» es el mismo estado que «En reserva»", () => {
    expect(colorDeEstado("EN RESERVA 3")).toBe(colorDeEstado("En reserva"));
  });
});
