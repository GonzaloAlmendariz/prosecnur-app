/**
 * La distribución de la pregunta revisada de un hallazgo, para la vista
 * "Distribución" (prototipo `validacion-hallazgos-rango`). Es la misma lectura
 * que Explorar (`POST /explorar/univariado`, base cargada, sin filtros): solo
 * se pide cuando la vista la enseña.
 */
import { useEffect, useState } from "react";
import { apiV2ExplorarUnivariado } from "../../../api/client";
import type { ExploradorDistNum } from "../../../api/validacionExplorar";

export type LecturaDeDistribucion =
  | { fase: "inactiva" }
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  /** `num` es `null` si la pregunta no tiene valores numéricos que dibujar. */
  | { fase: "lista"; variable: string; num: ExploradorDistNum | null; respondieron: number | null; total: number | null };

export function useDistribucion(variable: string | null, baseNombre: string | null, activa: boolean): LecturaDeDistribucion {
  const [lectura, setLectura] = useState<LecturaDeDistribucion>({ fase: "inactiva" });
  useEffect(() => {
    if (!variable || !activa) {
      setLectura({ fase: "inactiva" });
      return undefined;
    }
    let vigente = true;
    setLectura({ fase: "cargando" });
    apiV2ExplorarUnivariado(variable, baseNombre).then(
      (r) => {
        if (!vigente) return;
        setLectura({
          fase: "lista",
          variable,
          num: r.dist?.num ?? null,
          respondieron: r.dist ? r.dist.base_n : null,
          total: Number.isFinite(r.n_total) ? r.n_total : null,
        });
      },
      (e) => { if (vigente) setLectura({ fase: "error", mensaje: (e as Error).message }); },
    );
    return () => { vigente = false; };
  }, [activa, baseNombre, variable]);
  // La lectura de otra pregunta (el hallazgo anterior) no se muestra mientras llega la nueva.
  if (lectura.fase === "lista" && lectura.variable !== variable) return { fase: "cargando" };
  return lectura;
}
