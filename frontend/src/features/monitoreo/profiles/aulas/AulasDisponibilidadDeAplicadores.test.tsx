import { describe, expect, it } from "vitest";

// Dictado 2026-09-04 («basta de los em dashes» y «el nombre normalizado»):
// el rótulo de cada celda pasó de «2 disponibles — Ana, Berta» a
// «2 disponibles. Pueden: Ana · Berta». El punto medio separa los nombres
// porque un nombre YA lleva su coma y unirlos con otra los duplicaba a la
// vista.

import { renderToStaticMarkup } from "react-dom/server";

import { AulasDisponibilidadDeAplicadores } from "./AulasDisponibilidadDeAplicadores";
import { mallaDeOferta, columnasVivas } from "./disponibilidadDeAplicadores";
import type { MonitoreoAulasDisponibilidad } from "../../../../api/monitoreo";

const bloque = (dias: unknown): MonitoreoAulasDisponibilidad =>
  ({ dias }) as unknown as MonitoreoAulasDisponibilidad;

const pinta = (disponibilidad: MonitoreoAulasDisponibilidad | null) => {
  const oferta = mallaDeOferta(disponibilidad);
  const vivas = oferta ? columnasVivas(oferta.franjas.length, [oferta.disponibles]) : [];
  return renderToStaticMarkup(
    <AulasDisponibilidadDeAplicadores oferta={oferta} vivas={vivas} />,
  );
};

/**
 * El tercer cuadro de Carga de campo (dictado 2026-09-02): la malla de OFERTA,
 * espejo de la de demanda. Sus tres estados —sin cargar, cargada vacía, con
 * gente— se declaran distinto, que es la clasificación C5 del contrato.
 */
