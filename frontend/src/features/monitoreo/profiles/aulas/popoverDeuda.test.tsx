import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

// `AulasPopoverReemplazo` pinta con `createPortal`, que en el render de
// servidor no produce nada: se prueba su CONTENIDO, que es lo que se dibuja.
import { ContenidoDeReemplazo } from "./AulasPopoverReemplazo";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * **Contra qué se elige, y el dilema cuando las dos varas no coinciden.**
 *
 * Gonzalo, 2026-09-10: «¿bajo qué concepto lo estamos haciendo, qué estamos
 * mejorando, y qué es lo que se tiene que mejorar en primer lugar?».
 */
const fila = (f: Record<string, unknown>) => f as unknown as MonitoreoAulasPlanRow;

const caido = fila({
  operational_code: "CH 23", classroom_id: "CH 23", faculty: "ARTES ESCÉNICAS",
  course_name: "Actuación I", stratum: "ARTES / F / G3", eligible_n: 62,
  sample_role: "titular", sex_top_1: "F", sex_top_1_n: 40, sex_top_2: "M", sex_top_2_n: 22,
  size_group: "G3", level: "3", modality: "presencial",
});

// Su cadena: se parece mucho al que releva, pero trae pocas mujeres.
const suCadena = fila({
  operational_code: "R 23.1", titular_operational_code: "CH 23", faculty: "ARTES ESCÉNICAS",
  course_name: "Actuación II", sample_role: "chain_reserve", eligible_n: 60,
  sex_top_1: "M", sex_top_1_n: 40, sex_top_2: "F", sex_top_2_n: 20,
  size_group: "G3", level: "3", modality: "presencial", tasa_efectividad_aula: 0.6,
});

// De otra cadena ya resuelta: se parece menos y trae justo lo que falta.
const alAire = fila({
  operational_code: "R 31.2", titular_operational_code: "CH 31", faculty: "ARTES ESCÉNICAS",
  course_name: "Danza contemporánea", sample_role: "chain_reserve", eligible_n: 50,
  sex_top_1: "F", sex_top_1_n: 46, sex_top_2: "M", sex_top_2_n: 4,
  size_group: "G1", level: "1", modality: "virtual", tasa_efectividad_aula: 0.6,
  // Ella sigue dormida: es la que se puede activar.
  sample_status: "sin_contactar", operational_status: "planificada",
});
// Su titular ya se aplicó: por eso la reserva de arriba queda «al aire» y nadie
// la espera. Es la definición del motor —`ESTADOS_QUE_LIBERAN`—, que mira
// `operational_status`, no el estado de muestra.
const titularDeEsaCadena = fila({
  operational_code: "CH 31", titular_operational_code: "CH 31", faculty: "ARTES ESCÉNICAS",
  sample_role: "titular", operational_status: "aplicada", respuestas_validas: 20,
});

const plan = [caido, suCadena, alAire, titularDeEsaCadena];

const pinta = (brecha?: { mujeres: number; hombres: number }) =>
  renderToStaticMarkup(
    <ContenidoDeReemplazo caido={caido} filas={plan} brecha={brecha} />,
  );

describe("el popover dice contra qué se elige", () => {
  it("publica la deuda por sexo de la facultad, separada", () => {
    // Separada y no sumada: una facultad puede ir sobrada en un sexo y corta en
    // el otro, y ahí un relevo del sexo cubierto no arregla nada.
    const html = pinta({ mujeres: 14, hombres: 0 });
    expect(html).toContain("mujeres por conseguir");
    expect(html).toContain("hombres por conseguir");
    expect(html).toContain("ARTES ESCÉNICAS");
  });

  it("sin brecha no promete una deuda que nadie midió", () => {
    expect(pinta()).not.toContain("por conseguir");
    expect(pinta({ mujeres: 0, hombres: 0 })).not.toContain("por conseguir");
  });

  it("enfrenta a los dos finalistas cuando no son el mismo", () => {
    // El de su cadena se parece más; el que está al aire trae las mujeres.
    const html = pinta({ mujeres: 14, hombres: 0 });
    expect(html).toContain("El dilema, en dos cursos-horario");
    expect(html).toContain("Protege el diseño");
    expect(html).toContain("Cierra la cuota");
  });

  it("sin brecha no hay dilema que resolver", () => {
    // Sin nada que cerrar, «ayuda» es cero para todos y la única vara es el
    // parecido: enfrentar dos aulas ahí sería inventar una decisión.
    expect(pinta()).not.toContain("El dilema");
  });
});
