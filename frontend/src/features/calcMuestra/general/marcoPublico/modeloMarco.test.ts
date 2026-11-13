import { describe, expect, it } from "vitest";

import type { ColumnaDelMarco, CruceDelMarco, LecturaDelMarco } from "../../../../api/calcMuestraMarcoPublico";
import {
  celdasSinGrupo,
  columnasConUso,
  conRotulo,
  conUso,
  ESTADO_MARCO_INICIAL,
  gruposIniciales,
  motivoNoAvanzar,
  moverCelda,
  poblacionDeGrupo,
  recetaDe,
  reglasDe,
  renombrarGrupo,
  type EstadoMarco,
} from "./modeloMarco";

const col = (nombre: string, usoSugerido: ColumnaDelMarco["usoSugerido"], tipo: ColumnaDelMarco["tipo"] = "categoria"): ColumnaDelMarco => ({
  nombre, tipo, valores: 3, vacios: 0, unico: false, distribucion: [], otros: 0, resumen: null, usoSugerido,
});

const LECTURA: LecturaDelMarco = {
  formato: "xlsx", separador: "", codificacion: "", hojas: [], sugerida: "datos", hoja: "datos", filas: 100,
  columnas: [col("DOCENTE", "id", "codigo"), col("CORREO", "correo", "correo"), col("CAT", "cuota"), col("DED", "cuota"), col("DEPTO", "cuota")],
};
const conLectura = (patch: Partial<EstadoMarco> = {}): EstadoMarco => ({ ...ESTADO_MARCO_INICIAL, fileId: "f1", hoja: "datos", lectura: LECTURA, ...patch });

const CRUCE: CruceDelMarco = {
  filaVariable: "CAT", columnaVariable: "DED", filas: ["Contratado", "Principal"], columnas: ["TPA", "DTC"],
  conteos: [[60, 10], [0, 30]], total: 100,
};

