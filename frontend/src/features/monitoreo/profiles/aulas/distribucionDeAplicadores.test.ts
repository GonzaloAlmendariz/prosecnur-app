import { describe, expect, it } from "vitest";
import {
  avisoDistribucion,
  avisoDistribucionPublicada,
  enlaceDeDistribucion,
} from "./distribucionDeAplicadores";

/**
 * S7 (loop estética-aulas-sheets, 2026-09-07). El Sheets que leen los
 * aplicadores quedó viejo el día 1 —85 citas vigentes contra 83 publicadas,
 * 20 cambios de persona— y nada en pantalla lo decía. Ahora la config recuerda
 * el destino y la huella de lo publicado, y el tablero trae la huella del
 * reparto vigente: el aviso dice si coinciden, y si no, la salida.
 */
describe("avisoDistribucion", () => {
  const recordado = { spreadsheet_id: "ABC", url: "https://docs.google.com/spreadsheets/d/ABC/edit", updated_at: "2026-09-07T14:10:00Z", huella: "h-1", citas: 83 };

  it("nunca publicada: lo dice y da la salida", () => {
    const a = avisoDistribucion(null, { huella: "h-2", citas: 85 });
    expect(a.estado).toBe("nunca");
    expect(a.texto).toMatch(/todav[ií]a no se ha publicado/i);
    expect(a.texto).toMatch(/pega el enlace/i);
    expect(a.tono).toBe("atencion");
  });

  it("vigente: la misma huella, y lo dice en calma", () => {
    const a = avisoDistribucion(recordado, { huella: "h-1", citas: 83 });
    expect(a.estado).toBe("vigente");
    expect(a.texto).toContain("83 citas");
    expect(a.tono).toBe("ok");
  });

  it("cambiado: huella distinta, cuenta la diferencia y da la salida", () => {
    const a = avisoDistribucion(recordado, { huella: "h-2", citas: 85 });
    expect(a.estado).toBe("cambiado");
    expect(a.texto).toMatch(/El reparto cambió desde la última publicación/);
    expect(a.texto).toContain("85 citas ahora");
    expect(a.texto).toContain("83 publicadas");
    expect(a.texto).toMatch(/Publica de nuevo/);
    expect(a.tono).toBe("atencion");
  });

  it("sin huella actual (sin digest en el servidor) no afirma que coincide", () => {
    const a = avisoDistribucion(recordado, { huella: "", citas: 85 });
    expect(a.estado).toBe("indeterminado");
    expect(a.tono).toBe("atencion");
  });

  it("el enlace recordado se deriva del id cuando falta la url", () => {
    expect(enlaceDeDistribucion({ spreadsheet_id: "XYZ" })).toBe("https://docs.google.com/spreadsheets/d/XYZ/edit");
    expect(enlaceDeDistribucion(null)).toBe("");
  });

  it("sin em dashes", () => {
    for (const a of [avisoDistribucion(null, { huella: "x", citas: 1 }), avisoDistribucion(recordado, { huella: "h-2", citas: 85 })]) {
      expect(a.texto).not.toContain("—");
    }
  });

  // **Aulas agendadas a las que no va nadie.** El 08/09 había seis y hubo que
  // cruzarlas a mano con la agenda porque ninguna pantalla las decía: son dos
  // preguntas distintas y ésta es la que deja a alguien sin ir.
  describe("agendadas sin cita", () => {
    it("manda sobre «vigente»: el Sheets puede estar al día y aun así faltar aulas", () => {
      const a = avisoDistribucion(recordado, {
        huella: "h-1",
        citas: 83,
        agendadas_sin_cita: 2,
        sin_cita: [
          { curso_horario: "CH 35", fecha: "09/09" },
          { curso_horario: "CH 40", fecha: "11/09" },
        ],
      });
      expect(a.estado).toBe("sin-cita");
      expect(a.tono).toBe("atencion");
      // Las NOMBRA: un «faltan 2» sin los códigos obliga a cruzarlo otra vez.
      expect(a.texto).toContain("CH 35 (09/09)");
      expect(a.texto).toContain("CH 40 (11/09)");
      expect(a.texto).toMatch(/Asigna a alguien/);
      expect(a.texto).not.toContain("—");
    });

    it("una sola aula se dice en singular", () => {
      const a = avisoDistribucion(recordado, {
        huella: "h-1", citas: 83, agendadas_sin_cita: 1,
        sin_cita: [{ curso_horario: "CH 83", fecha: "12/09" }],
      });
      expect(a.texto).toContain("1 aula agendada no tiene");
      expect(a.texto).not.toContain("aulas agendadas no tienen");
    });

    it("en cero no dice nada y el aviso de siempre sigue mandando", () => {
      // Un cero SE CALLA aquí, al revés que en el recibo de la sincronización:
      // este aviso convive con otros y repetir «no falta ninguna» en cada
      // recarga es ruido que apaga al que sí importa.
      const a = avisoDistribucion(recordado, { huella: "h-1", citas: 83, agendadas_sin_cita: 0 });
      expect(a.estado).toBe("vigente");
    });

    it("sin el campo se comporta como antes: el tablero viejo no rompe la pantalla", () => {
      const a = avisoDistribucion(recordado, { huella: "h-2", citas: 85 });
      expect(a.estado).toBe("cambiado");
    });

    it("un conteo sin lista sigue avisando, con la cuenta sola", () => {
      const a = avisoDistribucion(recordado, { huella: "h-1", citas: 83, agendadas_sin_cita: 3 });
      expect(a.estado).toBe("sin-cita");
      expect(a.texto).toContain("3 aulas agendadas no tienen");
    });
  });
});

/**
 * Publicar con una pestaña por semana ya no es una sola cosa.
 *
 * La semana que el coordinador está editando se RESPETA y no se escribe. El
 * aviso sólo decía «N publicadas» —el total del reparto—, así que una semana
 * respetada era invisible y el número prometía más de lo escrito.
 */
describe("el aviso de la distribución publicada dice qué NO se tocó", () => {
  it("nombra la semana respetada y su motivo", () => {
    const aviso = avisoDistribucionPublicada({
      citas: 50,
      hojas: [
        { hoja: "Semana 1", accion: "respetada", filas: 101 },
        { hoja: "Semana 2", accion: "actualizada", filas: 50 },
      ],
    });
    expect(aviso.texto).toContain("«Semana 2»");
    expect(aviso.texto).toContain("«Semana 1»");
    expect(aviso.texto).toMatch(/no se tocó/);
    expect(aviso.texto).toMatch(/manda el equipo/);
    // Respetar es lo correcto: no es una alarma.
    expect(aviso.tono).toBe("ok");
  });

  it("sin desglose por hoja sigue diciendo lo de siempre", () => {
    const aviso = avisoDistribucionPublicada({ citas: 50 });
    expect(aviso.texto).toContain("50");
    expect(aviso.texto).not.toMatch(/no se tocó/);
    expect(aviso.tono).toBe("ok");
  });
});
