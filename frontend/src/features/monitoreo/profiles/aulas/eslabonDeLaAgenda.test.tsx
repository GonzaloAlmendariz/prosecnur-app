// eslabonDeLaAgenda.test.tsx — B27: el desplegable «Eslabón» de la Agenda.
//
// Dictado de Gonzalo (2026-09-01, mirando la tabla): «no sé por qué no muestras
// todas las columnas; ¿no sería mejor tener un desplegable para poder
// seleccionar las columnas a mostrar? en este caso los titulares, pero podría
// seleccionarse reemplazo 1 o reemplazo 2 y que muestre esas columnas».
//
// En el LIBRO cada fila es una cadena con bloques por eslabón; en el plan del
// monitoreo cada unidad es una FILA con `sample_role` y `replacement_order`.
// «Las columnas de reemplazo 1» del libro son aquí LAS FILAS del eslabón 1,
// con las mismas columnas del agendador.
import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasSeccionModelo } from "./AulasSeccionModelo";
import { AulasSelectorDeEslabon } from "./AulasSelectorDeEslabon";
import { eslabonVigente, filasDeReemplazo, opcionesDeEslabon } from "./eslabonDeLaAgenda";
import type { TablaDelPerfil } from "./tablaDelPerfil";
import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";

const titular = (codigo: string, extra: Record<string, unknown> = {}) => ({
  operational_code: codigo, sample_role: "titular", ...extra,
});
const reserva = (
  codigo: string,
  orden: number | string | undefined,
  extra: Record<string, unknown> = {},
) => ({
  operational_code: codigo, sample_role: "chain_reserve",
  ...(orden === undefined ? {} : { replacement_order: orden }),
  ...extra,
});
const banco = (codigo: string) => ({ operational_code: codigo, sample_role: "extra_reserve_pool" });

describe("opcionesDeEslabon deriva los eslabones del plan real", () => {
  it("n es el máximo replacement_order presente, no un número tecleado", () => {
    const { opciones } = opcionesDeEslabon([
      titular("CH 1"), titular("CH 2"),
      // Sin `sample_role`: la MISMA regla que `agendaRows` —lo que no es banco
      // ni reserva se lista con los titulares—, así el conteo de la opción y la
      // tabla por defecto no pueden discrepar.
      { operational_code: "CH 3" },
      reserva("R 1.1", 1), reserva("R 2.1", 1), reserva("R 1.2", 2),
      // Una sola cadena profunda: el 5 existe y los huecos 3 y 4 salen como
      // opción con 0 cursos —vacío declarado, no eslabón escondido—.
      reserva("R 1.5", 5),
    ]);
    expect(opciones.map((o) => o.etiqueta)).toEqual([
      "Titulares", "Reemplazo 1", "Reemplazo 2", "Reemplazo 3", "Reemplazo 4", "Reemplazo 5",
    ]);
    expect(opciones.map((o) => o.cursos)).toEqual([3, 2, 1, 0, 0, 1]);
  });

  it("el banco no es eslabón de nadie", () => {
    // La reserva adicional es capacidad del estrato, no el plan B de un titular:
    // ni infla los titulares ni crea un eslabón.
    const { opciones } = opcionesDeEslabon([titular("CH 1"), banco("EXTRA 1"), reserva("R 1.1", 1)]);
    expect(opciones.map((o) => o.cursos)).toEqual([1, 1]);
  });

  it("sin reservas de cadena sólo queda la opción de titulares", () => {
    const { opciones } = opcionesDeEslabon([titular("CH 1"), titular("CH 2")]);
    expect(opciones).toHaveLength(1);
    expect(opciones[0]).toMatchObject({ eslabon: 0, etiqueta: "Titulares", cursos: 2 });
  });

  it("una reserva sin orden válido no desaparece en silencio", () => {
    // Sin esta cuenta, una reserva con `replacement_order` roto quedaría fuera
    // de TODAS las vistas del desplegable sin dejar rastro — la lista cerrada
    // que se traga filas, otra vez.
    const { opciones, sinOrden } = opcionesDeEslabon([
      titular("CH 1"),
      reserva("R 1.1", 1),
      reserva("R X", undefined), reserva("R Y", 0), reserva("R Z", "nada"),
    ]);
    expect(sinOrden).toBe(3);
    expect(opciones.map((o) => o.cursos)).toEqual([1, 1]);
  });
});

