import { fasesDeImport } from "../carga/plataforma/modeloPlataforma";
import { usePlataformaStore, type PlataformaState } from "../carga/plataforma/usePlataformaStore";

/**
 * L31b — la tarjeta de Procesamiento del Home muestra el import de plataforma
 * que corre en segundo plano. El job vive en el store de Carga con vida de
 * módulo (se puede salir de Carga y sigue), así que el Home lo lee de ahí: sin
 * esto, quien volvía al Home veía «Sigue: Carga» mientras la base se estaba
 * importando.
 */
export type ImportEnCurso = {
  etiqueta: string;
  /** Fase visible del importador («Descargar respuestas»…). */
  fase: string;
  /** 0–100, o null cuando el worker todavía no informa avance. */
  percent: number | null;
  /** Hay más de un import a la vez; se muestra el más antiguo. */
  otros: number;
};

export function importEnCursoDe(state: Pick<PlataformaState, "lanzando" | "vivos">): ImportEnCurso | null {
  const vivos = Object.values(state.vivos).filter((vivo) => vivo != null);
  const lanzando = Object.values(state.lanzando).filter((item) => item != null);
  const total = vivos.length + lanzando.length;
  if (total === 0) return null;
  const vivo = [...vivos].sort((a, b) => a.iniciadoEn - b.iniciadoEn)[0];
  if (vivo) {
    const percent = vivo.progreso?.percent;
    return {
      etiqueta: vivo.etiqueta,
      fase: fasesDeImport(vivo.estrategia)[vivo.progreso?.fase ?? 0],
      percent: typeof percent === "number" ? Math.max(0, Math.min(100, Math.round(percent))) : null,
      otros: total - 1,
    };
  }
  const primero = [...lanzando].sort((a, b) => a.iniciadoEn - b.iniciadoEn)[0];
  return { etiqueta: primero.etiqueta, fase: fasesDeImport(primero.estrategia)[0], percent: null, otros: total - 1 };
}

export function useImportEnCurso(): ImportEnCurso | null {
  const lanzando = usePlataformaStore((state) => state.lanzando);
  const vivos = usePlataformaStore((state) => state.vivos);
  return importEnCursoDe({ lanzando, vivos });
}
