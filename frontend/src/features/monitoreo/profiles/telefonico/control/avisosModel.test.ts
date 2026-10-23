import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { casosPorRevisar, construirAvisos, destinoDeAviso, detalleDeEmpate, porDestino, sinPrefijoDeCodigo } from "./avisosModel";

function reportes(alertas: Array<Record<string, unknown>>, telefonico: Record<string, Array<Record<string, unknown>>> = {}): MonitoreoAcreditacionReports {
  return {
    schema: "test",
    generated_at: "",
    reference_tabs: [],
    sheets: [
      { id: "alertas", title: "Alertas", blocks: [{ id: "alertas", title: "Alertas", columns: [], rows: alertas }] },
      { id: "monitoreo_telefonico", title: "Telefónico", blocks: Object.entries(telefonico).map(([id, rows]) => ({ id, title: id, columns: [], rows })) },
    ],
  } as unknown as MonitoreoAcreditacionReports;
}

const fila = (nivel: string, tipo: string, detalle: string, extra: Record<string, unknown> = {}) => ({
  Nivel: nivel, "Tipo alerta": tipo, "Detalle del tipo de alerta": detalle, Detalle: detalle, Responsable: "", CodPulso: "", ...extra,
});

describe("Control › Avisos del telefónico", () => {
  it("incluye los avisos fuertes del RMS cuando el bloque los trae, con su destino", () => {
    const { avisos } = construirAvisos(reportes([
      fila("Alta", "cruce_llave_bajo", "Solo 2 de 430 respuestas cruzan con el barrido."),
      fila("Media", "status_desconocido", "Pendiente de llamar: 12."),
      fila("Media", "status_desconocido", "Volver a llamar: 3."),
    ]));
    const porCodigo = Object.fromEntries(avisos.map((aviso) => [aviso.codigo, aviso]));
    expect(porCodigo.cruce_llave_bajo.destino.direccion).toEqual({ seccion: "insumos", pestana: "llave" });
    expect(porCodigo.cruce_llave_bajo.nivel).toBe("alta");
    expect(porCodigo.status_desconocido.destino.direccion).toEqual({ seccion: "insumos", pestana: "estados" });
    expect(porCodigo.status_desconocido.casos).toBe(2);
  });

  it("sin los avisos fuertes en el bloque, no los dibuja", () => {
    const { avisos } = construirAvisos(reportes([]));
    expect(avisos.some((aviso) => aviso.codigo.includes("cruce_llave"))).toBe(false);
  });

  it("separa los casos sin asignar y no los cuenta como aviso", () => {
    const resultado = construirAvisos(reportes(
      [fila("Media", "Casos sin responsable", "1197 casos sin responsable", { Responsable: "Sin responsable" })],
      { no_barridos_responsable: [{ Responsable: "Sin responsable", "No barridos": 1197 }] },
    ));
    expect(resultado.sinAsignar?.casos).toBe(1197);
    expect(resultado.avisos.some((aviso) => /sin responsable/i.test(aviso.titulo))).toBe(false);
  });

  it("lo que se corrige en la hoja del equipo no lleva enlace", () => {
    expect(destinoDeAviso("fecha irregular", "other")).toEqual({ etiqueta: "Hoja del equipo", direccion: null });
    expect(destinoDeAviso("duracion_muy_larga", "short_duration").direccion).toEqual({ seccion: "control", pestana: "respuestas" });
  });

  it("tres alertas por caso de dos responsables cuentan casos y nombran sus CodPulso", () => {
    const { avisos } = construirAvisos(reportes([
      fila("Alta", "Efectivo telefonico sin efectiva Kobo", "MVH0003", { Responsable: "Lucía", CodPulso: "MVH0003" }),
      fila("Alta", "Efectivo telefonico sin efectiva Kobo", "MVH0007", { Responsable: "Lucía", CodPulso: "MVH0007" }),
      fila("Alta", "Efectivo telefonico sin efectiva Kobo", "MVV0011", { Responsable: "Marco", CodPulso: "codigo:MVV0011" }),
    ]));
    const aviso = avisos.find((item) => /sin efectiva kobo/i.test(item.codigo));
    expect(aviso).toBeDefined();
    expect(aviso?.unidad).toBe("casos");
    expect(aviso?.casos).toBe(3);
    expect(aviso?.titulo).not.toMatch(/responsables/);
    expect(aviso?.detalle).not.toMatch(/más marcado/);
    expect(aviso?.afectados.map((caso) => caso.codigo).sort()).toEqual(["MVH0003", "MVH0007", "MVV0011"]);
    // El desglose junta a cada persona una vez.
    const etiquetas = aviso?.desglose.map((linea) => linea.etiqueta) ?? [];
    expect(new Set(etiquetas).size).toBe(etiquetas.length);
  });

  it("la cifra del motor manda sobre los códigos que nombra", () => {
    const { avisos } = construirAvisos(reportes([
      // Una alerta por código, y un código que llega dos veces: el motor cuenta 3.
      fila("Baja", "Sugerencia formato CodPulso", "Escrito sin el formato PDM.", { CodPulso: "1218" }),
      fila("Baja", "Sugerencia formato CodPulso", "Escrito sin el formato PDM.", { CodPulso: "1218" }),
      fila("Baja", "Sugerencia formato CodPulso", "Escrito sin el formato PDM.", { CodPulso: "1231" }),
    ]));
    const aviso = avisos.find((item) => /formato/i.test(item.codigo));
    expect(aviso?.casos).toBe(3);
    expect(aviso?.unidad).toBe("casos");
  });

  it("reúne los avisos por dónde se corrigen, con la hoja del equipo al final", () => {
    const { avisos } = construirAvisos(reportes([
      fila("Alta", "cruce_llave_bajo", "Solo 2 de 430 respuestas cruzan con el barrido."),
      fila("Media", "status_desconocido", "Pendiente de llamar: 12."),
      fila("Media", "Responsable con casos por iniciar", "Ana tiene 4 casos por iniciar", { Responsable: "Ana" }),
      fila("Media", "Responsable con casos por iniciar", "Beto tiene 6 casos por iniciar", { Responsable: "Beto" }),
    ], { estatus_dia: [] }));
    const destinos = porDestino([
      ...avisos,
      { ...avisos[0], id: "x", unidad: "casos", casos: 9, destino: { etiqueta: "Hoja del equipo", direccion: null } },
    ]);
    expect(destinos.at(-1)?.etiqueta).toBe("Hoja del equipo");
    expect(destinos.at(-1)?.casos).toBe(9);
    const equipo = destinos.find((destino) => destino.etiqueta === "Equipo, en Control");
    expect(equipo?.responsables).toBe(2);
    expect(equipo?.casos).toBe(0);
  });

  it("junta en una tabla los casos que nombran todos los avisos, con su causa y destino", () => {
    const { avisos } = construirAvisos(reportes([
      fila("Alta", "Efectivo telefonico sin efectiva Kobo", "x", { Responsable: "Lucía", CodPulso: "MVH0003" }),
      fila("Alta", "Efectivo telefonico sin efectiva Kobo", "x", { Responsable: "Marco", CodPulso: "MVV0011" }),
      fila("Alta", "cruce_llave_bajo", "Solo 2 de 430 respuestas cruzan con el barrido."),
    ]));
    const casos = casosPorRevisar(avisos);
    expect(casos.map((caso) => caso.codigo)).toEqual(["MVH0003", "MVV0011"]);
    const conCasos = avisos.find((aviso) => aviso.afectados.length);
    expect(casos[0].aviso).toBe(conCasos?.titulo);
    expect(casos[0].destino).toBe(conCasos?.destino.etiqueta);
  });

  it("con responsables empatados no dice «el más marcado»", () => {
    const { avisos } = construirAvisos(reportes([
      fila("Media", "Responsable con casos por iniciar", "Ana tiene 4 casos por iniciar", { Responsable: "Ana" }),
      fila("Media", "Responsable con casos por iniciar", "Beto tiene 4 casos por iniciar", { Responsable: "Beto" }),
    ]));
    const aviso = avisos.find((item) => item.unidad === "responsables");
    expect(aviso).toBeDefined();
    expect(aviso?.detalle).not.toMatch(/más marcado/);
    // La causa no repite la cifra: «2 responsables» va en la columna y la ficha.
    expect(aviso?.titulo).not.toMatch(/responsables/);
    expect(aviso?.casos).toBe(2);
    // La fila del fixture no trae cifra: cada responsable cuenta una alerta.
    expect(aviso?.detalle).toBe("Todos con la misma cifra (1).");
  });

  it("con empate parcial dice cuántos empatan arriba", () => {
    expect(detalleDeEmpate([
      { etiqueta: "Ana", valor: 28 }, { etiqueta: "Beto", valor: 28 }, { etiqueta: "Ciro", valor: 15 },
    ])).toBe("2 empatan en la cifra más alta (28).");
  });

  it("da ids únicos aunque dos grupos compartan causa", () => {
    const { avisos } = construirAvisos(reportes([
      fila("Alta", "cruce_llave_bajo", "a"),
    ]));
    expect(new Set(avisos.map((aviso) => aviso.id)).size).toBe(avisos.length);
  });

  it("lee de los bloques los avisos que el motor no emite como alerta", () => {
    const { avisos } = construirAvisos(reportes([], {
      control_tiempo_kobo: [
        { CodPulso: "PDM1371", "Duración segundos": 365_100 },
        { CodPulso: "PDM1429", "Duración segundos": 900 },
        { CodPulso: "PDM1429", "Duración segundos": 1000 },
      ],
      comparacion_codpulso: [{ CodPulso: "PDM1000", "Efectiva Kobo": "Sí", "Estado telefónico": "No barrido" }],
      estatus_dia: [{ Estado: "Efectivo", "1/07/2026": 10, "30/06/2020": 1, "Sin fecha": 2 }],
    }));
    const porCodigo = Object.fromEntries(avisos.map((aviso) => [aviso.codigo, aviso.casos]));
    expect(porCodigo).toMatchObject({ duracion_mayor_2h: 1, codpulso_repetido: 1, barrido_desfasado: 1, fecha_irregular: 3 });
  });

  it("quita el prefijo «codigo:» del detalle, no sólo de los afectados", () => {
    const { avisos } = construirAvisos(reportes([
      fila("Alta", "Efectiva Kobo fuera de base", "Kobo trae una respuesta completa, pero la llave detectada no aparece en la base (codigo:MVH9999).", { CodPulso: "codigo:MVH9999" }),
    ]));
    const textos = avisos.flatMap((aviso) => [aviso.titulo, aviso.detalle, ...aviso.afectados.map((caso) => `${caso.codigo} ${caso.nota}`)]);
    expect(textos.join(" ")).not.toMatch(/c[oó]digo:/i);
    expect(avisos.some((aviso) => aviso.detalle.includes("(MVH9999)"))).toBe(true);
    expect(sinPrefijoDeCodigo("Código: PDM1 y codigo:PDM2")).toBe("PDM1 y PDM2");
  });

  it("dos alertas de asignación del mismo dueño son un responsable", () => {
    const { avisos } = construirAvisos(reportes([
      fila("Media", "Responsable con casos por iniciar", "Ana tiene 4 casos por iniciar", { Responsable: "Ana" }),
      fila("Media", "Responsable con casos por iniciar", "Ana tiene 3 casos por iniciar", { Responsable: "Ana" }),
    ]));
    const aviso = avisos.find((item) => /por iniciar/i.test(item.codigo));
    expect(aviso?.titulo).not.toMatch(/2 responsables/);
    expect(aviso?.unidad).not.toBe("responsables");
    expect(aviso?.desglose.map((linea) => linea.etiqueta)).toEqual(["Ana"]);
    // Es la señal de asignación: se corrige en Equipo.
    expect(aviso?.destino.etiqueta).toBe("Equipo, en Control");
  });
});

