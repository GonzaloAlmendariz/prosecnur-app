import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasRendimientoPorFacultad } from "./AulasRendimientoPorFacultad";
import { MINIMO_PARA_COMPARAR } from "./rendimientoPorFacultad";
import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * El corte de evidencia del ranking, visto desde la pantalla.
 *
 * Lo que se vio el 2026-09-10: la lista la encabezaba PSICOLOGÍA con el 100,0 %
 * de UN curso-horario. Encoger hacia la media dejó las seis primeras barras a
 * seis puntos unas de otras —seis barras del mismo largo— así que la respuesta
 * pasó a ser apartar lo que todavía no se puede comparar.
 */

const parte = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

/** Cuatro facultades: dos con evidencia, una con una sola visita, y un cajón. */
const plan = [
  ...Array.from({ length: 6 }, (_, i) => parte({ operational_code: `A${i}`, eligible_n: 40 })),
  ...Array.from({ length: 4 }, (_, i) => parte({ operational_code: `B${i}`, eligible_n: 40 })),
  parte({ operational_code: "U", eligible_n: 20 }),
  ...Array.from({ length: 5 }, (_, i) => parte({ operational_code: `S${i}`, eligible_n: 40 })),
];

const partes = [
  ...Array.from({ length: 6 }, (_, i) =>
    parte({ operational_code: `A${i}`, faculty: "ALTA", effective_surveys: 30, observed_students: 35 })),
  ...Array.from({ length: 4 }, (_, i) =>
    parte({ operational_code: `B${i}`, faculty: "BAJA", effective_surveys: 10, observed_students: 35 })),
  parte({ operational_code: "U", faculty: "DEUNA", effective_surveys: 20, observed_students: 20 }),
  // Sin facultad declarada: cae al cajón «Sin facultad», con CINCO visitas.
  ...Array.from({ length: 5 }, (_, i) =>
    parte({ operational_code: `S${i}`, faculty: "", effective_surveys: 39, observed_students: 40 })),
];

/**
 * La casa renderiza a markup estático —`renderToStaticMarkup`, sin
 * `@testing-library`, que no está en el proyecto— y comprueba el HTML. Para el
 * ORDEN eso es incluso mejor: el markup conserva la secuencia real de las filas,
 * que es lo que se quiere sujetar, y no el orden del array del modelo.
 */
const html = () => renderToStaticMarkup(
  <AulasRendimientoPorFacultad partes={partes} plan={plan} />,
);

/** Las posiciones de cada fila en el markup, en el orden en que se pintan. */
const posicion = (marca: string) => html().indexOf(marca);

describe("el corte de evidencia del ranking", () => {
  it("aparta a la de una sola visita y lo dice con una línea, no en silencio", () => {
    expect(html()).toContain(`Con menos de ${MINIMO_PARA_COMPARAR} cursos-horario visitados`);

    // La de una visita se PINTA después del corte, y la de seis antes: es lo
    // que el corte existe para decir. Se comprueba por posición en el markup y
    // no por el orden del array — una lista que ordena bien y pinta en otro
    // orden es justo el defecto que esto persigue.
    const iCorte = posicion("aulas-rendimiento-corte");
    expect(iCorte).toBeGreaterThan(0);
    expect(posicion("DEUNA")).toBeGreaterThan(iCorte);
    expect(posicion("ALTA")).toBeLessThan(iCorte);
  });

  it("la de una visita NO encabeza la lista aunque su porcentaje sea el mayor", () => {
    const marcado = html();
    // BAJA rinde al 25 % y aun así se pinta antes que la del 100 %: el corte
    // separa por evidencia, no por resultado.
    expect(posicion("BAJA")).toBeLessThan(posicion("DEUNA"));
    // Y su 100 % sigue publicado: apartarla no es esconderla.
    expect(marcado).toContain("100.0 %");
  });

  it("los cajones de «no se sabe» llevan SU frontera, no la del corte de evidencia", () => {
    // Visto en pantalla el 2026-09-10: en «Día de la semana» lo único que
    // quedaba bajo la línea era «Sin fecha», y la línea dice «con menos de 3
    // cursos-horario visitados — todavía no se comparan». «Sin fecha» no es un
    // día con pocas visitas: son partes a los que les falta la fecha.
    const marcado = html();
    expect(marcado).toContain("Partes a los que les falta el dato");
    const iCajon = marcado.indexOf("Partes a los que les falta el dato");
    // El cajón se pinta DESPUÉS de su frontera, y su frontera después del corte
    // de evidencia: tres grupos, dos líneas, cada una nombrando lo suyo.
    expect(posicion("Sin facultad")).toBeGreaterThan(iCajon);
    expect(iCajon).toBeGreaterThan(posicion("DEUNA"));
  });

  it("sin ninguna apartada, el corte de evidencia NO se dibuja y el del cajón sí", () => {
    // El control del control: si el corte se dibujara siempre que hay algo
    // detrás, un cajón heredaría la frase equivocada — que es exactamente el
    // defecto que la prueba de arriba persigue.
    const soloComparables = partes.filter((p) => p.faculty !== "DEUNA");
    const marcado = renderToStaticMarkup(
      <AulasRendimientoPorFacultad partes={soloComparables} plan={plan} />,
    );
    expect(marcado).not.toContain(`Con menos de ${MINIMO_PARA_COMPARAR} cursos-horario visitados`);
    expect(marcado).toContain("Partes a los que les falta el dato");
  });

  it("la frase de cabecera no nombra un cajón de «no se sabe» como la que más rinde", () => {
    const marcado = html();
    const desde = marcado.indexOf("aulas-rendimiento-lectura");
    const lectura = marcado.slice(desde, marcado.indexOf("</p>", desde));
    // El cajón tiene CINCO visitas —más que ALTA— y el 97,5 %: sin el filtro
    // encabezaría la frase.
    expect(lectura).not.toContain("Sin facultad");
    expect(lectura).toContain("ALTA");
    // Y la frase declara cuántas se quedaron fuera por evidencia.
    expect(lectura).toMatch(/1 con menos de 3 cursos-horario todavía no entra/);
  });
});
