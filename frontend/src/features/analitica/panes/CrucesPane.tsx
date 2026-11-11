import { useCallback, useEffect, useId, useMemo, type ReactNode } from "react";
import {
  apiAnaliticaCruces,
  apiAnaliticaVariables,
  type VariableInstrumento,
} from "../../../api/analitica";
import { useFoco } from "../../../lib/navegacion/useFoco";
import { useSession } from "../../../lib/SessionContext";
import { AjustesDeCruces } from "../cruces/AjustesDeCruces";
import { cifrasDeCabeceraDeCruces, columnasPorVariable, etiquetasDeCategorias, motivoSinGenerarCruces, variablesDeCruce } from "../cruces/crucesModelo";
import { useVistaPreviaDeCruces } from "../cruces/useVistaPreviaDeCruces";
import { VistaPreviaDeCruces } from "../cruces/VistaPreviaDeCruces";
import { resumenSecciones } from "../estructuraDeSecciones";
import { claveDeLaBase } from "../ponderacion/useBaseDelCalculo";
import { useAnaliticaStore } from "../store";
import { BotonGenerar } from "../tablas/BotonGenerar";
import { CabeceraDeTablas, encabezadoDelCatalogo, type EncabezadoDePestana } from "../tablas/CabeceraDeTablas";
import { IrAPregunta } from "../tablas/IrAPregunta";
import { ListaDePreguntas } from "../tablas/ListaDePreguntas";
import { MarcoDeTablas } from "../tablas/MarcoDeTablas";
import { PanelDeArchivo } from "../tablas/PanelDeArchivo";
import { hayPreguntasFuera, PieDePreguntas } from "../tablas/PieDePreguntas";
import { gruposDePreguntas, preguntaQueSeVe } from "../tablas/preguntasModelo";
import { useEtiquetaDeBase } from "../tablas/useEtiquetaDeBase";
import { useLecturaPorBase } from "../tablas/useLecturaPorBase";
import { useReporteRun } from "../useReporteRun";
import { ALFA_CRUCES } from "./crucesSignificancia";

// CrucesPane: el archivo de cruces, en tres columnas como el prototipo. A la
// izquierda las preguntas del archivo; al centro la tabla cruzada de la
// elegida, con todas las variables de cruce lado a lado, tal como la escribe
// el archivo y calculada por el motor con la config guardada
// (`POST /api/analitica/cruces/preview`); a la derecha lo que se decide sobre
// el archivo y el archivo mismo. La pregunta elegida va en la dirección
// (`foco`); sin ella se ve la primera.
//
// La config se guarda con el autosave de Analítica (`analitica_config`) y el
// motor la lee al generar: el pedido del archivo va con el cuerpo vacío.

const SIN_VARIABLES: VariableInstrumento[] = [];
const leerVariables = async () => (await apiAnaliticaVariables()).variables;
const codigoDeCruce = (t: { variable: string }) => t.variable;

export function CrucesPane({ encabezado = encabezadoDelCatalogo("cruces"), datos }: {
  /** El título, el ícono y el lugar de la pestaña; sin él, los del catálogo. */
  encabezado?: EncabezadoDePestana;
  /** De qué datos sale el archivo y la plantilla de Analítica, que la página pone en los ajustes. */
  datos?: ReactNode;
}) {
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
  const [foco, elegir] = useFoco();
  const idDelMotivo = useId();
  const sesion = useSession().state;
  const dimensionesListas = Boolean(sesion?.analitica_dim_ok);

  // Modo "dimensiones" guardado sin dimensiones generadas: vuelve a "estandar"
  // para que el archivo no falle (comportamiento de siempre).
  useEffect(() => {
    if (cruces.modo === "dimensiones" && !dimensionesListas) setCruces({ modo: "estandar" });
  }, [cruces.modo, dimensionesListas, setCruces]);

  // Las tablas: las del motor, releídas cuando cambia lo que cambia el archivo.
  const vista = useVistaPreviaDeCruces(foco);
  // Las variables del formulario: para elegir variables de cruce, bases por pregunta y las preguntas que la hoja no trae.
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
  const columnas = useMemo(() => columnasPorVariable(vista.hoja.datos), [vista.hoja.datos]);
  const preguntasDeCruce = useMemo(
    () => new Map((vista.hoja.datos ? variablesDeCruce(vista.hoja.datos) : []).map((v) => [v.variable, v.etiqueta])),
    [vista.hoja.datos],
  );
  // Con varias bases el pie nombra la de la vista previa: por su etiqueta, como el selector de bases.
  const nBases = vista.hoja.datos?.base.n_bases ?? 1;
  const etiquetaDeBase = useEtiquetaDeBase(Math.max(nBases, sesion?.n_bases ?? 1));

  const preview = vista.hoja.fase === "error" ? null : vista.hoja.datos;
  const grupos = useMemo(
    () => (preview ? gruposDePreguntas(preview.tablas, codigoDeCruce, conTabla, preview.recortado) : []),
    [preview, conTabla],
  );
  const elegida = preguntaQueSeVe(foco, grupos);
  const soltarFoco = useCallback(() => elegir(null), [elegir]);
  const bloqueo = motivoSinGenerarCruces(vista.hoja, cruces.cruces_vars.length, vista);

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
      cabecera={(
        <CabeceraDeTablas
          encabezado={encabezado}
          cifras={cifrasDeCabeceraDeCruces(vista.hoja)}
          ariaCifras="Cifras del archivo de cruces"
          accion={<BotonGenerar generando={run.busy} bloqueo={bloqueo} idDelMotivo={idDelMotivo} onGenerar={generar} />}
        />
      )}
      preguntas={(
        <ListaDePreguntas
          pestana="cruces"
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
        <VistaPreviaDeCruces
          vista={vista}
          elegida={elegida}
          cruzables={cruzables}
          resumen={resumen}
          etiquetaDe={etiquetaDe}
          etiquetaDeBase={etiquetaDeBase}
          onSoltarFoco={soltarFoco}
          selector={grupos.length > 0 ? (
            <IrAPregunta preguntas={grupos.flatMap((g) => g.preguntas)} elegida={elegida} onElegir={(v) => elegir(v || null)} />
          ) : undefined}
          onAgregarCruce={addCruceVar}
        />
      )}
      ajustes={(
        <AjustesDeCruces
          cruces={cruces}
          cruzables={cruzables}
          columnas={columnas}
          preguntasDeCruce={preguntasDeCruce}
          etiquetasDeCategorias={categorias}
          conTabla={conTabla}
          regla={vista.hoja.datos?.significancia_regla ?? null}
          ponderado={vista.hoja.datos?.ponderado ?? false}
          leyendo={vista.hoja.datos === null && vista.hoja.fase !== "error"}
          datos={datos}
          onCambio={setCruces}
          onAgregar={addCruceVar}
          onQuitar={removeCruceVar}
          onExcluidas={setCruceVarExcluidas}
        />
      )}
      archivo={<PanelDeArchivo nombre="Cruces" run={run} bloqueo={bloqueo} idDelMotivo={idDelMotivo} etiquetaDeBase={etiquetaDeBase} />}
    />
  );
}
