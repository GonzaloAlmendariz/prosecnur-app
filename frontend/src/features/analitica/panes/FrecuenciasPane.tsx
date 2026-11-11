import { useCallback, useId, useMemo, type ReactNode } from "react";
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
import { BotonGenerar } from "../tablas/BotonGenerar";
import { CabeceraDeTablas, encabezadoDelCatalogo, type EncabezadoDePestana } from "../tablas/CabeceraDeTablas";
import { causaSinTablas, cifrasDeCabeceraDeFrecuencias, motivoSinGenerar } from "../tablas/cifrasDeFrecuencias";
import { IrAPregunta } from "../tablas/IrAPregunta";
import { ListaDePreguntas } from "../tablas/ListaDePreguntas";
import { MarcoDeTablas } from "../tablas/MarcoDeTablas";
import { PanelDeArchivo } from "../tablas/PanelDeArchivo";
import { hayPreguntasFuera, PieDePreguntas } from "../tablas/PieDePreguntas";
import { gruposDePreguntas, preguntaQueSeVe } from "../tablas/preguntasModelo";
import { useEtiquetaDeBase } from "../tablas/useEtiquetaDeBase";
import { useLecturaPorBase } from "../tablas/useLecturaPorBase";
import { useVistaPreviaDeFrecuencias } from "../tablas/useVistaPreviaDeFrecuencias";
import { VistaPreviaDeFrecuencias } from "../tablas/VistaPreviaDeFrecuencias";
import { codigoDeLaTabla } from "../tablas/vistaPreviaModelo";
import { useReporteRun } from "../useReporteRun";

// FrecuenciasPane: el archivo de frecuencias, en tres columnas como el
// prototipo. A la izquierda las preguntas del archivo; al centro la tabla de la
// elegida tal como la escribe el archivo, calculada por el motor con la config
// guardada (`POST /api/analitica/frecuencias/preview`); a la derecha lo que se
// decide sobre el archivo y el archivo mismo. La pregunta elegida va en la
// dirección (`foco`); sin ella se ve la primera.
//
// La config se guarda con el autosave de Analítica (`analitica_config`) y el
// motor la lee al generar: esta pestaña no envía nada más que el pedido.

const SIN_VARIABLES: VariableInstrumento[] = [];
const leerVariables = async () => (await apiAnaliticaVariables()).variables;

