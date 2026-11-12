// "Archivos del estudio": una fila por base y una columna por entregable de
// Analítica y Gráficos, con su estado (prototipo "estado").
//
// De dónde sale cada celda, y por qué no todas tienen dato:
//  - La base activa: los indicadores de la sesión (`analitica_spss_ok`,
//    `analitica_codebook_ok`, `analitica_frecuencias_ok`, `analitica_cruces_ok`,
//    `analitica_ficha_tecnica_ok`, `graficos_ppt_ok`, `graficos_word_ok`). El
//    motor los cambia de base al activar otra y los apaga cuando cambia algo
//    de lo que dependen (una decisión de limpieza, la codificación aplicada):
//    por eso el estado apagado se dice "Por generar" y no "Sin generar".
//  - Las demás bases: solo el informe (`EstudioBase.status.graficos`). El
//    motor guarda los otros indicadores por base (`analitica_status_por_base`)
//    pero no los publica en `GET /api/estudio`: la celda dice "Sin dato" y el
//    pedido queda en `PEDIDO_ARCHIVOS_POR_BASE` (M8).

import type { SessionState } from "../../../api/core";
import type { BasesDelEstudio } from "./basesDelEstudioModel";

export type EntregableId = "base-final" | "libro" | "frecuencias" | "cruces" | "ficha" | "informe";

export const ENTREGABLES: readonly { id: EntregableId; nombre: string }[] = [
  { id: "base-final", nombre: "Base en SPSS" },
  { id: "libro", nombre: "Libro de códigos" },
  { id: "frecuencias", nombre: "Frecuencias" },
  { id: "cruces", nombre: "Cruces" },
  { id: "ficha", nombre: "Ficha técnica" },
  { id: "informe", nombre: "Informe" },
];

export type EstadoDeArchivo = "generado" | "por-generar" | "sin-dato";

export type CeldaDeArchivo = {
  entregable: EntregableId;
  estado: EstadoDeArchivo;
  /** Lo que se ve bajo el estado: "PowerPoint y Word". */
  detalle: string | null;
};

export type FilaDeArchivos = {
  nombre: string;
  etiqueta: string;
  activa: boolean;
  celdas: CeldaDeArchivo[];
};

export const PEDIDO_ARCHIVOS_POR_BASE =
  "M8: publicar en GET /api/estudio, por base, los indicadores de Analítica que el motor guarda en analitica_status_por_base";

const INDICADOR_DE_SESION: Readonly<Record<Exclude<EntregableId, "informe">, keyof SessionState>> = {
  "base-final": "analitica_spss_ok",
  libro: "analitica_codebook_ok",
  frecuencias: "analitica_frecuencias_ok",
  cruces: "analitica_cruces_ok",
  ficha: "analitica_ficha_tecnica_ok",
};

function informeDeSesion(state: SessionState): CeldaDeArchivo {
  const ppt = state.graficos_ppt_ok === true;
  const word = state.graficos_word_ok === true;
  const detalle = ppt && word ? "PowerPoint y Word" : ppt ? "PowerPoint" : word ? "Word" : null;
  return { entregable: "informe", estado: detalle ? "generado" : "por-generar", detalle };
}

export function archivosDelEstudio(bases: BasesDelEstudio | null, state: SessionState | null): FilaDeArchivos[] {
  if (!bases) return [];
  return bases.filas.map((fila) => {
    // Los indicadores de la sesión son de la base activa; sin sesión leída no se atribuyen a nadie.
    const deSesion = fila.activa && state != null;
    const celdas = ENTREGABLES.map<CeldaDeArchivo>(({ id }) => {
      if (id === "informe") {
        if (deSesion) return informeDeSesion(state);
        const graficos = fila.fases?.find((f) => f.fase === "graficos");
        if (!graficos) return { entregable: id, estado: "sin-dato", detalle: null };
        return { entregable: id, estado: graficos.tono === "success" ? "generado" : "por-generar", detalle: null };
      }
      if (!deSesion) return { entregable: id, estado: "sin-dato", detalle: null };
      return { entregable: id, estado: state[INDICADOR_DE_SESION[id]] === true ? "generado" : "por-generar", detalle: null };
    });
    return { nombre: fila.nombre, etiqueta: fila.etiqueta, activa: fila.activa, celdas };
  });
}
