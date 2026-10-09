import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasCierrePorAgenda } from "./AulasCierrePorAgenda";
import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * **El pronóstico deja de ser lineal.**
 *
 * Gonzalo, tres veces: «no es que tengamos un pronóstico lineal de que si hoy
 * aplicamos treinta, mañana treinta; depende del RITMO DE LA AGENDA… y de los
 * esperables de esas aulas, contrastando el rendimiento planificado con el que
 * vamos encontrando».
 *
 * Los nombres del fixture son los del PLAN —`scheduled_date`, `expected_valid`,
 * `respuestas_validas`, `application_state`—, que es lo que `cierrePorAgenda`
 * lee. Inventarlos deja el componente en su vacío y el test pasa sin ejercitar
 * nada.
 */
const fila = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

/** Tres aplicados que rinden POR DEBAJO de lo previsto, y dos agendados. */
const plan = [
  fila({ operational_code: "CH 1", faculty: "DERECHO", application_state: "cerrando",
    expected_valid: 20, respuestas_validas: 10, eligible_n: 40 } as Partial<MonitoreoRow>),
  fila({ operational_code: "CH 2", faculty: "DERECHO", application_state: "cerrando",
    expected_valid: 20, respuestas_validas: 10, eligible_n: 40 } as Partial<MonitoreoRow>),
  fila({ operational_code: "CH 3", faculty: "DERECHO", application_state: "cerrando",
    expected_valid: 20, respuestas_validas: 10, eligible_n: 40 } as Partial<MonitoreoRow>),
  fila({ operational_code: "CH 4", faculty: "DERECHO", application_state: "lista",
    scheduled_date: "2026-09-12", expected_valid: 20, eligible_n: 40 } as Partial<MonitoreoRow>),
  fila({ operational_code: "CH 5", faculty: "DERECHO", application_state: "lista",
    scheduled_date: "2026-09-15", expected_valid: 20, eligible_n: 40 } as Partial<MonitoreoRow>),
];

const render = (meta: number | null = null) =>
  renderToStaticMarkup(<AulasCierrePorAgenda plan={plan} meta={meta} corte="2026-09-10" />);

describe("hasta dónde llega lo agendado", () => {
  it("dibuja DOS curvas: lo que el diseño supone y lo que el campo está dando", () => {
    const html = render();
    expect(html).toContain("aulas-cpa-plan");
    expect(html).toContain("aulas-cpa-observado");
    // Y las nombra, con su cifra: en una sola curva el contraste no existe.
    expect(html).toContain("al rendimiento que está dando cada facultad");
    expect(html).toContain("al que el diseño les supuso");
  });

  it("las dos cifras DIFIEREN cuando el campo rinde por debajo", () => {
    // 30 conseguidas + 2 agendados. Al diseño: +40 → 70. Al observado, que va al
    // 50 % de lo previsto: +20 → 50. Si el componente promediara o usara una
    // sola tasa, las dos leyendas dirían lo mismo.
    const html = render();
    expect(html).toContain(">70<");
    expect(html).toContain(">50<");
  });

  it("con meta dice si se cubre y cuánto falta, no sólo la curva", () => {
    expect(render(100)).toContain("faltarían");
    expect(render(40)).toContain("se cubre");
  });

  it("declara lo que NO puede decir: los cursos-horario sin fecha", () => {
    // **`sample_role: "titular"` no es decoración.** Sin fecha, sólo el titular
    // es trabajo pendiente: las reservas dormidas y el banco no se agendan, y
    // contarlas aquí inflaría el plan de 174 a 1 392 — el defecto que este
    // perfil ya corrigió dos veces. Lo leí en `cierrePorAgenda` en vez de
    // suponerlo, después de que el fixture sin rol pasara de largo.
    const conHuerfanos = [...plan, fila({
      operational_code: "CH 6", faculty: "DERECHO", application_state: "pendiente",
      sample_role: "titular", expected_valid: 20, eligible_n: 40,
    } as Partial<MonitoreoRow>)];
    const html = renderToStaticMarkup(
      <AulasCierrePorAgenda plan={conHuerfanos} meta={100} corte="2026-09-10" />,
    );
    expect(html).toContain("sin fecha");
    expect(html).toContain("el plan no puede cerrar");
  });

  it("sin nada agendado lo dice, en vez de dibujar una recta", () => {
    const soloAplicados = plan.filter((f) => f.application_state === "cerrando");
    const html = renderToStaticMarkup(
      <AulasCierrePorAgenda plan={soloAplicados} meta={100} corte="2026-09-10" />,
    );
    expect(html).toContain("no hay agenda que proyectar");
    expect(html).not.toContain("aulas-cpa-observado");
  });
});

/**
 * **Los dos defectos que sólo se vieron mirando la pantalla.**
 *
 * Con los datos reales el panel decía «2.850,1» en el techo del eje y
 * «2026-09-10T17:19:56Z» como primer rótulo del eje de fechas. Ninguno de los
 * cinco tests de arriba lo vio: sus fixtures pasan la fecha ya corta y su techo
 * cae en entero.
 */
describe("los rótulos del eje", () => {
  it("el techo va en entero: media respuesta no existe", () => {
    const html = render(2500);
    expect(html).not.toMatch(/>[\d,]+\.\d</);
  });

  it("un corte con hora no se cuela como fecha del eje", () => {
    // Quien lo llama le pasa `generated_at`, que es un instante completo.
    const html = renderToStaticMarkup(
      <AulasCierrePorAgenda plan={plan} meta={100} corte="2026-09-10T17:19:56Z" />,
    );
    expect(html).not.toContain("T17:19:56Z");
  });
});
