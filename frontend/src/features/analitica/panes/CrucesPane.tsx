import { useCallback, useEffect, useMemo } from "react";
import {
  apiAnaliticaCruces,
  apiAnaliticaVariables,
  type VariableInstrumento,
} from "../../../api/analitica";
import { apiEstudioGet } from "../../../api/estudio";
import { useFoco } from "../../../lib/navegacion/useFoco";
import { useSession } from "../../../lib/SessionContext";
import { AjustesDeCruces } from "../cruces/AjustesDeCruces";
import { BandaDeCruces } from "../cruces/BandaDeCruces";
import { etiquetasDeCategorias, motivoSinGenerarCruces } from "../cruces/crucesModelo";
import { useVistaPreviaDeCruces } from "../cruces/useVistaPreviaDeCruces";
import { VistaPreviaDeCruces } from "../cruces/VistaPreviaDeCruces";
import { resumenSecciones } from "../estructuraDeSecciones";
import { claveDeLaBase } from "../ponderacion/useBaseDelCalculo";
import { useAnaliticaStore } from "../store";
import { MarcoDeTablas } from "../tablas/MarcoDeTablas";
import { PieDeArchivo } from "../tablas/PieDeArchivo";
import { useLecturaPorBase } from "../tablas/useLecturaPorBase";
import { useReporteRun } from "../useReporteRun";
import { ALFA_CRUCES } from "./crucesSignificancia";

// CrucesPane: el archivo de cruces. A la izquierda, las tablas cruzadas tal
// como las escribe el archivo, calculadas por el motor con la config guardada
// (`POST /api/analitica/cruces/preview`); a la derecha, lo que se decide sobre
// ellas; debajo, el archivo. Las secciones y las exclusiones de variables se
// deciden en Datos.
//
// La config se guarda con el autosave de Analítica (`analitica_config`) y el
// motor la lee al generar: el pedido del archivo va con el cuerpo vacío.

const SIN_VARIABLES: VariableInstrumento[] = [];
const leerVariables = async () => (await apiAnaliticaVariables()).variables;
const leerEstudio = () => apiEstudioGet();

export function CrucesPane() {
  const cruces = useAnaliticaStore((s) => s.config.cruces);
  const secciones = useAnaliticaStore((s) => s.config.secciones);
  const frec = useAnaliticaStore((s) => s.config.frecuencias);
  const numericasGlobal = useAnaliticaStore((s) => s.config.numericas);
  const excluidas = useAnaliticaStore((s) => s.config.variables_excluidas);
  const setCruces = useAnaliticaStore((s) => s.setCruces);
  const addCruceVar = useAnaliticaStore((s) => s.addCruceVar);
  const removeCruceVar = useAnaliticaStore((s) => s.removeCruceVar);
  const setCruceVarExcluidas = useAnaliticaStore((s) => s.setCruceVarExcluidas);
  const run = useReporteRun("Cruces", { articulo: "los", formato: "xlsx" });
  const [elegida, elegir] = useFoco();
  const sesion = useSession().state;
  const dimensionesListas = Boolean(sesion?.analitica_dim_ok);

  // Modo "dimensiones" guardado sin dimensiones generadas: vuelve a "estandar"
  // para que el archivo no falle (comportamiento de siempre).
  useEffect(() => {
    if (cruces.modo === "dimensiones" && !dimensionesListas) setCruces({ modo: "estandar" });
  }, [cruces.modo, dimensionesListas, setCruces]);

  // Las tablas: las del motor, releídas cuando cambia lo que cambia el archivo.
  const vista = useVistaPreviaDeCruces(elegida);
  // Las variables del formulario: para elegir variables de cruce y bases por pregunta.
  const variables = useLecturaPorBase(leerVariables, claveDeLaBase(sesion?.active_base, sesion?.analitica_fuente, 0));
  const lista = variables.datos ?? SIN_VARIABLES;
  const numericas = frec.numericas_override ?? numericasGlobal;
  const cruzables = useMemo(() => lista.filter((v) => Boolean(v.categorica)), [lista]);
  const conTabla = useMemo(
    () => lista.filter((v) => !excluidas.includes(v.name) && (Boolean(v.categorica) || numericas.includes(v.name))),
    [lista, excluidas, numericas],
  );
  const etiquetas = useMemo(() => new Map(lista.map((v) => [v.name, v.label?.trim() || v.name])), [lista]);
  const etiquetaDe = useCallback((variable: string) => etiquetas.get(variable) ?? variable, [etiquetas]);
  const resumen = useMemo(() => resumenSecciones(secciones), [secciones]);
  const categorias = useMemo(() => etiquetasDeCategorias(vista.hoja.datos), [vista.hoja.datos]);
  // Con varias bases el pie nombra la de la vista previa: por su etiqueta, como el selector de bases.
  const nBases = vista.hoja.datos?.base.n_bases ?? 1;
  const estudio = useLecturaPorBase(leerEstudio, nBases > 1 ? claveDeLaBase(sesion?.active_base, sesion?.analitica_fuente, 0) : null);
  const etiquetaDeBase = useCallback((base: string) => {
    const b = estudio.datos?.bases?.[base];
    return b?.source_alias?.trim() || b?.source_title?.trim() || base;
  }, [estudio.datos]);

  // Lo de siempre al generar: alfa 0.05 y fila Total; el motor lee el resto de la config guardada.
  const generar = () => {
    const ajuste: Partial<typeof cruces> = {};
    if (cruces.alpha !== ALFA_CRUCES) ajuste.alpha = ALFA_CRUCES;
    if (!cruces.incluir_total) ajuste.incluir_total = true;
    if (Object.keys(ajuste).length > 0) setCruces(ajuste);
    void run.runAsync(() => apiAnaliticaCruces());
  };

  return (
    <MarcoDeTablas
      pestana="cruces"
      banda={(
        <BandaDeCruces
          vistaPrevia={vista.hoja}
          resumen={resumen}
          seccionesDeclaradas={secciones.length}
          excluidas={excluidas.length}
        />
      )}
      tabla={(
        <VistaPreviaDeCruces
          vista={vista}
          candidatas={conTabla}
          cruzables={cruzables}
          resumen={resumen}
          etiquetaDe={etiquetaDe}
          etiquetaDeBase={etiquetaDeBase}
          elegida={elegida}
          onElegir={elegir}
          onAgregarCruce={addCruceVar}
        />
      )}
      ajustes={(
        <AjustesDeCruces
          cruces={cruces}
          cruzables={cruzables}
          etiquetasDeCategorias={categorias}
          conTabla={conTabla}
          dimensionesListas={dimensionesListas}
          regla={vista.hoja.datos?.significancia_regla ?? null}
          ponderado={vista.hoja.datos?.ponderado ?? false}
          leyendo={vista.hoja.datos === null && vista.hoja.fase !== "error"}
          onCambio={setCruces}
          onAgregar={addCruceVar}
          onQuitar={removeCruceVar}
          onExcluidas={setCruceVarExcluidas}
        />
      )}
      archivo={(
        <PieDeArchivo
          rotulo="Generar cruces"
          run={run}
          onGenerar={generar}
          bloqueo={motivoSinGenerarCruces(vista.hoja, cruces.cruces_vars.length, vista)}
        />
      )}
    />
  );
}
