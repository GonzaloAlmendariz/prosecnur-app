import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { AlertTriangle, ArrowRight, FileUp, Inbox, Plus, Search, X } from "../../../../vendor/lucide-react";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { ErrorBlock, LoadingBlock } from "../../../../components/States";
import type { CifraDePestana } from "../../../../components/procesamiento/CifrasDePestana";
import { MesaDePestana, PilaDeMesa } from "../../../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { formatoConteo, formatoConteoDe } from "../../../../lib/formatoNumero";
import { AnexarColumnas } from "../../variablesBase/AnexarColumnas";
import type { ControlVariablesBase } from "../../variablesBase/useVariablesBase";
import {
  BORRADOR_COLUMNAS_VACIO,
  columnasADeclarar,
  hrefDeclararRetiradas,
  reducirColumnas,
} from "../../variablesBase/variablesBaseModel";
import { CabeceraDeMesaDeCarga } from "../revision/CabeceraDeMesaDeCarga";
import { SelectorDeBaseCarga } from "../SelectorDeBaseCarga";
import { CodificacionDeLaBase } from "./CodificacionDeLaBase";
import { InspectorDeVariable } from "./InspectorDeVariable";
import { TablaDeVariables } from "./TablaDeVariables";
import {
  HUECOS_DEL_MOTOR_VARIABLES,
  VISTA_INICIAL,
  cifrasDeVariables,
  filaElegida,
  filtrarGrupos,
  gruposDeVariables,
  pendientesVisibles,
  reducirVista,
  type AccionDeVista,
} from "./variablesModel";
import "../../ArmonizacionFilaEditor.css";
import "../../variablesBase/variablesBase.css";
import "../revision/marcoDeMesa.css";
import "./variables.css";

/**
 * Carga › Variables con la forma del prototipo "carga-variables": la cabecera
 * con lo que la base suma al formulario y sus acciones; a la izquierda la
 * tabla de variables que no vienen del formulario, agrupada; a la derecha la
 * elegida y la marca "ya viene codificada". Una sola composición para una y
 * varias bases: con varias, el selector de base va en la cabecera.
 */
