import { describe, expect, it } from "vitest";
import { avisoLibroImportado } from "./avisoLibroImportado";

const completo = {
  resumen: {
    unidades: 269, titulares: 170, reservas: 26, contactadas: 196,
    partes_de_campo: 152, filas_de_control: 152,
  },
};

describe("avisoLibroImportado", () => {
  it("dice qué entró: aulas, cadena y los dos registros", () => {
    expect(avisoLibroImportado(completo).texto).toBe(
      "Entraron 269 aulas (170 titulares y 26 reservas), 152 partes de campo y 152 filas de control.",
    );
  });

  it("una columna sin nombre se anuncia CON su causa", () => {
    // El backend calcula `control_sin_nombre` precisamente para avisar de que
    // no se leyó todo, y no avisaba de nada. Descartar en silencio es el
    // defecto: el aviso tiene que decir por qué, no sólo que pasó.
    const { texto } = avisoLibroImportado({ ...completo, control_sin_nombre: [31, 32, 33] });
    expect(texto).toContain("3 columnas");
    expect(texto).toContain("su cabecera no las nombra");
  });

  it("una sola columna no dice «1 columnas traían»", () => {
    const { texto } = avisoLibroImportado({ ...completo, control_sin_nombre: [31] });
    expect(texto).toContain("1 columna de la base de control traía datos");
    expect(texto).toContain("no la nombra");
  });

  it("las hojas ausentes siguen anunciándose, junto a lo que sí entró", () => {
    const { texto } = avisoLibroImportado({ ...completo, hojas_ausentes: ["Base de control"] });
    // El control: antes esto era lo ÚNICO que se decía.
    expect(texto).toContain("Entraron 269 aulas");
    expect(texto).toContain("no traía Base de control");
  });

  it("un libro sin nada que leer lo dice, en vez de callar", () => {
    expect(avisoLibroImportado({ resumen: {} }).texto).toBe("El libro no traía nada que leer.");
  });

  it("omite los registros que llegaron a cero sin dejar la coma suelta", () => {
    const { texto } = avisoLibroImportado({
      resumen: { unidades: 269, titulares: 170, reservas: 26, contactadas: 0,
                 partes_de_campo: 0, filas_de_control: 0 },
    });
    expect(texto).toBe("Entraron 269 aulas (170 titulares y 26 reservas).");
  });

  it("una importación limpia NO se anuncia con el tono de las que piden mirar", () => {
    // El control: sin tono, este caso y el de abajo se pintaban igual, y el
    // rótulo valía igual para dos diagnósticos opuestos.
    expect(avisoLibroImportado(completo).tono).toBe("ok");
  });

  it("una hoja ausente o una columna sin leer piden atención", () => {
    expect(avisoLibroImportado({ ...completo, hojas_ausentes: ["Base de control"] }).tono)
      .toBe("atencion");
    expect(avisoLibroImportado({ ...completo, control_sin_nombre: [31] }).tono)
      .toBe("atencion");
    expect(avisoLibroImportado({ resumen: {} }).tono).toBe("atencion");
  });
});
