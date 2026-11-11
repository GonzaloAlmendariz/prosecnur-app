import { useCallback, useMemo } from "react";
import {
  apiAnaliticaFrecuencias,
  apiAnaliticaVariables,
  type FrecuenciasPreview,
  type VariableInstrumento,
} from "../../../api/analitica";
import { useFoco } from "../../../lib/navegacion/useFoco";
import { useSession } from "../../../lib/SessionContext";
import { resumenSecciones } from "../estructuraDeSecciones";
import { claveDeLaBase } from "../ponderacion/useBaseDelCalculo";
import { useAnaliticaStore } from "../store";
import { AjustesDeFrecuencias } from "../tablas/AjustesDeFrecuencias";
import { BandaDeFrecuencias } from "../tablas/BandaDeFrecuencias";
import { causaSinTablas, motivoSinGenerar } from "../tablas/cifrasDeFrecuencias";
import { MarcoDeTablas } from "../tablas/MarcoDeTablas";
import { PieDeArchivo } from "../tablas/PieDeArchivo";
import { useLecturaPorBase } from "../tablas/useLecturaPorBase";
import { useVistaPreviaDeFrecuencias } from "../tablas/useVistaPreviaDeFrecuencias";
import { VistaPreviaDeFrecuencias } from "../tablas/VistaPreviaDeFrecuencias";
import { useReporteRun } from "../useReporteRun";

// FrecuenciasPane: el archivo de frecuencias. A la izquierda, las tablas tal
// como las escribe el archivo, calculadas por el motor con la config guardada
// (`POST /api/analitica/frecuencias/preview`); a la derecha, lo que se decide
// sobre ellas; debajo, el archivo. Las secciones y las exclusiones se deciden
// en Datos.
//
// La config se guarda con el autosave de Analítica (`analitica_config`) y el
// motor la lee al generar: esta pestaña no envía nada más que el pedido.

const SIN_VARIABLES: VariableInstrumento[] = [];
const leerVariables = async () => (await apiAnaliticaVariables()).variables;

export function FrecuenciasPane() {
  const frec = useAnaliticaStore((s) => s.config.frecuencias);
  const secciones = useAnaliticaStore((s) => s.config.secciones);
  const numericasGlobal = useAnaliticaStore((s) => s.config.numericas);
  const excluidas = useAnaliticaStore((s) => s.config.variables_excluidas);
  const setFrec = useAnaliticaStore((s) => s.setFrecuencias);
  const run = useReporteRun("Frecuencias", { articulo: "las", formato: "xlsx" });
  const [elegida, elegir] = useFoco();

  // Las tablas: las del motor, releídas cuando cambia lo que cambia el archivo.
  const vista = useVistaPreviaDeFrecuencias(elegida);
  // Las variables del formulario: para elegir numéricas y bases por pregunta.
  const sesion = useSession().state;
  const variables = useLecturaPorBase(leerVariables, claveDeLaBase(sesion?.active_base, sesion?.analitica_fuente, 0));
  const lista = variables.datos ?? SIN_VARIABLES;

  // Numéricas: solo entran al análisis si se declaran aquí o vienen en la
  // definición global. No hay detección automática.
  const numericas = frec.numericas_override ?? numericasGlobal;
  // Las que pueden llevar una base propia en las notas, o pedirse aparte en la vista previa.
  const conTabla = useMemo(
    () => lista.filter((v) => !excluidas.includes(v.name) && (Boolean(v.categorica) || numericas.includes(v.name))),
    [lista, excluidas, numericas],
  );

  // Sin secciones declaradas no son "0 activas": el motor agrupa por la
  // estructura del formulario.
  const resumen = useMemo(() => resumenSecciones(secciones), [secciones]);
  const causaDelVacio = useCallback((preview: FrecuenciasPreview) => causaSinTablas(resumen, preview), [resumen]);

  return (
    <MarcoDeTablas
      pestana="frecuencias"
      banda={(
        <BandaDeFrecuencias
          vistaPrevia={vista.hoja}
          resumen={resumen}
          seccionesDeclaradas={secciones.length}
          excluidas={excluidas.length}
        />
      )}
      tabla={(
        <VistaPreviaDeFrecuencias
          vista={vista}
          candidatas={conTabla}
          causaDelVacio={causaDelVacio}
          elegida={elegida}
          onElegir={elegir}
        />
      )}
      ajustes={(
        <AjustesDeFrecuencias
          frecuencias={frec}
          numericas={numericas}
          variables={lista}
          conTabla={conTabla}
          onCambio={setFrec}
        />
      )}
      archivo={(
        <PieDeArchivo
          rotulo="Generar frecuencias"
          run={run}
          onGenerar={() => { void run.runSync(() => apiAnaliticaFrecuencias()); }}
          bloqueo={motivoSinGenerar(vista.hoja, resumen, vista)}
        />
      )}
    />
  );
}
