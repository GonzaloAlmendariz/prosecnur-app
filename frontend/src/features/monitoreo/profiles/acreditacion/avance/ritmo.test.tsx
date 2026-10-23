import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { calendario, fasesConFechas, nombresDePublicos, pulsoDelCampo, seriesApiladas } from "./ritmoModelo";
import { lunesDe, mapaPorSemana } from "./mapaDeCalor";
import { RitmoVista } from "./Ritmo";
import { SuperficieFlotante } from "../../../core/superficieFlotante/SuperficieFlotante";

const actores = [
  { Actor: "Estudiantes", "Última efectiva": "2026-05-29" },
  { Actor: "Docentes", "Última efectiva": "2026-05-26" },
];
const diarioPorPublico = [
  { Actor: "Estudiantes", Fecha: "2026-05-25", Efectivas: 10 },
  { Actor: "Estudiantes", Fecha: "2026-05-29", Efectivas: 4 },
  { Actor: "Docentes", Fecha: "2026-05-26", Efectivas: 3 },
];
const fuentes = [
  { Actor: "Estudiantes", Canal: "Correo", Efectivas: 12 },
  { Actor: "Docentes", Canal: "Telefónico", Efectivas: 3 },
  { Actor: "Estudiantes", Canal: "Telefónico", Efectivas: 2 },
];

describe("Avance › Ritmo", () => {
  it("apila por público sobre un calendario sin huecos", () => {
    const serie = seriesApiladas(diarioPorPublico, [], nombresDePublicos(actores));
    expect(serie.fechas).toEqual(calendario("2026-05-25", "2026-05-29"));
    expect(serie.capas.map((capa) => capa.publico)).toEqual(["Estudiantes", "Docentes"]);
    expect(serie.totales).toEqual([10, 3, 0, 0, 4]);
  });

  it("junta en «Otros» a los públicos que no caben con color propio", () => {
    const filas = Array.from({ length: 9 }, (_, indice) => ({ Actor: `P${indice}`, Fecha: "2026-05-25", Efectivas: 9 - indice }));
    const serie = seriesApiladas(filas, []);
    expect(serie.capas).toHaveLength(7);
    expect(serie.capas.at(-1)?.publico).toBe("Otros 3 públicos");
    expect(serie.totales[0]).toBe(45);
  });

  it("sin desglose por público usa la serie general", () => {
    const serie = seriesApiladas([], [{ Fecha: "2026-05-25", Efectivas: 5 }]);
    expect(serie.capas[0].publico).toBe("Todos los públicos");
  });

  it("calcula el pulso del campo con los días sin efectivas", () => {
    const pulso = pulsoDelCampo(seriesApiladas(diarioPorPublico, [], nombresDePublicos(actores)), fuentes, actores);
    expect(pulso.diasConEfectivas).toBe(3);
    expect(pulso.dias).toBe(5);
    expect(pulso.mejor).toEqual({ fecha: "2026-05-25", efectivas: 10 });
    expect(pulso.porCanal[0]).toEqual({ canal: "Correo", efectivas: 12 });
    expect(pulso.porDiaDeLaSemana[0]).toEqual({ dia: "Lunes", promedio: 10 });
    expect(pulso.ultimaPorPublico[0].publico).toBe("Docentes");
  });

  it("agrupa por semanas de lunes a domingo", () => {
    expect(lunesDe("2026-05-31")).toBe("2026-05-25");
    const mapa = mapaPorSemana(seriesApiladas([...diarioPorPublico, { Actor: "Docentes", Fecha: "2026-06-01", Efectivas: 2 }], []));
    expect(mapa.semanas).toEqual(["2026-05-25", "2026-06-01"]);
    expect(mapa.maximo).toBe(14);
  });

  it("solo dibuja las fases que tienen fechas", () => {
    expect(fasesConFechas([
      { id: "a", stratum: "Correo", modality: "virtual", start_week: 1, end_week: 2, start_date: "2026-05-25", end_date: "2026-06-05" },
      { id: "b", stratum: "Sin fecha", modality: "virtual", start_week: 1, end_week: 2 },
    ] as never)).toHaveLength(1);
  });

  it("dibuja la vista sin claves técnicas y ofrece declarar fases cuando no hay", () => {
    const html = renderToStaticMarkup(
      <RitmoVista actores={actores} diarioGeneral={[]} diarioPorPublico={diarioPorPublico} fuentes={fuentes} fases={[]} onDeclararFases={() => {}} onVerFuentes={() => {}} />,
    );
    expect(html).toContain("Declarar fases");
    expect(html).toContain("Pulso del campo");
    expect(html).toContain("Por fuente y recopilador");
    expect(html).not.toMatch(/daily_actor|strategy_phases|2026-05-25/);
  });

  it("la superficie flotante es un diálogo con nombre y botón de cerrar", () => {
    const html = renderToStaticMarkup(<SuperficieFlotante tipo="sideover" titulo="Por fuente y recopilador" onCerrar={() => {}}><p>Detalle</p></SuperficieFlotante>);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Cerrar"');
  });
});
