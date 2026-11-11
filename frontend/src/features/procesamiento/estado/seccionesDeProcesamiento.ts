// Estado de las cinco secciones de Procesamiento, tal como lo pinta la banda del
// módulo. Vivía dentro de `app/Layout.tsx` (`useNavItems`); se extrajo sin cambiar
// una regla para que "Estado del estudio" lea lo mismo que la banda y no una copia.
//
// OJO con el alcance de cada indicador: salen del estado de la SESIÓN, y con
// varias bases casi ninguno es de la base activa. `xlsform` y `data` valen con
// cualquier archivo cargado; `auditoria_run`, con que una base tenga auditoría;
// `codif_aplicado`, sólo si TODAS las bases están adaptadas; Gráficos, sólo si
// ninguna base quedó sin informe (`coberturaGraficos`). Por eso describen el
// estudio y no se atribuyen a una base. El estado por base lo entrega
// `EstudioBase.status` y lo lee `basesDelEstudioModel.ts`.

import type { SessionState } from "../../../api/core";
import { coberturaGraficos } from "../../graficos/coberturaBases";

export type SeccionDeProcesamiento = {
  to: string;
  n: number;
  label: string;
  done?: boolean;
  blockedReason?: string;
  /** Lo que le falta a una sección alcanzable. NO pinta `is-blocked`: una
      etapa incompleta se puede abrir; una bloqueada, no. */
  faltaReason?: string;
};

export function seccionesDeProcesamiento(
  state: SessionState | null | undefined,
): SeccionDeProcesamiento[] {
  const hasXlsform = !!state?.xlsform;
  const hasData = !!state?.data;
  const hasAnalitica = !!state?.analitica_prep_ok;

  return [
    { to: "/carga", n: 1, label: "Carga", done: hasXlsform && hasData },
    {
      to: "/validacion",
      n: 2,
      label: "Validación",
      done: !!state?.auditoria_run,
      blockedReason: hasXlsform ? undefined : "Bloqueada: carga un XLSForm en Carga.",
    },
    {
      to: "/codificacion",
      n: 3,
      label: "Codificación",
      done: !!state?.codif_aplicado,
      blockedReason: hasXlsform && hasData ? undefined : "Bloqueada: completa carga y consolidación.",
    },
    {
      to: "/analitica",
      n: 4,
      label: "Analítica",
      done: hasAnalitica,
      blockedReason: hasXlsform && hasData ? undefined : "Bloqueada: completa carga y consolidación.",
    },
    {
      to: "/graficos",
      n: 5,
      label: "Gráficos",
      done: coberturaGraficos(state).hecho,
      blockedReason: hasAnalitica ? undefined : "Bloqueada: prepara Analítica.",
      faltaReason: hasAnalitica ? coberturaGraficos(state).motivo ?? undefined : undefined,
    },
  ];
}
