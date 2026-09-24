import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasMetasCinta } from "./AulasMetasCinta";
import { AulasMetasMandos } from "./AulasMetasMandos";
import { AulasMetasYAulas } from "./AulasMetasYAulas";
import type { MonitoreoAulasProyeccionFila } from "../../../../api/monitoreo";

const fila = (extra: Partial<MonitoreoAulasProyeccionFila> = {}): MonitoreoAulasProyeccionFila => ({
  facultad: "DERECHO",
  meta: 363, meta_M: 126, meta_F: 237,
  obtenidas: 51, obtenidas_M: 17, obtenidas_F: 34,
  aulas_aplicadas: 3, aulas_agendadas: 9, elegibles_agendados: 320,
  tasa_usada: 0.568, tasa_es_del_diseno: true, tasa_diseno: 0.568, tasa_obtenida: 0.408,
  elegibles_aplicados: 125, desvio_de_la_del_diseno: -0.282,
  proyectadas: 181.9, proyectadas_M: 63, proyectadas_F: 118.9,
  total: 232.9, brecha: -130.1, llega: false,
  meta_elegida: "muestra", factor_meta: 1,
  supuesto_meta: "", supuesto_sexo: "…",
  ...extra,
});

describe("«Metas y aulas»", () => {
  it("cada facultad trae sus dos carriles y sus aulas", () => {
    const html = renderToStaticMarkup(<AulasMetasYAulas filas={[fila()]} />);
    expect(html).toContain("DERECHO");
    expect(html).toContain("Hombres");
    expect(html).toContain("Mujeres");
    expect(html).toContain("3 cursos-horario aplicados");
  });

  it("la brecha negativa se dice «faltan», no con un signo que hay que interpretar", () => {
    const html = renderToStaticMarkup(<AulasMetasYAulas filas={[fila()]} />);
    // Hombres: 17 + 63 = 80 contra 126 → faltan 46.
    expect(html).toContain("faltan 46");
  });

  it("una celda que se pasa lo dice en positivo", () => {
    const html = renderToStaticMarkup(
      <AulasMetasYAulas filas={[fila({ meta_M: 50, obtenidas_M: 40, proyectadas_M: 30 })]} />,
    );
    expect(html).toContain("+20");
  });

  it("la escala es POR FACULTAD: la meta de una no encoge la barra de otra", () => {
    // Con escala común, DERECHO (meta 126) contra CIENCIAS (meta 792) quedaría
    // en un hilo y no se vería si llega, que es lo único que este bloque dice.
    const html = renderToStaticMarkup(
      <AulasMetasYAulas filas={[
        fila({ facultad: "AAA", meta_M: 10, meta_F: 10, obtenidas_M: 10, obtenidas_F: 10, proyectadas_M: 0, proyectadas_F: 0 }),
        fila({ facultad: "ZZZ", meta_M: 900, meta_F: 900, obtenidas_M: 0, obtenidas_F: 0, proyectadas_M: 0, proyectadas_F: 0 }),
      ]} />,
    );
    // La barra de AAA llega casi al tope de SU carril pese a que ZZZ pide 90x.
    expect(html).toMatch(/width:96\.\d+%/);
  });

  it("una proyección que el motor no pudo calcular sale «—», no cero", () => {
    const html = renderToStaticMarkup(
      <AulasMetasYAulas filas={[fila({ proyectadas_M: null, proyectadas_F: null })]} />,
    );
    expect(html).toContain("—");
  });

  it("sin filas no pinta un esqueleto vacío", () => {
    expect(renderToStaticMarkup(<AulasMetasYAulas filas={null} />)).toBe("");
    expect(renderToStaticMarkup(<AulasMetasYAulas filas={[]} />)).toBe("");
  });
});

