// Lo que se ve del panel «Segmentos de cruce» (ADR 0107) y de la fila de cruce
// en la matriz, sin portal.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Segmento, SegmentoEnBase } from "../../../api/segmentos";
import { EquivalenciasTabla } from "../EquivalenciasTabla";
import { aFilasEditor } from "../equivalenciasEditorModel";
import type { CodigosObservados } from "../../../api/codigosObservados";
import { SegmentoEnBase as SegmentoEnBaseVista } from "./SegmentoEnBase";
import { SegmentosCuerpo } from "./SegmentosPanel";
import { ESTADO_INICIAL_SEGMENTOS, type ControlSegmentos, type EstadoSegmentos } from "./useSegmentos";

const BASES = ["2024", "2025", "2026"];

const enBase = (extra: Partial<SegmentoEnBase> = {}): SegmentoEnBase => ({
  origen: "cruce_1",
  mapa: { "1": "1", "2": "2" },
  estado: "definido",
  n_sin_mapa: 0,
  codigos_sin_mapa: [],
  ...extra,
});

const edad: Segmento = {
  clave: "edad",
  nombre: "cruce_edad",
  etiqueta: "Edad",
  escala: [{ codigo: "1", etiqueta: "18 a 20 años" }, { codigo: "2", etiqueta: "21 años a más" }],
  por_base: {
    "2024": enBase(),
    "2025": enBase({ origen: "P1_recod", mapa: { "1": "2" }, estado: "incompleto", n_sin_mapa: 37, codigos_sin_mapa: ["2"] }),
    "2026": enBase({ origen: "", mapa: {}, estado: "sin_origen" }),
  },
  fila_ref: "SEG-edad",
};

const control = (estado: Partial<EstadoSegmentos>): ControlSegmentos => ({
  estado: { ...ESTADO_INICIAL_SEGMENTOS, catalogo: { tipo: "listo", variables: {} }, ...estado },
  guardar: async () => true,
  quitar: async () => undefined,
  limpiarMensaje: () => undefined,
});

const cuerpo = (estado: Partial<EstadoSegmentos>, foco: string | null = null) =>
  renderToStaticMarkup(createElement(SegmentosCuerpo, { control: control(estado), foco, ordenBases: BASES, onIr: () => undefined }));

const listo = (segmentos: Segmento[]): Partial<EstadoSegmentos> => ({
  lectura: { tipo: "listo", datos: { disponible: true, bases: ["2026", "2024", "2025"], segmentos } },
});

