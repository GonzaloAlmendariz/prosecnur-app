import { useMemo } from "react";
import { useSession } from "../../../lib/SessionContext";
import { BandaPonderacion } from "../ponderacion/BandaPonderacion";
import { lecturaDelEfecto, ultimoResultado } from "../ponderacion/calculoDePonderacion";
import { GuiaDeCriterios } from "../ponderacion/GuiaDeCriterios";
import { PanelMuestraPoblacion } from "../ponderacion/PanelMuestraPoblacion";
import { useBaseDelCalculo } from "../ponderacion/useBaseDelCalculo";
import { usePreviewDePonderacion } from "../ponderacion/usePreviewDePonderacion";
import { useAnaliticaStore } from "../store";
import { PonderacionAjustes } from "./PonderacionAjustes";
import { PonderacionEfecto } from "./PonderacionEfecto";
import { useVariablesDeLaBase, variablesDeLectura } from "./variablesDeLaBase";
import "./PonderacionPane.css";
import "../ponderacion/ponderacion.css";

// PonderacionPane: pondera frecuencias, cruces y dimensiones para que
// representen a la población. Dos columnas a todo el alto: a la izquierda lo
// que se declara (origen del peso, población, peso base y variables de ajuste
// con sus metas) y a la derecha lo que resulta (efecto de ponderar) con los
// ajustes de la calibración. La config se guarda con el autosave de Analítica
// (`analitica_config.ponderacion`) y el motor recalcula el peso; aquí solo se
// previsualiza.

export function PonderacionPane() {
  const pond = useAnaliticaStore((s) => s.config.ponderacion);
  const setPonderacion = useAnaliticaStore((s) => s.setPonderacion);
  const setRake = useAnaliticaStore((s) => s.setPonderRake);
  const setTrim = useAnaliticaStore((s) => s.setPonderTrim);

  const porColumna = pond.modo === "columna";
  const baseActiva = useSession().state?.active_base ?? null;
  // F7: la lectura se repite al cambiar de base y distingue cargando de vacío.
  const lecturaVariables = useVariablesDeLaBase(baseActiva);
  const variables = useMemo(() => variablesDeLectura(lecturaVariables), [lecturaVariables]);
  const etiquetaDe = (nombre: string) => variables.find((v) => v.name === nombre)?.label || nombre;

  // El motor previsualiza la calibración: con el peso tomado de una columna no
  // hay nada que previsualizar y sus cifras serían de otro método. El cálculo
  // se repite también cuando cambia la base sobre la que se pondera (universo
  // de análisis, base activa o fuente) aunque la config siga igual.
  const base = useBaseDelCalculo();
  const { calculo, reintentar } = usePreviewDePonderacion(pond, pond.enabled && !porColumna, base);
  const preview = ultimoResultado(calculo);

  return (
    <div className="pond-superficie">
      <BandaPonderacion
        pond={pond}
        preview={preview}
        onAlternar={() => setPonderacion({ enabled: !pond.enabled })}
      />
      {/* C1: dos contenedores de ancho distinto que llegan al borde inferior;
          cada uno es dueño de su scroll y de su vacío. */}
      <div
        className="pond-mesa"
        data-qa-geometry-group="analitica/ponderacion-mesa"
        data-qa-geometry-contract="intrinsic"
      >
        <PanelMuestraPoblacion
          lecturaVariables={lecturaVariables}
          variables={variables}
          baseActiva={baseActiva}
          comparacion={preview?.ok ? preview.margins : undefined}
          recalculando={calculo.fase === "calculando" && preview !== null}
        />
        <div
          className="pond-lateral"
          data-qa-geometry-group="analitica/ponderacion-lateral"
          data-qa-geometry-contract="intrinsic"
        >
          {pond.enabled ? (
            <PonderacionEfecto lectura={lecturaDelEfecto(calculo)} etiquetaDe={etiquetaDe} onReintentar={reintentar} />
          ) : (
            <GuiaDeCriterios />
          )}
          {pond.enabled && !porColumna ? (
            <PonderacionAjustes
              pond={pond}
              onEscala={(escala) => setPonderacion({ escala })}
              onTotal={(total_poblacion) => setPonderacion({ total_poblacion })}
              onRake={setRake}
              onTrim={setTrim}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
