import { useMemo, type ReactNode } from "react";
import { MesaDePestana, PilaDeMesa } from "../../../components/procesamiento/MesaDePestana";
import { useSession } from "../../../lib/SessionContext";
import { CabeceraDePonderacion } from "../ponderacion/CabeceraDePonderacion";
import { lecturaDelEfecto, ultimoResultado } from "../ponderacion/calculoDePonderacion";
import { GuiaDeCriterios } from "../ponderacion/GuiaDeCriterios";
import { PanelMuestraPoblacion } from "../ponderacion/PanelMuestraPoblacion";
import { pasosDePonderacion } from "../ponderacion/pasosDelRecorrido";
import { PasosDePonderacion } from "../ponderacion/PasosDePonderacion";
import { useBaseDelCalculo } from "../ponderacion/useBaseDelCalculo";
import { usePreviewDePonderacion } from "../ponderacion/usePreviewDePonderacion";
import { useAnaliticaStore } from "../store";
import { PonderacionAjustes } from "./PonderacionAjustes";
import { PonderacionEfecto } from "./PonderacionEfecto";
import { useVariablesDeLaBase, variablesDeLectura } from "./variablesDeLaBase";
import "./PonderacionPane.css";
import "../ponderacion/ponderacion.css";

// PonderacionPane: pondera frecuencias, cruces y dimensiones para que
// representen a la población. Con la forma del prototipo (Analítica ›
// Ponderación): la cabecera de la pestaña con su estado, sus cifras y el
// interruptor; el recorrido por pasos; y una mesa de dos columnas que llegan al
// pie: a la izquierda "Muestra frente a población" (las metas), a la derecha
// "Efecto de ponderar" y "Ajustes". La config se guarda con el autosave de
// Analítica (`analitica_config.ponderacion`) y el motor recalcula el peso; aquí
// solo se previsualiza.

export function PonderacionPane({ datos }: {
  /** De qué datos sale el cálculo y la plantilla de Analítica, que la página pone en los ajustes. */
  datos?: ReactNode;
} = {}) {
  const pond = useAnaliticaStore((s) => s.config.ponderacion);
  const setPonderacion = useAnaliticaStore((s) => s.setPonderacion);
  const setDesign = useAnaliticaStore((s) => s.setPonderDesign);
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
  const lectura = lecturaDelEfecto(calculo);

  return (
    <MesaDePestana
      grupo="analitica/ponderacion"
      columnas={2}
      cabecera={(
        <CabeceraDePonderacion
          pond={pond}
          lectura={lectura}
          preview={preview}
          onAlternar={() => setPonderacion({ enabled: !pond.enabled })}
        />
      )}
      franja={<PasosDePonderacion pasos={pasosDePonderacion(pond, lectura)} />}
    >
      <PanelMuestraPoblacion
        variables={variables}
        comparacion={preview?.ok ? preview.margins : undefined}
        recalculando={calculo.fase === "calculando" && preview !== null}
      />
      <PilaDeMesa grupo="analitica/ponderacion-lateral">
        {pond.enabled ? (
          <PonderacionEfecto lectura={lectura} etiquetaDe={etiquetaDe} onReintentar={reintentar} />
        ) : (
          <GuiaDeCriterios />
        )}
        <PonderacionAjustes
          pond={pond}
          lecturaVariables={lecturaVariables}
          variables={variables}
          baseActiva={baseActiva}
          datos={datos}
          onPonderacion={setPonderacion}
          onDesign={setDesign}
          onEscala={(escala) => setPonderacion({ escala })}
          onTotal={(total_poblacion) => setPonderacion({ total_poblacion })}
          onRake={setRake}
          onTrim={setTrim}
        />
      </PilaDeMesa>
    </MesaDePestana>
  );
}