export function FrecuenciasPane({ encabezado = encabezadoDelCatalogo("frecuencias"), datos }: {
  /** El título, el ícono y el lugar de la pestaña; sin él, los del catálogo. */
  encabezado?: EncabezadoDePestana;
  /** De qué datos sale el archivo y la plantilla de Analítica, que la página pone en los ajustes. */
  datos?: ReactNode;
}) {
  const frec = useAnaliticaStore((s) => s.config.frecuencias);
  const secciones = useAnaliticaStore((s) => s.config.secciones);
  const numericasGlobal = useAnaliticaStore((s) => s.config.numericas);
  const excluidas = useAnaliticaStore((s) => s.config.variables_excluidas);
  const setFrec = useAnaliticaStore((s) => s.setFrecuencias);
  const run = useReporteRun("Frecuencias", { articulo: "las", formato: "xlsx" });
  const [foco, elegir] = useFoco();
  const idDelMotivo = useId();

  // Las tablas: las del motor, releídas cuando cambia lo que cambia el archivo.
  const vista = useVistaPreviaDeFrecuencias(foco);
  // Las variables del formulario: para elegir numéricas, bases por pregunta y las preguntas que la hoja no trae.
  const sesion = useSession().state;
  const variables = useLecturaPorBase(leerVariables, claveDeLaBase(sesion?.active_base, sesion?.analitica_fuente, 0));
  const lista = variables.datos ?? SIN_VARIABLES;

  // Numéricas: solo entran al análisis si se declaran aquí o vienen en la
  // definición global. No hay detección automática.
  const numericas = frec.numericas_override ?? numericasGlobal;
  // Las que pueden llevar una base propia en las notas, o pedirse aparte.
  const conTabla = useMemo(
    () => lista.filter((v) => !excluidas.includes(v.name) && (Boolean(v.categorica) || numericas.includes(v.name))),
    [lista, excluidas, numericas],
  );
  const etiquetas = useMemo(() => new Map(lista.map((v) => [v.name, v.label?.trim() || v.name])), [lista]);
  const etiquetaDe = useCallback((variable: string) => etiquetas.get(variable) ?? variable, [etiquetas]);

  // Sin secciones declaradas no son "0 activas": el motor agrupa por la
  // estructura del formulario.
  const resumen = useMemo(() => resumenSecciones(secciones), [secciones]);
  const causaDelVacio = useCallback((preview: FrecuenciasPreview) => causaSinTablas(resumen, preview), [resumen]);

  const preview = vista.hoja.fase === "error" ? null : vista.hoja.datos;
  const grupos = useMemo(
    () => (preview ? gruposDePreguntas(preview.tablas, codigoDeLaTabla, conTabla, preview.recortado) : []),
    [preview, conTabla],
  );
  const elegida = preguntaQueSeVe(foco, grupos);
  const soltarFoco = useCallback(() => elegir(null), [elegir]);
  const bloqueo = motivoSinGenerar(vista.hoja, resumen, vista);
  // Con varias bases, el archivo trae uno por base: cada uno se nombra por la etiqueta de su base.
  const etiquetaDeBase = useEtiquetaDeBase(Math.max(vista.hoja.datos?.base.n_bases ?? 1, sesion?.n_bases ?? 1));

  return (
    <MarcoDeTablas
      pestana="frecuencias"
      cabecera={(
        <CabeceraDeTablas
          encabezado={encabezado}
          cifras={cifrasDeCabeceraDeFrecuencias(vista.hoja, numericas.length)}
          ariaCifras="Cifras del archivo de frecuencias"
          accion={(
            <BotonGenerar
              generando={run.busy}
              bloqueo={bloqueo}
              idDelMotivo={idDelMotivo}
              onGenerar={() => { void run.runSync(() => apiAnaliticaFrecuencias()); }}
            />
          )}
        />
      )}
      preguntas={(
        <ListaDePreguntas
          pestana="frecuencias"
          grupos={grupos}
          elegida={elegida}
          // Con la hoja recortada, la lista se completa con el formulario: no se publica a medias.
          leyendo={(vista.hoja.fase !== "error" && vista.hoja.datos === null)
            || (Boolean(preview?.recortado) && variables.datos === null && variables.fase !== "error")}
          sinLeer={vista.hoja.fase === "error"}
          onElegir={elegir}
          pie={hayPreguntasFuera(resumen, secciones.length, excluidas.length)
            ? <PieDePreguntas resumen={resumen} seccionesDeclaradas={secciones.length} excluidas={excluidas.length} />
            : undefined}
        />
      )}
      tabla={(
        <VistaPreviaDeFrecuencias
          vista={vista}
          elegida={elegida}
          etiquetaDe={etiquetaDe}
          causaDelVacio={causaDelVacio}
          onSoltarFoco={soltarFoco}
          etiquetaDeBase={etiquetaDeBase}
          selector={grupos.length > 0 ? (
            <IrAPregunta preguntas={grupos.flatMap((g) => g.preguntas)} elegida={elegida} onElegir={(v) => elegir(v || null)} />
          ) : undefined}
        />
      )}
      ajustes={(
        <AjustesDeFrecuencias
          frecuencias={frec}
          numericas={numericas}
          variables={lista}
          conTabla={conTabla}
          datos={datos}
          onCambio={setFrec}
        />
      )}
      archivo={<PanelDeArchivo nombre="Frecuencias" run={run} bloqueo={bloqueo} idDelMotivo={idDelMotivo} etiquetaDeBase={etiquetaDeBase} />}
    />
  );
}