describe("la cinta", () => {
  it("el primer rótulo sigue al mando, porque la cifra también cambia", () => {
    const cinta = { meta: 100, meta_M: 40, meta_F: 60, obtenidas: 30, obtenidas_M: 10, obtenidas_F: 20 };
    expect(renderToStaticMarkup(<AulasMetasCinta cinta={cinta} meta="muestra" />)).toContain("Muestra");
    expect(renderToStaticMarkup(<AulasMetasCinta cinta={cinta} meta="sobremuestra" />)).toContain("Sobremuestra");
  });

  it("sin cinta no se pinta una fila de ceros", () => {
    expect(renderToStaticMarkup(<AulasMetasCinta cinta={null} meta="muestra" />)).toBe("");
  });
});

describe("los mandos", () => {
  it("reusan el segmentado del perfil y marcan el activo", () => {
    const html = renderToStaticMarkup(
      <AulasMetasMandos
        rotulo="Meta"
        opciones={[["muestra", "Muestra", "a"], ["sobremuestra", "Sobremuestra", "b"]] as const}
        valor="muestra"
        onCambio={() => {}}
      />,
    );
    expect(html).toContain("aulas-carga-eje");
    expect(html).toMatch(/aria-pressed="true"[^>]*>Muestra/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Sobremuestra/);
  });
});

describe("cambiar de tasa no puede mover lo que no cambia", () => {
  // Gonzalo, 2026-09-09: «se supone que lo único que debería cambiar es la
  // brecha y, en el gráfico, la parte verde clara. Pero cambia todo, se mueve
  // la meta, se mueve lo verde». Tenía razón: el techo del carril incluía lo
  // proyectado, así que al cambiar de escenario se reescalaba todo.
  const anchos = (html: string, clase: string): string[] =>
    [...html.matchAll(new RegExp(`class="${clase}"[^>]*style="([^"]*)"`, "g"))].map((m) => m[1]);

  it("la marca de la meta y lo aplicado se quedan donde estaban", () => {
    const conDiseno = renderToStaticMarkup(
      <AulasMetasYAulas filas={[fila({ proyectadas_M: 63, proyectadas_F: 118 })]} />,
    );
    const conObtenida = renderToStaticMarkup(
      <AulasMetasYAulas filas={[fila({ proyectadas_M: 45, proyectadas_F: 85 })]} />,
    );
    expect(anchos(conObtenida, "es-meta")).toEqual(anchos(conDiseno, "es-meta"));
    expect(anchos(conObtenida, "es-aplicado")).toEqual(anchos(conDiseno, "es-aplicado"));
  });

  it("lo único que se mueve es lo proyectado", () => {
    const a = renderToStaticMarkup(<AulasMetasYAulas filas={[fila({ proyectadas_M: 63 })]} />);
    const b = renderToStaticMarkup(<AulasMetasYAulas filas={[fila({ proyectadas_M: 20 })]} />);
    expect(anchos(b, "es-proyectado")).not.toEqual(anchos(a, "es-proyectado"));
  });
});

describe("«N agendados» con su detalle (2026-09-24)", () => {
  it("el disparo nombra la cifra y sin detalle queda la cifra sola", async () => {
    const { AulasAgendadasDeLaFila } = await import("./AulasAgendadasDeLaFila");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const con = renderToStaticMarkup(<AulasAgendadasDeLaFila total={2} agendadas={[
      { codigo: "CH 1", curso: "X", seccion: "", fecha: "2099-09-30", hora: "8:00 am", horario: "",
        lugar: "A406", elegibles: 31, hombres: 26, mujeres: 5 },
      { codigo: "CH 2", curso: "Y", seccion: "", fecha: "2099-10-01", hora: "", horario: "",
        lugar: "", elegibles: 10, hombres: 4, mujeres: 6 },
    ]} />);
    expect(con).toContain("aulas-agendadas-disparo");
    expect(con).toContain("2 agendados");
    const sin = renderToStaticMarkup(<AulasAgendadasDeLaFila total={3} agendadas={undefined} />);
    expect(sin).toBe("3 agendados");
    expect(renderToStaticMarkup(<AulasAgendadasDeLaFila total={1} agendadas={[]} />)).toBe("1 agendado");
  });
});