describe("AulasDisponibilidadDeAplicadores", () => {
  it("sin la clave en sesión declara qué falta y de dónde sale", () => {
    const html = pinta(null);
    expect(html).toContain("disponibilidad de los aplicadores");
    expect(html).toContain("libro de disponibilidad");
    // El vacío declara su geometría como la rama con datos (guard del perfil).
    expect(html).toContain("data-qa-geometry-member");
  });

  it("cargada pero sin horas declaradas lo dice, sin confundirlo con «falta cargar»", () => {
    const html = pinta(bloque([]));
    expect(html).toContain("nadie declaró horas");
    expect(html).not.toContain("libro de disponibilidad");
  });

  it("pinta la oferta como espejo de la demanda: días de semana, franjas y quiénes", () => {
    const html = pinta(bloque([
      {
        dia: "lunes",
        franjas: [
          { inicio: "09:00", fin: "09:30", disponibles: 2, nombres: ["Ana Prueba", "Berta Ficticia"] },
          { inicio: "09:30", fin: "10:00", disponibles: 1, nombres: ["Ana Prueba"] },
        ],
      },
      { dia: "jueves", franjas: [{ inicio: "12:00", fin: "12:30", disponibles: 1, nombres: ["Ana Prueba"] }] },
    ]));
    // Mismo orden de días que el patrón semanal, con el marco completo: el
    // martes sin oferta sigue teniendo fila (C2).
    expect(html).toContain(">lunes<");
    expect(html).toContain(">martes<");
    expect(html).toContain(">jueves<");
    // La cifra es el dato de la franja, y su nombre accesible dice quiénes.
    // Sin exigir el cierre de la comilla: la franja pico añade su seña detrás.
    expect(html).toMatch(/aria-label="lunes 09:00: 2 disponibles. Pueden: Ana Prueba · Berta Ficticia/);
    // Los KPIs de la oferta en llano (dictado 2026-09-03: «las barras KPI no
    // se entienden»): cuánta gente y su mejor momento, con sus palabras.
    expect(html).toContain("Aplicadores declarados");
    expect(html).toContain("Máximo libres a la vez");
    expect(html).toContain("El mejor momento");
    expect(html).toMatch(/lunes 09:00/);
  });

  it("declara lo que no cupo en la malla en vez de tragarlo", () => {
    const html = pinta(bloque([
      {
        dia: "lunes",
        franjas: [
          { inicio: "09:00", fin: "09:30", disponibles: 1, nombres: ["Ana Prueba"] },
          { inicio: "06:30", fin: "07:00", disponibles: 1, nombres: ["Ana Prueba"] },
        ],
      },
    ]));
    expect(html).toContain("1 franja declarada queda fuera del eje de 07:00 a 22:00");
  });
});

/**
 * B38 (dictado 2026-09-02: «disponibilidad se ve mejor»): la vista confesaba
 * su brecha — «conmuta con el patrón semanal para ver si la gente alcanza».
 * Ahora la demanda confirmada entra A la malla: anillo donde hay citas,
 * alarma donde las citas superan a la gente, y el hueco más grave —cita sin
 * nadie declarado— se pinta en vez de quedar como celda vacía cualquiera.
 */
describe("AulasDisponibilidadDeAplicadores — la demanda confirmada encima (B38)", () => {
  const disponibilidad = bloque([
    {
      dia: "lunes",
      franjas: [
        { inicio: "09:00", fin: "09:30", disponibles: 2, nombres: ["Ana Prueba", "Berta Ficticia"] },
        { inicio: "09:30", fin: "10:00", disponibles: 1, nombres: ["Ana Prueba"] },
      ],
    },
  ]);
  const oferta = mallaDeOferta(disponibilidad)!;
  const j0900 = oferta.franjas.indexOf(9 * 60);
  const j0930 = oferta.franjas.indexOf(9 * 60 + 30);
  const j1000 = oferta.franjas.indexOf(10 * 60);
  const demandaLunes = oferta.franjas.map(() => 0);
  demandaLunes[j0900] = 1; // 1 cita, 2 disponibles → anillo
  demandaLunes[j0930] = 3; // 3 citas, 1 disponible → más citas que gente
  demandaLunes[j1000] = 2; // 2 citas, NADIE declarado → el hueco grave
  const demandaFirme = oferta.filas.map((f) => (f.etiqueta === "lunes" ? demandaLunes : null));
  // Las columnas vivas incluyen la demanda, como en producción: la franja con
  // citas y cero oferta también se pinta.
  const vivas = columnasVivas(oferta.franjas.length, [oferta.disponibles, [demandaLunes]]);
  const html = renderToStaticMarkup(
    <AulasDisponibilidadDeAplicadores oferta={oferta} vivas={vivas} demandaFirme={demandaFirme} />,
  );

  it("la franja con citas cubiertas lleva su anillo y lo dice en su nombre", () => {
    expect(html).toContain("tiene-citas");
    expect(html).toMatch(/aria-label="lunes 09:00: 2 disponibles, 1 cita confirmada/);
  });

  it("más citas que gente = alarma declarada, no un conteo más", () => {
    expect(html).toMatch(/aria-label="lunes 09:30: 1 disponible, 3 citas confirmadas, más citas que gente/);
    expect(html).toContain("es-deficit");
  });

  it("la cita sin nadie declarado se pinta y se titula — el hueco no pasa por celda vacía", () => {
    expect(html).toMatch(/<span[^>]*es-deficit[^>]*title="lunes 10:00: 0 disponibles, 2 citas confirmadas, más citas que gente"/);
  });

  it("el lead y la leyenda hablan de la lectura conjunta", () => {
    expect(html).toContain("las citas confirmadas encima");
    expect(html).toContain("Más citas que gente");
  });

  it("sin capa de demanda la vista queda como antes: ni anillos ni alarma", () => {
    const solo = renderToStaticMarkup(
      <AulasDisponibilidadDeAplicadores oferta={oferta} vivas={vivas} />,
    );
    expect(solo).not.toContain("tiene-citas");
    expect(solo).not.toContain("es-deficit");
    expect(solo).toContain("conmuta con el patrón semanal");
  });
});

describe("el día que toca sella su fila de oferta (hermano de B43/B46)", () => {
  const disponibilidad = bloque([
    { dia: "lunes", franjas: [{ inicio: "09:00", fin: "09:30", disponibles: 2, nombres: ["Ana Prueba", "Berta Ficticia"] }] },
    { dia: "martes", franjas: [{ inicio: "09:00", fin: "09:30", disponibles: 1, nombres: ["Ana Prueba"] }] },
  ]);
  const oferta = mallaDeOferta(disponibilidad)!;
  const vivas = columnasVivas(oferta.franjas.length, [oferta.disponibles]);

  it("el 2026-09-07 es lunes: la fila «lunes» lleva el sello y las demás no", () => {
    const html = renderToStaticMarkup(
      <AulasDisponibilidadDeAplicadores oferta={oferta} vivas={vivas} fechaQueToca="2026-09-07" />,
    );
    expect(html).toMatch(/es-el-que-toca[\s\S]{0,120}>lunes</);
    // Mapa de jergas 2026-09-03: el sello dejó de decir «toca».
    expect(html).toContain(">próxima salida<");
    expect((html.match(/es-el-que-toca/g) ?? []).length).toBe(1);
    expect(html).toContain("cae la próxima salida de campo");
  });

  it("sin fecha no hay sello", () => {
    const html = renderToStaticMarkup(
      <AulasDisponibilidadDeAplicadores oferta={oferta} vivas={vivas} />,
    );
    expect(html).not.toContain("es-el-que-toca");
  });
});

describe("quién no sale este despliegue", () => {
  const conGente = () => bloque([
    { dia: "lunes", franjas: [
      { inicio: "09:00", fin: "09:30", disponibles: 2,
        nombres: ["Ana Prueba", "CASTILLO SOLORSANO, LEIDY"] },
    ] },
  ]);
  const pintaCon = (fuera: string[]) => {
    const oferta = mallaDeOferta(conGente());
    const vivas = oferta ? columnasVivas(oferta.franjas.length, [oferta.disponibles]) : [];
    return renderToStaticMarkup(
      <AulasDisponibilidadDeAplicadores oferta={oferta} vivas={vivas} fuera={fuera} />,
    );
  };

  it("dice los nombres aunque no se pueda editar la lista", () => {
    // Una decisión que cambia el reparto y no se ve es media avería: el
    // reparto saldría distinto y nadie sabría por qué. Se muestra SIEMPRE,
    // haya control o no — aquí se pinta sin `onDeclararFuera`.
    const html = pintaCon(["CASTILLO SOLORSANO, LEIDY"]);
    expect(html).toContain("No sale este despliegue");
    // Y con el nombre normalizado, que es como se lee en todo el módulo.
    expect(html).toContain("Castillo Solorsano, Leidy");
  });

  it("sin nadie fuera no dibuja la frase", () => {
    const html = pintaCon([]);
    expect(html).not.toContain("No sale este despliegue");
    expect(html).not.toContain("No salen este despliegue");
  });

  it("con dos o más, lo dice en plural", () => {
    const html = pintaCon(["Ana Prueba", "CASTILLO SOLORSANO, LEIDY"]);
    expect(html).toContain("No salen este despliegue");
  });
});