export function MesaDeVariables({
  control,
  base,
  bases,
  etiquetas,
  onCambiarBase,
  cambiandoBase,
}: {
  control: ControlVariablesBase;
  /** La base que se muestra; `null` mientras el estudio no tiene respuestas. */
  base: string | null;
  bases: readonly string[];
  etiquetas?: Readonly<Record<string, string>>;
  onCambiarBase: (nombre: string) => void;
  cambiandoBase: boolean;
}) {
  const [vista, despacharVistaBase] = useReducer(reducirVista, VISTA_INICIAL);
  const raiz = useRef<HTMLDivElement>(null);
  // Cada pedido de llevar la columna derecha a la vista (abrir un editor, elegir una fila con el ratón).
  const [pedidoDeVista, setPedidoDeVista] = useState(0);
  const despacharVista = useCallback((a: AccionDeVista) => {
    despacharVistaBase(a);
    if (a.tipo === "modo" && a.modo.tipo !== "ver") setPedidoDeVista((n) => n + 1);
  }, []);

  // A lo angosto la mesa apila la tabla y la columna derecha: lo que se acaba de abrir queda bajo la
  // tabla, fuera de la vista. Solo entonces se lleva a la vista; lado a lado ya se ve.
  useEffect(() => {
    if (pedidoDeVista === 0) return;
    const mesa = raiz.current;
    const tabla = mesa?.querySelector<HTMLElement>(".pulso-panel-de-mesa--variables");
    const derecha = mesa?.querySelector<HTMLElement>(".pulso-mesa-pestana-pila > .pulso-panel-de-mesa");
    if (!tabla || !derecha) return;
    const apilada = derecha.getBoundingClientRect().top >= tabla.getBoundingClientRect().bottom - 1;
    if (apilada) derecha.scrollIntoView?.({ block: "start" });
  }, [pedidoDeVista]);
  const [borrador, despacharBorrador] = useReducer(reducirColumnas, BORRADOR_COLUMNAS_VACIO);
  const enRouter = useInRouterContext();
  const { estado, declarar, marcarCodificada, recargar } = control;
  const carga = estado.carga;
  const datos = base && carga.tipo === "listo" ? carga.datos : null;
  const [busqueda, setBusqueda] = useState("");
  const todos = useMemo(() => (datos ? gruposDeVariables(datos, estado.resumenes) : []), [datos, estado.resumenes]);
  const grupos = useMemo(() => filtrarGrupos(todos, busqueda), [todos, busqueda]);
  const fila = filaElegida(grupos, vista.elegida);
  const cifras = datos ? cifrasDeVariables(datos) : null;
  const incorporando = estado.ocupado === "declarar";

  const cifrasDeCabecera: CifraDePestana[] = cifras
    ? [{ clave: "anadidas", valor: formatoConteo(cifras.anadidas), rotulo: cifras.anadidas === 1 ? "añadida" : "añadidas", rango: 1, titulo: "Columnas incorporadas y variables calculadas" }]
    : [];

  const cabecera = (
    <CabeceraDeMesaDeCarga
      pestana="variables"
      titulo="Variables"
      estado={cifras && cifras.porIncorporar > 0 ? { tono: "parcial", texto: "Columnas por incorporar" } : null}
      cifras={cifrasDeCabecera}
      pendientes={HUECOS_DEL_MOTOR_VARIABLES}
      acciones={(
        <>
          <SelectorDeBaseCarga bases={bases} etiquetas={etiquetas} elegida={base ?? ""} onCambiar={onCambiarBase} deshabilitado={cambiandoBase} />
          {datos ? (
            <>
              <PulsoButton variant="primary" size="md" onClick={() => despacharVista({ tipo: "modo", modo: { tipo: "nueva" } })}>
                <Plus size={14} aria-hidden="true" />
                Nueva variable calculada
              </PulsoButton>
              <PulsoButton variant="secondary" size="md" onClick={() => despacharVista({ tipo: "modo", modo: { tipo: "anexar" } })}>
                <FileUp size={14} aria-hidden="true" />
                Anexar columnas
              </PulsoButton>
            </>
          ) : null}
        </>
      )}
    />
  );

  const pendientes = datos?.retiradas_pendientes ?? [];
  const avisos = datos && pendientes.length > 0 ? (
    <div className="pulso-vb-retiradas pulso-variables-retiradas" role="status">
      <AlertTriangle size={14} aria-hidden="true" />
      <span>
        {pendientes.length === 1
          ? `"${pendientes[0]}" no viene en la base y falta declarar por qué.`
          : `${formatoConteoDe(pendientes.length, "pregunta", "preguntas")} del formulario no vienen en la base y falta declarar por qué.`}
      </span>
      {enRouter ? (
        <Link className="pulso-vb-enlace" to={hrefDeclararRetiradas(datos.base)}>
          Declarar el motivo
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  ) : undefined;

  const cuerpoDeTabla = !base ? (
    <EstadoVacio
      tamano="normal"
      icono={<Inbox size={18} />}
      titulo="Todavía no hay respuestas cargadas"
      descripcion="Cárgalas en Bases para declarar columnas y variables calculadas."
    />
  ) : carga.tipo === "cargando" ? (
    <LoadingBlock variant="inline" label="Leyendo las columnas de la base" />
  ) : carga.tipo === "error" ? (
    // C5 categoría 3: desconexión o base inexistente; el mensaje del servidor dice la causa.
    <ErrorBlock label="No se pudieron leer las variables de la base" detail={carga.mensaje} />
  ) : todos.length > 0 && grupos.length === 0 ? (
    <EstadoVacio tamano="normal" icono={<Search size={18} />} titulo="Ninguna variable coincide con la búsqueda" />
  ) : grupos.length === 0 ? (
    // C5 categoría 1: la base no trae nada fuera del formulario y no tiene calculadas.
    <EstadoVacio
      tamano="normal"
      icono={<Inbox size={18} />}
      titulo="La base no trae variables fuera del formulario"
      descripcion="Crea una calculada o anexa columnas desde otro archivo."
    />
  ) : (
    <TablaDeVariables
      grupos={grupos}
      elegida={fila?.clave ?? null}
      onElegir={(clave, origen) => {
        despacharVista({ tipo: "elegir", clave });
        // Con las flechas no se salta: se sigue recorriendo la tabla.
        if (origen === "puntero") setPedidoDeVista((n) => n + 1);
      }}
      incorporando={incorporando}
      marcadas={borrador.marcadas}
      onMarcar={(name, marcada) => despacharBorrador({ tipo: "marcar", name, marcada })}
      onIncorporarElegidas={() => {
        if (!datos) return;
        // Las elegidas que se ven: una elegida y luego escondida por la búsqueda no entra sin verla.
        void declarar(columnasADeclarar(datos.extras, { ...borrador, marcadas: pendientesVisibles(grupos, borrador.marcadas) }))
          .then((ok) => { if (ok) despacharBorrador({ tipo: "reiniciar" }); });
      }}
      onIncorporarTodas={() => {
        if (!datos) return;
        // Las que se ven: con una búsqueda, solo las que coinciden (como "Marcar las que casan").
        void declarar(columnasADeclarar(datos.extras, { ...borrador, marcadas: pendientesVisibles(grupos) }))
          .then((ok) => { if (ok) despacharBorrador({ tipo: "reiniciar" }); });
      }}
    />
  );

  const derecha = !datos ? (
    <PanelDeMesa zona="inspector" titulo="Variable">
      <EstadoVacio tamano="compacto" icono={<Inbox size={15} />} titulo="Sin variable que mostrar" />
    </PanelDeMesa>
  ) : vista.modo.tipo === "anexar" ? (
    <PanelDeMesa
      zona="inspector"
      titulo="Columnas desde otro archivo"
      icono={<FileUp size={16} />}
      acciones={(
        <PulsoButton variant="icon" size="sm" aria-label="Cerrar" onClick={() => despacharVista({ tipo: "modo", modo: { tipo: "ver" } })}>
          <X size={15} aria-hidden="true" />
        </PulsoButton>
      )}
    >
      <AnexarColumnas base={datos.base} onAnexadas={recargar} sinMarco />
    </PanelDeMesa>
  ) : (
    <InspectorDeVariable
      control={control}
      fila={fila}
      vista={vista}
      despacharVista={despacharVista}
      borrador={borrador}
      despacharBorrador={despacharBorrador}
    />
  );

  return (
    <div ref={raiz} className="pulso-carga-mesa-kit pulso-variables" data-carga-surface="variables">
      <MesaDePestana grupo="carga/variables" columnas={2} cabecera={cabecera} avisos={avisos}>
        <PanelDeMesa
          zona="variables"
          titulo="Variables que no vienen del formulario"
          ocupado={incorporando}
          acciones={todos.length > 0 ? (
            <label className="pulso-variables-buscar">
              <Search size={14} aria-hidden="true" />
              <span className="pulso-sr-only">Buscar variable</span>
              <PulsoInput size="sm" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar variable" />
            </label>
          ) : undefined}
        >
          {cuerpoDeTabla}
        </PanelDeMesa>
        <PilaDeMesa grupo="carga/variables">
          {derecha}
          {datos ? (
            <CodificacionDeLaBase
              yaCodificada={datos.ya_codificada}
              ocupado={estado.ocupado === "codificada"}
              error={estado.mensaje?.seccion === "codificada" && estado.mensaje.tono === "error" ? estado.mensaje.texto : ""}
              onCambiar={(ya) => void marcarCodificada(ya)}
            />
          ) : null}
        </PilaDeMesa>
      </MesaDePestana>
    </div>
  );
}
