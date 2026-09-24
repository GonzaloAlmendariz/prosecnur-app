/**
 * Las superficies de Muestra general pintan lo que el motor publicó y
 * contienen su propio vacío (C3). Render estático: sin efectos, con el store
 * precargado como lo dejaría la rehidratación.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente } from "../../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida, CalcMuestraGeneralMarco } from "../../../../api/calcMuestraGeneral";
import { ArchivoMarcoGeneral } from "../ArchivoMarcoGeneral";
import { FichaCorrida } from "../FichaCorrida";
import { ResumenMarcoDeclarado } from "../ResumenMarcoDeclarado";
import { SeleccionGeneralVista } from "../SeleccionGeneral";
import { TablaUnidades } from "../TablaUnidades";

const COMP = { id: "c1", resultado: { n_operativo: 2 } } as unknown as CalcMuestraComponente;

const MARCO: CalcMuestraGeneralMarco = {
  file_id: "f1",
  hoja: "padron",
  columnas: { id: "dni", estrato: "", tamano: "" },
  marco_hash: "abcdef0123456789",
  N: 26954,
  estratos: [],
  declarado_at: "2026-09-24T06:00:00Z",
};

const CORRIDA: CalcMuestraGeneralCorrida = {
  corrida: {
    run_id: "a1b2c3d4e5f6", semilla: 20260924, rng_kind: "Mersenne-Twister/Inversion/Rejection",
    r_version: "R 4.4.1", metodo: "mas", modalidad: "probabilistica", marco_hash: "abcdef0123456789", config_hash: "c0ffee",
    N: 26954, n_titulares: 1, n_reservas: 1, piso_incumplible: false, reservas_omitidas_pps: false,
  },
  estratos: [{ clave: "(total)", N_h: 26954, n_h: 1, n_reservas: 1, arranque: null, pi: 3.71e-5 }],
  unidades: [
    { id: "U-1", estrato: "(total)", N_h: 26954, n_h: 1, pi: 3.71e-5, orden: 1, estado: "titular", lote_reserva: null, peso_base: 26954.18 },
    { id: "U-2", estrato: "(total)", N_h: 26954, n_h: 1, pi: null, orden: 1, estado: "reserva", lote_reserva: 1, peso_base: null },
  ],
  n_fuente: 2,
  componente_id: "c1",
  sorteado_at: "2026-09-24T06:19:57Z",
};

function seleccion(estado: { cargado?: boolean; marco?: CalcMuestraGeneralMarco | null; componente?: CalcMuestraComponente; pestana?: string } = {}) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/calc-muestra?modo=marco-disponible&seccion=seleccion"]}>
      <SeleccionGeneralVista
        componente={estado.componente ?? COMP}
        cargado={estado.cargado ?? true}
        error={null}
        marco={estado.marco ?? null}
        corrida={null}
        pestana={estado.pestana}
      />
    </MemoryRouter>,
  );
}

describe("Selección", () => {
  it("sin marco declarado muestra su vacío y lleva a Marco", () => {
    const html = seleccion();
    expect(html).toContain("Falta declarar el marco");
    expect(html).toContain("Ir a Marco");
    expect(html).toContain('data-audit-ready="true"');
  });

  it("antes de rehidratar declara readiness en false", () => {
    expect(seleccion({ cargado: false })).toContain('data-audit-ready="false"');
  });

  it("con marco y sin corrida: semilla por defecto, PPS con motivo y descarga deshabilitada con motivo", () => {
    const html = seleccion({ marco: MARCO });
    expect(html).toContain('value="20260924"');
    expect(html).toContain("Declara una columna de tamaño en Marco para usar PPS.");
    // E15 · P1: la descarga es de la corrida y vive en su pestaña.
    const corrida = seleccion({ marco: MARCO, pestana: "seleccion-corrida" });
    expect(corrida).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="cmg-exportar-estado"[^>]*>.*Descargar listado \(XLSX\)/);
    expect(corrida).toContain("Sortea primero: el libro sale de la corrida vigente.");
    expect(corrida).toContain("Todavía no hay sorteo");
    // Unidades sin sorteo contiene su vacío y lleva a Sorteo (C3).
    const unidades = seleccion({ marco: MARCO, pestana: "seleccion-unidades" });
    expect(unidades).toContain("Todavía no hay sorteo");
    expect(unidades).toMatch(/href="\/calc-muestra\?modo=marco-disponible&amp;seccion=seleccion&amp;pestana=seleccion-sorteo"[^>]*>Ir a Sorteo/);
  });
});

describe("técnica y modalidad", () => {
  it("una técnica de cuotas deja Sortear deshabilitado con su motivo", () => {
    const cuotas = { ...COMP, tecnica: "no_prob_cuotas" } as CalcMuestraComponente;
    const html = seleccion({ marco: MARCO, componente: cuotas });
    expect(html).toContain("no selecciona unidades con probabilidad conocida");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="cmg-sortear-motivo"/);
  });

  it("una cobertura censal no ofrece métodos ni reservas", () => {
    const censal = { ...COMP, tecnica: "intencion_censal" } as CalcMuestraComponente;
    const html = seleccion({ marco: MARCO, componente: censal });
    expect(html).toContain("Cobertura censal: el marco entero en orden aleatorio de contacto (π = 1).");
    expect(html).not.toContain("Método de selección");
    expect(html).not.toContain("Reservas por estrato");
  });

  it("la ficha de una corrida censal no habla de muestra", () => {
    const censo: CalcMuestraGeneralCorrida = { ...CORRIDA, corrida: { ...CORRIDA.corrida, modalidad: "censo" } };
    const html = renderToStaticMarkup(<FichaCorrida corrida={censo} componente={COMP} />);
    expect(html).toContain("Cobertura censal: el marco entero en orden aleatorio de contacto (π = 1).");
    expect(html).toContain("Unidades a contactar");
    expect(html).not.toContain("n a campo usado");
  });
});

describe("Ficha y listado", () => {
  it("la ficha publica la trazabilidad y habilita la descarga", () => {
    const html = renderToStaticMarkup(<FichaCorrida corrida={CORRIDA} componente={COMP} />);
    expect(html).toContain("a1b2c3d4e5f6");
    // El RNG se parte en las barras (<wbr>), pero se lee entero.
    expect(html.replace(/<[^>]+>/g, "")).toContain("Mersenne-Twister/Inversion/Rejection");
    expect(html).toContain("0.0000371");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="cmg-exportar-estado"/);
  });

  it("el listado conserva la π pequeña y no inventa la de la reserva", () => {
    const html = renderToStaticMarkup(
      <TablaUnidades unidades={CORRIDA.unidades!} filtro="todas" pagina={0} onFiltro={() => {}} onPagina={() => {}} />,
    );
    expect(html).toContain(">0.0000371<");
    expect(html).toContain('title="0.0000371"');
    expect(html).toContain("26,954.18");
    expect(html).toContain("Se recalcula al liberar el lote");
  });

  it("filtrar reservas en una corrida sin reservas dice por qué está vacío", () => {
    const soloTitulares = CORRIDA.unidades!.filter((u) => u.estado === "titular");
    const html = renderToStaticMarkup(
      <TablaUnidades unidades={soloTitulares} filtro="reserva" pagina={0} onFiltro={() => {}} onPagina={() => {}} />,
    );
    expect(html).toContain("Esta corrida no sorteó reservas.");
  });
});

describe("Marco › Archivo del marco", () => {
  it("sin componente contiene su vacío", () => {
    const html = renderToStaticMarkup(<ArchivoMarcoGeneral componente={null} />);
    expect(html).toContain("Aún no hay componente");
  });

  it("sin marco declarado abre el formulario de subida", () => {
    const html = renderToStaticMarkup(<ArchivoMarcoGeneral componente={COMP} />);
    expect(html).toContain("Declara el listado de unidades");
    expect(html).toContain("Subir archivo");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Declarar marco/);
  });

  it("el resumen publica N, N_h y la huella corta con la completa en el title", () => {
    const html = renderToStaticMarkup(
      <ResumenMarcoDeclarado
        marco={{
          ...MARCO,
          columnas: { id: "dni", estrato: "distrito", tamano: "" },
          estratos: [{ clave: "Cayma", N_h: 744 }, { clave: "Cercado", N_h: 4256 }],
          N: 5000,
        }}
      />,
    );
    expect(html).toContain("5,000");
    expect(html).toContain("4,256");
    expect(html).toContain('title="abcdef0123456789"');
    expect(html).toContain(">abcdef0123<");
  });
});
