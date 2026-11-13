/**
 * La lista para la ficha física (ítem 18): los casos que las marcas de
 * "Revisar con la ficha física" dejaron pendientes, con su pregunta, el valor
 * de la base y el motivo. Sale de las decisiones de `GET /limpieza` y del
 * detalle de casos de cada hallazgo marcado; no guarda nada.
 *
 * Un caso marcado que la regla ya no marca (la base cambió y se volvió a
 * auditar) no tiene fila que mostrar: se cuenta aparte para avisarlo.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { apiV2InstrumentoDrill } from "../../../api/validacion";
import { cargarDetalleCompleto } from "../hallazgos/detalleCompleto";
import { casosEnFicha, esFichaFisica, filasDeFicha, ordenarPorEncuesta, type FilaDeFicha } from "../hallazgos/fichaFisica";
import { elementosDeCola, preguntaRevisada, tablaDeCasos } from "../hallazgos/modeloHallazgos";
import type { LimpiezaSummary } from "../types";

export type LecturaDeLaListaDeFicha =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | {
      fase: "lista";
      filas: FilaDeFicha[];
      /** Hallazgos con casos marcados. */
      nHallazgos: number;
      /** Casos marcados que la regla ya no marca. */
      nFuera: number;
    };

export function useListaDeFicha(data: LimpiezaSummary | null, baseNombre: string | null): LecturaDeLaListaDeFicha {
  const [lectura, setLectura] = useState<LecturaDeLaListaDeFicha>({ fase: "cargando" });

  // Las marcas por hallazgo; la clave cambia cuando cambia una marca, no con cada lectura de la cola.
  const marcadas = useMemo(() => {
    if (!data) return null;
    const porHallazgo = new Map<string, typeof data.decision_draft>();
    for (const d of data.decision_draft) {
      if (!esFichaFisica(d)) continue;
      porHallazgo.set(d.source_id, [...(porHallazgo.get(d.source_id) ?? []), d]);
    }
    return porHallazgo;
  }, [data]);
  const clave = useMemo(
    () => (marcadas ? JSON.stringify([...marcadas.entries()].map(([id, ds]) => [id, ds.map((d) => [d.id, d.updated_at, d.rationale, casosEnFicha(d)])])) : null),
    [marcadas],
  );
  // La lectura entera cambia en cada relectura de la cola; el efecto solo depende de si cambiaron las marcas.
  const ultima = useRef({ data, marcadas });
  ultima.current = { data, marcadas };

  useEffect(() => {
    const { data: lectura_, marcadas: porHallazgo } = ultima.current;
    if (!lectura_ || !porHallazgo) {
      setLectura({ fase: "cargando" });
      return undefined;
    }
    if (porHallazgo.size === 0) {
      setLectura({ fase: "lista", filas: [], nHallazgos: 0, nFuera: 0 });
      return undefined;
    }
    let vigente = true;
    setLectura({ fase: "cargando" });
    const nombres = new Map(elementosDeCola(lectura_).map((e) => [e.id, e.nombre]));
    Promise.all([...porHallazgo.entries()].map(async ([id, decisiones]) => {
      const drill = await cargarDetalleCompleto((pagina) => apiV2InstrumentoDrill(id, baseNombre, pagina));
      const item = lectura_.decision_queue.find((q) => q.source_id === id) ?? null;
      const filas = filasDeFicha({ hallazgoId: id, hallazgo: nombres.get(id) ?? id, decisiones, tabla: tablaDeCasos(drill, item), pregunta: preguntaRevisada(null, drill, item) });
      const marcados = new Set(decisiones.flatMap((d) => casosEnFicha(d)));
      return { filas, fuera: Math.max(0, marcados.size - filas.length) };
    })).then(
      (partes) => {
        if (!vigente) return;
        setLectura({
          fase: "lista",
          filas: ordenarPorEncuesta(partes.flatMap((p) => p.filas)),
          nHallazgos: porHallazgo.size,
          nFuera: partes.reduce((n, p) => n + p.fuera, 0),
        });
      },
      (e) => { if (vigente) setLectura({ fase: "error", mensaje: (e as Error).message }); },
    );
    return () => { vigente = false; };
  }, [baseNombre, clave]);

  return lectura;
}