describe("Segmentos de cruce", () => {
  it("leyendo: un solo estado que contiene su vacío", () => {
    const html = cuerpo({});
    expect(html).toContain("Leyendo los segmentos del estudio…");
    expect(html).toContain('data-qa-geometry-capacity="owned"');
  });

  it("sin segmentos: la sección contiene su vacío (C3), declara su grupo (C1) y ofrece «Nuevo segmento»", () => {
    const html = cuerpo(listo([]));
    expect(html).toContain('data-qa-geometry-group="carga/segmentos"');
    expect((html.match(/data-qa-geometry-member/g) ?? []).length).toBe(1);
    expect(html).toContain("Segmentos del estudio");
    expect(html).toContain("Nuevo segmento");
    expect(html).toContain("Declara una vez la edad, el sexo o la facultad");
    expect(html).not.toContain("<table");
  });

  it("la tabla segmento × base dice el estado de cada celda, con las bases en el orden de la serie", () => {
    const html = cuerpo(listo([edad]));
    expect(html).toContain("cruce_edad");
    expect(html).toContain("Definido");
    expect(html).toContain("desde cruce_1");
    expect(html).toContain("Faltan 37 casos por asignar");
    expect(html).toContain("Sin origen");
    expect(html).toContain("1 segmento · 1 base con algo por resolver");
    const cabeceras = [...html.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map((m) => m[1]);
    expect(cabeceras).toEqual(["Segmento", "2024", "2025", "2026"]);
    expect(html).toContain('aria-label="Editar cruce_edad"');
    expect(html).toContain('aria-label="Quitar cruce_edad"');
  });

  it("con `foco`, el editor del segmento: escala, una sección por base y el pie con «Guardar segmento»", () => {
    const html = cuerpo(listo([edad]), "edad");
    expect(html).toContain("Editar «cruce_edad»");
    expect(html).toContain("Nombre en todas las bases");
    expect(html).toContain("cruce_");
    expect(html).toContain("Escala estándar");
    expect(html).toContain("Partir de las opciones de…");
    expect(html).toContain("18 a 20 años");
    // Una sección por base, más el segmento y la escala.
    expect((html.match(/data-qa-geometry-member/g) ?? []).length).toBe(5);
    expect(html).toContain("Por completar");
    expect(html).toContain("1 de 2 códigos asignados · 1 sin mapa");
    expect(html).toContain("Sin origen, el segmento queda vacío en 2026.");
    expect(html).toContain("Sin dato");
    expect(html).toContain("Guardar segmento");
  });

  it("«Emparejar todas por etiqueta» vive en la escala estándar, una vez, y no en cada base", () => {
    const html = cuerpo({
      ...listo([edad]),
      catalogo: {
        tipo: "listo",
        variables: {
          "2025": [{ name: "P1_recod", label: "Edad", seccion: "", opciones: [{ codigo: "1", etiqueta: "18–20 años" }, { codigo: "2", etiqueta: "21 años a más" }] }],
        },
      },
    }, "edad");
    expect((html.match(/Emparejar todas por etiqueta/g) ?? []).length).toBe(1);
    expect(html).toContain('title="Lleva 1 código sin mapa en 2025 a la categoría con su misma etiqueta. No toca lo ya asignado."');
    expect(html).not.toContain(">Emparejar por etiqueta<");
  });

  it("un `foco` que no existe lo dice y ofrece volver", () => {
    const html = cuerpo(listo([edad]), "sexo");
    expect(html).toContain("El estudio no tiene un segmento «sexo».");
    expect(html).toContain("Ver todos los segmentos");
  });

  it("estudio sin bases separadas y error de lectura", () => {
    expect(cuerpo({ lectura: { tipo: "listo", datos: { disponible: false, bases: [], segmentos: [] } } }))
      .toContain("Este estudio no tiene bases separadas");
    const html = cuerpo({ lectura: { tipo: "error", mensaje: "Sin conexión · E_INTERNAL" } });
    expect(html).toContain("No se pudieron leer los segmentos de cruce.");
    expect(html).toContain("E_INTERNAL");
  });
});

describe("fila de cruce en la matriz", () => {
  it("lleva la marca «Cruce», se lee sin buscador y su edición remite al panel de segmentos", () => {
    const filas = aFilasEditor([
      { seccion: "", etiqueta_estandar: "Uso de salud", variables: { "2024": "p13_1", "2025": "p11_1" }, cantidad: 2 },
      { id: "SEG-edad", cruce: true, seccion: "Segmentos de cruce", etiqueta_estandar: "Edad", variables: { "2024": "cruce_edad" }, cantidad: 1 },
    ]);
    const html = renderToStaticMarkup(createElement(EquivalenciasTabla, {
      bases: ["2024", "2025"],
      filas,
      variablesPorBase: {},
      onAsignar: () => undefined,
      onEditar: () => undefined,
      onQuitar: () => undefined,
      onConfirmar: () => undefined,
      onAgregarFila: () => undefined,
      onArmonizar: () => undefined,
      onSegmento: () => undefined,
    }));
    const cruce = html.slice(html.indexOf('class="is-cruce"'));
    expect(cruce).toContain(">Cruce<");
    expect(cruce).toContain("cruce_edad");
    expect(cruce).toContain("Sin origen");
    expect(cruce).toContain('aria-label="Editar el segmento Edad"');
    expect(cruce).not.toContain("Quitar Edad");
    expect(cruce).not.toContain("<input");
    // Las filas sueltas siguen con su buscador y su botón de quitar.
    expect(html).toContain("Quitar Uso de salud");
  });
});

describe("una base del editor con los valores observados", () => {
  const observados = (extra: Partial<CodigosObservados> = {}): CodigosObservados => ({
    base: "2026", variable: "P1", tipo: "numerica",
    codigos: [{ codigo: "18", etiqueta: "", n: 12 }, { codigo: "19", etiqueta: "", n: 30 }, { codigo: "23", etiqueta: "", n: 4 }],
    n_validos: 46, n_sin_dato: 5, truncado: false,
    ...extra,
  });
  const render = (lectura: Parameters<typeof SegmentoEnBaseVista>[0]["lectura"], mapa: Record<string, string> = { "18": "1" }) =>
    renderToStaticMarkup(createElement(SegmentoEnBaseVista, {
      base: "2026",
      anclaId: "a",
      opciones: [{ name: "P1", label: "Edad", seccion: "" }],
      catalogoError: false,
      entrada: { origen: "P1", mapa, marcados: [] },
      guardado: undefined,
      escala: edad.escala,
      anio: 2026,
      despachar: () => undefined,
      lectura,
    }));

  it("la tabla son los valores de la data, con su columna de casos; el sin dato es un dato", () => {
    const html = render({ tipo: "listo", datos: observados() });
    expect(html).toContain(">Casos<");
    expect(html).toContain(">12<");
    expect(html).toContain(">30<");
    expect(html).toContain("1 de 3 códigos asignados · 2 sin mapa · Faltan 34 casos por asignar");
    expect(html).toContain("Sin dato: 5 casos");
    expect(html).toContain("Rangos");
    expect(html).not.toContain("Tramos de antigüedad");
  });

  it("un código con 0 casos y sin mapa se lee tenue («sin casos») y no cuenta como pendiente", () => {
    const html = render(
      { tipo: "listo", datos: observados({ codigos: [{ codigo: "1", etiqueta: "18–20 años", n: 40 }, { codigo: "99", etiqueta: "No sé", n: 0 }] }) },
      { "1": "1" },
    );
    expect(html).toContain("1 de 2 códigos asignados · 1 sin casos");
    expect(html).not.toContain("is-sin-mapa");
    expect(html).not.toContain("Faltan");
    expect(html).toContain('class="is-sin-casos"');
    expect(html).toContain(">sin casos<");
    expect(html).toContain(">Definido<");
    // «Emparejar por etiqueta» ya no vive en cada base: es «Emparejar todas», en la escala.
    expect(html).not.toContain("Emparejar");
  });

  it("un año de ingreso ofrece los tramos de antigüedad", () => {
    const html = render({ tipo: "listo", datos: observados({ codigos: [{ codigo: "2022", etiqueta: "", n: 9 }, { codigo: "2025", etiqueta: "", n: 3 }] }) }, {});
    expect(html).toContain("Tramos de antigüedad");
  });

  it("texto libre lo dice en una línea y no ofrece tabla", () => {
    const html = render({ tipo: "listo", datos: observados({ tipo: "texto", codigos: [] }) });
    expect(html).toContain("Variable de texto: elige una categórica o numérica.");
    expect(html).not.toContain("<table");
  });

  it("un identificador lo dice en una línea sobria: sin tabla, sin ayudas", () => {
    const html = render({ tipo: "listo", datos: observados({ tipo: "identificador", codigos: [] }) }, {});
    expect(html).toContain("Parece un identificador: sus valores no se listan.");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("Rangos");
    expect(html).not.toContain("Tramos de antigüedad");
  });

  it("leyendo, lo dice; si falla, lo dice y queda lo conocido", () => {
    expect(render({ tipo: "cargando" })).toContain("Leyendo los valores de P1 en 2026…");
    const html = render({ tipo: "error", mensaje: "No existe la variable · E_CODIGOS_VARIABLE_NOT_FOUND" });
    expect(html).toContain("No se pudieron leer los valores de P1");
    expect(html).not.toContain(">Casos<");
  });
});
