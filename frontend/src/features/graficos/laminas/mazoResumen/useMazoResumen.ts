// Lo que el mazo «Resumen ejecutivo» lee del estudio y del registro, y el paso único que inserta sus láminas. La lógica
// vive en modeloMazo.ts; aquí sólo se juntan las fuentes (variables, registro, propuesta de padrón y estado UI).

import { useCallback, useMemo } from "react";
import type { Slide, SlideType } from "../../../../api/graficos";
import { nuevoIdLamina, SLIDE_GRAF_SLOTS, usePlanStore } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { useVariables } from "../../useVariables";
import { propuestasDe, usePadronPropuesto } from "../gruposPadron/usePadronPropuesto";
import type { EstudioDelSelector } from "../selectores/opcionesLamina";
import { useMazoResumenUi } from "./mazoResumenStore";
import {
  escalaDominante, escalasPorPublico, indicadoresDelEstudio, insertarTras, laminasDelMazo, ordenPublicos, proponerMazo,
  type IndicadorMazo, type PropuestaMazo,
} from "./modeloMazo";

const TIPOS_INSERTABLES: ReadonlySet<SlideType> = new Set(Object.keys(SLIDE_GRAF_SLOTS) as SlideType[]);

export type MazoResumen = {
  cargando: boolean;
  error: string;
  scope: "active" | "consolidated";
  /** Todas las bases del estudio en el orden elegido, y las que entran en ese orden. */
  bases: string[];
  publicos: string[];
  /** Preguntas de escala por público (estimación del editor). */
  escalas: Record<string, number>;
  indicadores: IndicadorMazo[];
  indicador: IndicadorMazo | null;
  propuestas: PropuestaMazo[];
  quitadas: ReadonlySet<string>;
  incluidas: PropuestaMazo[];
  /** Inserta las incluidas detrás de la lámina `posicion` en un solo paso de deshacer; devuelve las nuevas. */
  insertar: (posicion: number | null) => Slide[];
};

export function useMazoResumen(activo: boolean): MazoResumen {
  const { sources, baseActiva, scope, loading, error } = useVariables();
  const { registry, graficadoresById, slidesById, error: errorRegistro } = useGraficosRegistry();
  const ui = useMazoResumenUi();
  const bases = sources.map((s) => s.name);
  const nombresBases = bases.join("|");
  const conCobertura = !!registry && "p_cobertura" in graficadoresById;
  const padron = propuestasDe(usePadronPropuesto(scope, activo && conCobertura && nombresBases !== ""));
  // Las bases en el orden elegido en la franja; las que entran, en ese orden.
  const ordenadas = ordenPublicos(ui.orden, bases);
  const publicos = ui.publicos ? ordenadas.filter((b) => ui.publicos?.includes(b)) : ordenadas;
  const escalas = escalasPorPublico(sources, publicos);
  const indicadores = indicadoresDelEstudio(escalaDominante(sources, publicos));
  const indicador = indicadores.find((i) => i.id === ui.indicador) ?? indicadores[0] ?? null;

  const graficadores = useMemo(() => new Set(Object.keys(graficadoresById)), [graficadoresById]);
  const laminas = useMemo(() => new Set(Object.keys(slidesById)), [slidesById]);
  const admiteArg = useCallback((graficador: string, arg: string, valor?: string): boolean => {
    const a = graficadoresById[graficador]?.args.find((x) => x.name === arg);
    if (!a) return false;
    return valor === undefined || !a.choices?.length || a.choices.some((c) => c.value === valor);
  }, [graficadoresById]);
  const estudio = useMemo<EstudioDelSelector>(
    () => ({ bases: nombresBases ? nombresBases.split("|") : [], baseActiva, padron }), [nombresBases, baseActiva, padron]);

  const propuestas = registry
    ? proponerMazo({
      estudio, publicos, graficadores, laminas, tiposInsertables: TIPOS_INSERTABLES, admiteArg, indicador,
      referencia: ui.referencia, reglas: ui.reglas,
    })
    : [];
  const quitadas = new Set(Object.keys(ui.quitadas));
  const incluidas = propuestas.filter((p) => !quitadas.has(p.id));

  const insertar = (posicion: number | null): Slide[] => {
    const nuevas = laminasDelMazo(propuestas, quitadas, nuevoIdLamina);
    if (!nuevas.length) return [];
    const plan = usePlanStore.getState();
    plan.transformarLaminas((slides) => insertarTras(slides, nuevas, posicion));
    plan.select(nuevas[0].id);
    return nuevas;
  };

  return {
    // Sin registro y con su error, ya no se espera: el diálogo lo dice (la lectura siempre termina en uno de los dos).
    cargando: loading || (!registry && !errorRegistro),
    error: error || (!registry ? errorRegistro : ""),
    scope,
    bases: ordenadas,
    publicos,
    escalas,
    indicadores,
    indicador,
    propuestas,
    quitadas,
    incluidas,
    insertar,
  };
}
