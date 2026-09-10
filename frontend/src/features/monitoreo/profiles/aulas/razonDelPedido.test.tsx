import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasAlertaDeAnticipacion } from "./AulasAlertaDeAnticipacion";
import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * **«¿En base a qué te basas?»**
 *
 * Gonzalo lo preguntó dos veces sobre «A quién hay que agendar»: «no entiendo en
 * base a qué te basas» y «no está claro las que hay que agendar, por qué me
 * estás diciendo que hay que agendarlas».
 *
 * La fila daba el principio —«faltan 7»— y el final —«pedir 2»—, y entre los dos
 * hay un paso que no estaba: **cuánto deja un curso-horario de esa facultad**.
 * Sin él, los dos números no se relacionan con nada, y el pie explicaba la regla
 * general sin aplicarla a la fila que se está mirando.
 */

/**
 * Los nombres son los REALES del parte y de la agenda —`applied_at`,
 * `effective_surveys`, `scheduled_date`—, copiados del test de
 * `proyeccionPorAgenda`. Inventarlos deja el fixture en la rama «S/D» y el test
 * pasa sin ejercitar nada, que es como se cuela un verde vacío.
 */
const fila = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

const escenario = {
  // Diez aplicados a 20 efectivas: el esperado por curso-horario queda en 20.
  partes: Array.from({ length: 10 }, (_, i) => fila({
    operational_code: `CH ${i}`, faculty: "DERECHO",
    applied_at: "2026-09-08", effective_surveys: 20,
  } as Partial<MonitoreoRow>)),
  agenda: [
    fila({ operational_code: "CH 90", faculty: "DERECHO", scheduled_date: "2026-09-12" } as Partial<MonitoreoRow>),
  ],
  cuotas: [
    fila({ faculty: "DERECHO", sex: "F", target: 60, observed: 8 } as Partial<MonitoreoRow>),
    fila({ faculty: "DERECHO", sex: "M", target: 40, observed: 16 } as Partial<MonitoreoRow>),
  ],
};

describe("la razón del pedido, con los números de su fila", () => {
  const html = () => renderToStaticMarkup(
    <AulasAlertaDeAnticipacion
      partes={escenario.partes} agenda={escenario.agenda} cuotas={escenario.cuotas}
    />,
  );

  it("enseña el eslabón que faltaba: cuánto deja cada curso-horario suyo", () => {
    expect(html()).toContain("cada curso-horario suyo deja unas");
  });

  it("el sexo va en PALABRAS, no la letra del payload", () => {
    // `s.sexo.toLowerCase()` publicaría «22 de f». La traducción tiene un solo
    // dueño —`etiquetaDeSexo`— y hay un guard del perfil que lo vigila.
    const h = html();
    expect(h).not.toMatch(/\bde f\b/);
    expect(h).not.toMatch(/\bde m\b/);
  });

  it("la cadena entera está en la celda que se ejecuta", () => {
    // El pie explica la REGLA; esto la aplica a la facultad que se mira, que es
    // lo que la pregunta pedía.
    const h = html();
    expect(h).toContain("Faltan");
    expect(h).toMatch(/bastar(ía|ían)/);
  });
});
