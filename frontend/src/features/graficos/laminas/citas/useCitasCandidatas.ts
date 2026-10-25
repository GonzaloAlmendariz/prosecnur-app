// Candidatas de la tarjeta de citas (GET /api/graficos/citas-candidatas). Se piden al cambiar pregunta, filtro o
// identificador de persona; la respuesta vieja de una consulta anterior no pisa la nueva.

import { useEffect, useState } from "react";
import { ApiError } from "../../../../api/core";
import { apiGraficosCitasCandidatas, type CitasCandidatas } from "../../../../api/graficosCitas";

export type EstadoCitas =
  | { fase: "sin_pregunta" }
  | { fase: "cargando" }
  | { fase: "lista"; datos: CitasCandidatas }
  | { fase: "error"; mensaje: string };

export function useCitasCandidatas(variable: string, filtros: unknown, varPersona: string): EstadoCitas {
  const claveFiltros = JSON.stringify(filtros ?? null);
  const [estado, setEstado] = useState<EstadoCitas>(variable ? { fase: "cargando" } : { fase: "sin_pregunta" });
  useEffect(() => {
    if (!variable) { setEstado({ fase: "sin_pregunta" }); return; }
    let vivo = true;
    setEstado({ fase: "cargando" });
    apiGraficosCitasCandidatas({ variable, filtros: JSON.parse(claveFiltros) as unknown, varPersona })
      .then((datos) => { if (vivo) setEstado({ fase: "lista", datos }); })
      .catch((e: unknown) => {
        if (!vivo) return;
        const mensaje = e instanceof ApiError ? e.message.replace(/ · [A-Z0-9_]+$/, "") : e instanceof Error ? e.message : "No se pudieron leer los comentarios.";
        setEstado({ fase: "error", mensaje });
      });
    return () => { vivo = false; };
  }, [variable, claveFiltros, varPersona]);
  return estado;
}