describe("filasDeReemplazo trae el eslabón pedido con el tratamiento de la tabla", () => {
  it("exactamente las filas del eslabón, en el orden de la cadena operativa", () => {
    const filas = filasDeReemplazo({
      agenda: [
        titular("CH 1"), banco("EXTRA 1"),
        // Entran desordenadas a propósito: la cadena 2 antes que la 1.
        reserva("R 2.1", 1), reserva("R 1.1", 1), reserva("R 1.2", 2),
      ],
    }, 1);
    expect(filas.map((f) => f.operational_code)).toEqual(["R 1.1", "R 2.1"]);
  });

  it("qué toca se mide contra el corte del ESTUDIO, no contra generated_at", () => {
    // Con el último parte al 10/09, una cita del 08/09 ya venció; si el corte
    // fuera el sello del tablero (01/09) diría «Esperar al día».
    const filas = filasDeReemplazo({
      agenda: [reserva("R 1.1", 1, { sample_status: "agendada", scheduled_date: "2026-09-08" })],
      partes_campo: [{ applied_at: "2026-09-10" }],
      generated_at: "2026-09-01",
    }, 1);
    expect(filas[0]?.que_toca).toBe("Confirmar si se aplicó");
  });

  it("una reserva dormida dice «En reserva» y el status no afirma contradicciones", () => {
    const filas = filasDeReemplazo({
      agenda: [
        reserva("R 1.1", 1, { sample_status: "en reserva" }),
        reserva("R 2.1", 1, { sample_status: "sin contactar", operational_status: "aplicada" }),
      ],
      generated_at: "2026-09-01",
    }, 1);
    expect(filas[0]?.que_toca).toBe("En reserva");
    // El mismo blindaje que la tabla de titulares: «sin contactar» junto a un
    // eje operativo que dice aplicada se anota, no se afirma.
    expect(String(filas[1]?.sample_status)).toContain("⚠");
  });

  it("para el eslabón 0 no opina: los titulares los sirve agendaRows", () => {
    // Duplicar aquí la regla de titulares es como dos vistas de la misma agenda
    // acaban enseñando cuentas distintas.
    expect(filasDeReemplazo({ agenda: [titular("CH 1")] }, 0)).toEqual([]);
    expect(filasDeReemplazo(null, 1)).toEqual([]);
  });
});

describe("eslabonVigente", () => {
  const { opciones } = opcionesDeEslabon([titular("CH 1"), reserva("R 1.1", 1), reserva("R 1.2", 2)]);

  it("respeta la elección mientras el eslabón exista en el plan", () => {
    expect(eslabonVigente(opciones, 2)).toBe(2);
    expect(eslabonVigente(opciones, 0)).toBe(0);
  });

  it("cae a titulares cuando un Recargar encoge las cadenas", () => {
    // Sin esto, el select quedaría con un valor sin opción y la tabla
    // enseñando un eslabón que el plan ya no tiene.
    expect(eslabonVigente(opciones, 7)).toBe(0);
  });
});

describe("AulasSelectorDeEslabon", () => {
  const { opciones } = opcionesDeEslabon([
    titular("CH 1"), titular("CH 2"), reserva("R 1.1", 1), reserva("R 2.1", 1),
  ]);

  it("enseña cada eslabón con su cuenta, para elegir sin adivinar", () => {
    const html = renderToStaticMarkup(
      <AulasSelectorDeEslabon opciones={opciones} valor={1} onCambio={() => {}} />,
    );
    expect(html).toContain("Titulares · 2");
    expect(html).toContain("Reemplazo 1 · 2");
    // El valor elegido llega marcado al markup: el control dice dónde está.
    expect(html).toMatch(/<option[^>]*selected[^>]*>Reemplazo 1/);
  });

  it("el nombre accesible es el rótulo visible «Eslabón»", () => {
    const html = renderToStaticMarkup(
      <AulasSelectorDeEslabon opciones={opciones} valor={0} onCambio={() => {}} />,
    );
    // `<label>` envolvente, no un aria-label que diga otra cosa que lo que se ve.
    expect(html).toMatch(/<label[^>]*>Eslabón\s*<select/);
  });

  it("sin reservas en el plan no hay nada que conmutar y no se pinta", () => {
    const soloTitulares = opcionesDeEslabon([titular("CH 1")]).opciones;
    expect(renderToStaticMarkup(
      <AulasSelectorDeEslabon opciones={soloTitulares} valor={0} onCambio={() => {}} />,
    )).toBe("");
  });
});

describe("la Agenda de la sección Modelo conmuta por eslabón", () => {
  const tablero = {
    agenda: [
      titular("CH 1"), titular("CH 2"),
      reserva("R 1.1", 1), reserva("R 2.1", 1), reserva("R 1.2", 2),
    ],
    course_status: [],
    kpis: { aulas_titulares: 2 },
    generated_at: "2026-09-01",
  } as unknown as MonitoreoAulasDashboard;

  const soloTitulares = (d: MonitoreoAulasDashboard | null) =>
    ((d?.agenda ?? []) as unknown as Array<Record<string, unknown>>)
      .filter((f) => f.sample_role === "titular");

  const pinta = (Tabla: TablaDelPerfil) => renderToStaticMarkup(
    <AulasSeccionModelo
      dashboard={tablero}
      pestana="agenda"
      facultadEnFoco={undefined}
      onFoco={() => {}}
      tabla={Tabla}
      traza={null}
      agendaRows={soloTitulares}
      agendaReservas={() => 3}
    />,
  );

  it("por defecto la tabla enseña los titulares de agendaRows, como siempre", () => {
    const vistos: unknown[] = [];
    const html = pinta((props) => {
      vistos.push(props.rows.map((r) => r.operational_code));
      return null;
    });
    expect(vistos).toEqual([["CH 1", "CH 2"]]);
    // Y el contador de siempre sigue en su sitio.
    expect(html).toContain("reservas detrás");
  });

  it("el desplegable vive en la cabecera del panel de la tabla", () => {
    const html = pinta(() => null);
    expect(html).toContain("Aulas agendadas");
    expect(html).toContain("Eslabón");
    expect(html).toContain("Reemplazo 2");
  });

  it("un eslabón vacío deja su vacío dentro del marco de la tabla", () => {
    // C3: el «Reemplazo 7 de una sola cadena profunda» no rompe el panel; la
    // tabla ya sabe declarar su vacío y el copy nombra el eslabón. Aquí se fija
    // el copy que la sección le pasa.
    const html = pinta((props) => <i data-vacio={props.empty} />);
    expect(html).toContain("No hay agenda importada para cursos-horario.");
  });
});