describe("modelo del recorrido del marco", () => {
  it("identificador y correo son únicos: elegir otro devuelve el anterior a su uso sugerido", () => {
    const e = conLectura();
    expect(columnasConUso(e, "id")).toEqual(["DOCENTE"]);
    const usos = conUso(e, "CAT", "id");
    expect(columnasConUso({ ...e, usos }, "id")).toEqual(["CAT"]);
    expect(usos.DOCENTE).toBe("no");
  });

  it("las reglas salen de los valores excluidos y del interruptor de correo", () => {
    const e = conLectura({ exclusiones: { DEPTO: ["Externo"], CAT: [] }, sinCorreo: true });
    expect(reglasDe(e)).toEqual([{ tipo: "excluir_valores", columna: "DEPTO", valores: ["Externo"] }, { tipo: "excluir_sin_correo" }]);
    const sinCol = conLectura({ sinCorreo: true, usos: { CORREO: "no" } });
    expect(reglasDe(sinCol)).toEqual([]);
  });

  it("cada fila arranca como su grupo y las celdas vacías no entran", () => {
    const g = gruposIniciales(CRUCE);
    expect(g).toEqual([
      { nombre: "Contratado", celdas: [{ fila: "Contratado", columna: "TPA" }, { fila: "Contratado", columna: "DTC" }] },
      { nombre: "Principal", celdas: [{ fila: "Principal", columna: "DTC" }] },
    ]);
    expect(celdasSinGrupo(CRUCE, g)).toEqual([]);
  });

  it("mover una celda a un grupo nuevo lo crea, y un grupo vacío desaparece", () => {
    let g = gruposIniciales(CRUCE);
    g = moverCelda(g, "Contratado", "DTC", "Contratado TC");
    expect(g.map((x) => x.nombre)).toEqual(["Contratado", "Principal", "Contratado TC"]);
    expect(poblacionDeGrupo(CRUCE, g[2])).toBe(10);
    g = moverCelda(g, "Principal", "DTC", "Contratado TC");
    expect(g.map((x) => x.nombre)).toEqual(["Contratado", "Contratado TC"]);
    expect(renombrarGrupo(g, "Contratado", "Contratado TC").map((x) => x.nombre)).toEqual(["Contratado", "Contratado TC"]);
  });

  it("no avanza sin archivo, sin identificador o con celdas sin grupo, y dice por qué", () => {
    expect(motivoNoAvanzar("archivo", ESTADO_MARCO_INICIAL, null)).toBe("Sube el archivo del marco.");
    expect(motivoNoAvanzar("columnas", conLectura({ usos: { DOCENTE: "no" } }), null)).toBe("Marca la columna que identifica a cada persona.");
    expect(motivoNoAvanzar("invitados", conLectura(), null)).toBeNull();
    const seg = conLectura({ segmento: { nombre: "", fila: "CAT", columna: "DED", grupos: [{ nombre: "A", celdas: [{ fila: "Contratado", columna: "TPA" }] }] } });
    expect(motivoNoAvanzar("segmentos", seg, CRUCE)).toBe("Quedan 2 celdas sin grupo.");
    expect(motivoNoAvanzar("segmentos", conLectura(), null)).toBeNull();
  });

  it("la receta lleva identificador, correo, usos, reglas y el segmento con sus grupos", () => {
    const e = conLectura({ exclusiones: { DEPTO: ["Externo"] }, segmento: { nombre: " Condición ", fila: "CAT", columna: "DED", grupos: gruposIniciales(CRUCE) } });
    const r = recetaDe(e);
    expect(r.columnas).toEqual({ id: "DOCENTE", correo: "CORREO" });
    expect(r.usos.CAT).toBe("cuota");
    expect(r.reglas).toHaveLength(1);
    expect(r.segmento.nombre).toBe("Condición");
    expect(r.segmento.grupos).toHaveLength(2);
    // Sin nombre escrito, el segmento se nombra por sus columnas y no choca con una columna de la base.
    const sinNombre = recetaDe(conLectura({ segmento: { nombre: "", fila: "CAT", columna: "DED", grupos: [] } }));
    expect(sinNombre.segmento.nombre).toBe("CAT por DED");
  });
});

describe("hoja de una tabla de conteos", () => {
  it("elige la hoja que se llama como el actor antes que la más grande", async () => {
    const { hojaDelActor } = await import("./FuenteConteos");
    const hojas = [
      { nombre: "Personas en varios públicos", tipo: "datos" as const, filas: 900, columnas: 9, encabezadoFila: 1 },
      { nombre: "Estudiantes de pregrado", tipo: "datos" as const, filas: 40, columnas: 6, encabezadoFila: 6 },
      { nombre: "Notas", tipo: "notas" as const, filas: 1, columnas: 1, encabezadoFila: 1 },
    ];
    expect(hojaDelActor(hojas, "Estudiantes de Pregrado", "Personas en varios públicos")).toBe("Estudiantes de pregrado");
    expect(hojaDelActor(hojas, "Docentes", "Personas en varios públicos")).toBe("Personas en varios públicos");
  });
});

describe("rótulos corregidos", () => {
  it("un rótulo vacío o igual al valor se quita y la receta lleva los demás", () => {
    let e = conLectura();
    e = { ...e, rotulos: conRotulo(e, "SEXO", "M", " Hombres ") };
    e = { ...e, rotulos: conRotulo(e, "SEXO", "F", "Mujeres") };
    expect(e.rotulos).toEqual({ SEXO: { M: "Hombres", F: "Mujeres" } });
    e = { ...e, rotulos: conRotulo(e, "SEXO", "M", "M") };
    e = { ...e, rotulos: conRotulo(e, "SEXO", "F", "") };
    expect(e.rotulos).toEqual({});
    expect(recetaDe({ ...e, rotulos: { CAT: { CONTRATADO: "Contratado" } } }).rotulos).toEqual({ CAT: { CONTRATADO: "Contratado" } });
  });
});
