import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { PestanaPropiaDeAulas } from "../navegacion/PestanaPropiaDeAulas";
import { CursosHorarioAulas } from "./CursosHorarioAulas";

const criterio = { numerador: "", denominador: "", banda: "", vara_agregada: "", senal: "" };

const hsvg = {
  dos_tasas: {
    aulas: [
      { codigo: "CH 82", facultad: "DERECHO", elegibles: 45, efectivas: 32, tasa_prevista: 0.558, tasa_observada: 32 / 45, banda: 0.145, numerador: "plataforma", senal: "sobre" },
      { codigo: "CH 172", facultad: "LETRAS Y CIENCIAS HUMANAS", elegibles: 10, efectivas: 1, tasa_prevista: 0.8, tasa_observada: 0.1, numerador: "plataforma", senal: "sin_banda" },
      { codigo: "EXTRA 31", facultad: "DERECHO", elegibles: 44, efectivas: 3, tasa_prevista: 0.558, tasa_observada: 3 / 44, banda: 0.147, numerador: "parte", senal: "bajo" },
      { codigo: "CH 140", facultad: "GESTION Y ALTA DIRECCION", elegibles: 44, tasa_prevista: 0.55, senal: "pendiente" },
    ],
    criterio,
  },
  course_status_rol_y_estado: {
    titulares: { total: 174, aplicado: 152, agendado: 14, sin_agendar: 2, rechazado: 4, reemplazado: 2, agendado_vencido: 7 },
    reemplazos: { total: 1173, utilizado: 29 },
    banco: { total: 45, utilizado: 7 },
  },
  course_status_cobertura: [
    { clave: "nulo", aulas: 0, etiqueta: "Sin respuestas" },
    { clave: "critico", aulas: 18, etiqueta: "Muy por debajo (menos de la mitad)" },
    { clave: "insuficiente", aulas: 27, etiqueta: "Se quedó a medias (50-75 %)" },
    { clave: "parcial", aulas: 23, etiqueta: "Llegó a la mayor parte (75-90 %)" },
    { clave: "satisfactorio", aulas: 12, etiqueta: "Casi llegó (90-100 % de lo esperado)" },
    { clave: "pleno", aulas: 80, etiqueta: "Llegó a lo esperado" },
  ],
} as unknown as MonitoreoAulasDashboard;

function pintar(dashboard: MonitoreoAulasDashboard | null, { cargando = false, url = "/monitoreo?modo=aulas&seccion=avance&pestana=cursos" } = {}) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <CursosHorarioAulas dashboard={dashboard} cargando={cargando} vacioSinTablero={<p>Sin tablero</p>} />
    </MemoryRouter>,
  );
}

describe("CursosHorarioAulas", () => {
  it("HSVG: publica su marca, declara sus superficies (C1) y pinta las tres piezas", () => {
    const html = pintar(hsvg);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-avance-cursos"');
    expect(html).toContain('data-qa-geometry-group="aulas-cursos"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(html).toContain('data-qa-geometry-member="tabla"');
    expect(html).toContain('data-qa-geometry-member="lateral"');
    expect(html).toContain('data-qa-geometry-capacity="owned"');
    expect(html).toContain("Cada curso-horario contra su tasa prevista");
    expect(html).toContain("3 aplicados, del que más se aleja hacia abajo");
    expect(html).toContain("Pocos elegibles para juzgar");
    expect(html).toContain("Por debajo de lo previsto");
    expect(html).toContain("Titulares");
    expect(html).toContain("174 del sorteo");
    expect(html).toContain("Reservas usadas de 1,173");
    expect(html).toContain("Extras usados de 45");
    expect(html).toContain("Cobertura de lo esperado");
    expect(html).toContain("160 cursos-horario aplicados con meta");
    expect(html).toContain("Llegó a lo esperado");
  });

  it("la tabla es una tabla de verdad: cabeceras de columna, código como cabecera de fila y enlace a su ficha", () => {
    const html = pintar(hsvg);
    expect(html).toContain('<th scope="col">Código</th>');
    expect(html).toContain('<th scope="row" class="aulas-ch-codigo">');
    expect(html).toContain('href="/monitoreo?modo=aulas&amp;seccion=control&amp;pestana=partes&amp;panel=codigo&amp;foco=aula%3ACH%20172"');
    // El primero es el que más se aleja hacia abajo.
    expect(html.indexOf("CH 172")).toBeLessThan(html.indexOf("EXTRA 31"));
    expect(html.indexOf("EXTRA 31")).toBeLessThan(html.indexOf("CH 82"));
    // El pendiente no entra.
    expect(html).not.toContain(">CH 140<");
    expect(html).toContain("No entran 1 sin aplicar todavía");
    // La cifra del parte se declara.
    expect(html).toContain(">parte</span>");
  });

  it("con el foco en una facultad lo dice y deja quitarlo", () => {
    const html = pintar(hsvg, { url: "/monitoreo?modo=aulas&seccion=avance&pestana=cursos&foco=facultad%3ADERECHO" });
    expect(html).toContain("Sólo Derecho");
    expect(html).toContain("2 aplicados de Derecho");
    expect(html).not.toContain(">CH 172<");
  });

  it("vacíos dentro del marco con su clase (C3, C5)", () => {
    const html = pintar({} as MonitoreoAulasDashboard);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-avance-cursos"');
    expect(html).toContain('data-qa-geometry-empty="desconexion"');
    expect(html).toContain("Cada curso-horario contra su tasa prevista");
    expect(html).toContain("Titulares");
    expect(html).toContain("Cobertura de lo esperado");
  });

  it("sin tablero: el vacío del perfil, con su marca terminal", () => {
    const html = pintar(null);
    expect(html).toContain('data-audit-ready="vacio:sin-tablero"');
    expect(html).toContain("Sin tablero");
  });

  it("mientras carga: la silueta con la marca en false", () => {
    const html = pintar(hsvg, { cargando: true });
    expect(html).toContain('data-audit-ready="false"');
    expect(html).toContain("Preparando el corte");
  });

  it("el despachador lo monta en la vista principal y no en la sub-vista del estado del campo", () => {
    const vacio = <p>Sin tablero</p>;
    const principal = renderToStaticMarkup(
      <MemoryRouter>
        <PestanaPropiaDeAulas direccion={{ seccion: "avance", pestana: "cursos", panel: null }} dashboard={hsvg} cargando={false} vacioSinTablero={vacio} />
      </MemoryRouter>,
    );
    expect(principal).toContain('data-audit-ready="monitoreo-aulas-avance-cursos"');
    const campo = renderToStaticMarkup(
      <MemoryRouter>
        <PestanaPropiaDeAulas direccion={{ seccion: "avance", pestana: "cursos", panel: "campo" }} dashboard={hsvg} cargando={false} vacioSinTablero={vacio} />
      </MemoryRouter>,
    );
    expect(campo).toBe("");
  });
});
