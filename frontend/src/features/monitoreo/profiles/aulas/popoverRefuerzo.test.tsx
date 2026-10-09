import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { ContenidoDeRefuerzo } from "./AulasPopoverRefuerzo";

/**
 * La pantalla del refuerzo (C), mirada como la ve quien decide.
 *
 * Se prueba `ContenidoDeRefuerzo` y no el popover entero porque el modal se
 * dibuja con `createPortal` a `document.body`, y un portal en el servidor
 * devuelve cadena VACÍA: un `renderToStaticMarkup` del modal no probaría nada.
 */

const fila = (extra: Record<string, unknown>): MonitoreoAulasPlanRow =>
  ({
    faculty: "DERECHO", eligible_n: 20, sex_top_1: "F", sex_top_1_n: 20, sex_top_2_n: 0,
    tasa_efectividad_aula: 0.5, sample_role: "chain_reserve",
    operational_status: "planificada", sample_status: "en_reserva",
    course_name: "Curso", ...extra,
  }) as unknown as MonitoreoAulasPlanRow;

const PLAN = [
  fila({ operational_code: "CH 1", sample_role: "titular", titular_operational_code: "CH 1", operational_status: "aplicada" }),
  fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", venue: "A206", sesiones_dia_hora: "MAR 14:00-16:00", teacher: "R. QUISPE" }),
  fila({ operational_code: "X 1", sample_role: "extra_reserve_pool", titular_operational_code: "" }),
];

const pinta = (deuda: { mujeres: number; hombres: number }, filas = PLAN) =>
  renderToStaticMarkup(
    <ContenidoDeRefuerzo facultad="DERECHO" filas={filas} deuda={deuda} />,
  );

describe("la cabecera dice contra qué se elige", () => {
  it("la deuda de la facultad va por sexo y con su total", () => {
    const html = pinta({ mujeres: 12, hombres: 4 });
    expect(html).toContain("<b>12</b> mujeres");
    expect(html).toContain("<b>4</b> hombres");
    expect(html).toContain("<strong>16</strong>");
  });

  it("sin deuda lo dice en palabras en vez de pintar ceros", () => {
    const html = pinta({ mujeres: 0, hombres: 0 });
    expect(html).toContain("cuota de esta facultad está cubierta");
    expect(html).toContain("Nada que reforzar");
  });
});

describe("el veredicto llega antes que la lista", () => {
  it("cuando alcanza dice con cuántos", () => {
    // Cada uno aporta 10 mujeres y se deben 15: hacen falta dos.
    const html = pinta({ mujeres: 15, hombres: 0 });
    expect(html).toContain("es-alcanza");
    expect(html).toContain("<strong>2</strong>");
  });

  it("cuando no alcanza dice cuánto queda y a qué obliga", () => {
    const html = pinta({ mujeres: 60, hombres: 0 });
    expect(html).toContain("es-corto");
    expect(html).toContain("ampliar el marco");
    // 60 − 10 − 10 = 40 sin cubrir.
    expect(html).toContain("<strong>40</strong>");
  });

  it("el veredicto sale del mismo orden que la lista, no de una segunda cuenta", () => {
    // Con deuda sólo de mujeres, el que aporta hombres no entra en la cuenta y
    // tampoco debe contarse como aula gastada.
    const soloH = fila({ operational_code: "R H", titular_operational_code: "CH 1", sex_top_1: "M", sex_top_1_n: 20, sex_top_2_n: 0 });
    const html = pinta({ mujeres: 8, hombres: 0 }, [...PLAN, soloH]);
    expect(html).toContain("es-alcanza");
    expect(html).toContain("<strong>1</strong>");
  });
});

describe("cada candidato dice de dónde sale y qué deja detrás", () => {
  it("distingue el que quedó al aire del de la reserva adicional", () => {
    const html = pinta({ mujeres: 12, hombres: 0 });
    expect(html).toContain("al aire");
    expect(html).toContain("reserva adicional");
  });

  it("lleva los chips del sistema y el docente en su peso de texto", () => {
    const html = pinta({ mujeres: 12, hombres: 0 });
    expect(html).toContain("aulas-chip-lugar");
    expect(html).toContain("A206");
    expect(html).toContain("aulas-chip-hora");
    expect(html).toContain("R. QUISPE");
  });

  it("dice lo que quedaría debiendo si se toma, que es el coste de la decisión", () => {
    const html = pinta({ mujeres: 30, hombres: 0 });
    // Aporta 10 de las 30 que se deben: quedarían 20.
    //
    // **La forma cambió el 2026-09-11**: eran tres cifras sueltas —«cierra
    // 21 %», «17 del déficit», «quedarían 65»— que decían lo mismo en tres
    // unidades sin declarar su base, y Gonzalo lo señaló: «esta sección no la
    // entiendo». Ahora es una fracción con su denominador y el resto debajo.
    // Lo que el contrato pide —que se diga con qué se queda la facultad— no
    // cambia.
    expect(html).toContain("10 <i>de 30</i>");
    expect(html).toContain("quedarían 20");
  });

  it("el que no cierra nada se marca en vez de esconderse", () => {
    const soloH = fila({ operational_code: "R H", titular_operational_code: "CH 1", sex_top_1: "M", sex_top_1_n: 20, sex_top_2_n: 0 });
    const html = pinta({ mujeres: 8, hombres: 0 }, [...PLAN, soloH]);
    expect(html).toContain("es-inutil");
        // Registro formalizado el 2026-09-11 a petición de Gonzalo («cuidado con
    // la jerga, tratemos de ser más profesionales, formales»). Lo que el
    // contrato comprueba no cambia; cambia la palabra.
    expect(html).toContain("no reduce el déficit");
  });
});

describe("el vacío se contiene y explica su causa", () => {
  it("una facultad sin nada libre dice por qué y a qué obliga", () => {
    // Cadena viva: su eslabón sigue siendo la red de un titular que no salió.
    const viva = [
      fila({ operational_code: "CH 2", sample_role: "titular", titular_operational_code: "CH 2", operational_status: "agendada" }),
      fila({ operational_code: "R 2.1", titular_operational_code: "CH 2" }),
    ];
    const html = pinta({ mujeres: 10, hombres: 0 }, viva);
    expect(html).toContain("no tiene ningún curso-horario libre");
    expect(html).toContain("ampliar el marco");
  });
});