describe("P3: la hoja dice «Efectivo» y Kobo no tiene envío", () => {
  it("va a Avisos con responsable, CodPulso y proGres", () => {
    const { avisos } = construirAvisos(reportes([], {
      discrepancias_telefonicas: [
        { Sentido: "hoja_sin_kobo", CodPulso: "PDM1114", proGres: "XYZ-26-900001", Responsable: "Op-02", "La hoja dice": "Efectivo", "Fecha hoja": "02/07/2026" },
        { Sentido: "hoja_sin_kobo", CodPulso: "PDM1153", proGres: "", Responsable: "", "La hoja dice": "Efectivo", "Fecha hoja": "" },
        { Sentido: "kobo_sin_hoja", CodPulso: "PDM1001", proGres: "", Responsable: "Op-01", "La hoja dice": "No contesta", "Fecha hoja": "" },
      ],
    }));
    const aviso = avisos.find((item) => item.codigo === "efectivo_sin_kobo");
    expect(aviso?.casos).toBe(2);
    expect(aviso?.afectados.map((caso) => caso.codigo)).toEqual(["PDM1114", "PDM1153"]);
    expect(aviso?.afectados[0]).toMatchObject({ responsable: "Op-02", nota: "proGres XYZ-26-900001" });
    expect(aviso?.afectados[1].responsable).toBe("Sin asignar");
    expect(aviso?.desglose).toEqual([{ etiqueta: "Op-02", valor: 1 }, { etiqueta: "Sin asignar", valor: 1 }]);
  });
});
