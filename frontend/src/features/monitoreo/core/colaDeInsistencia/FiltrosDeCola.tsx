import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  FILTROS_DE_INTENTOS,
  ORDENES_DE_COLA,
  type FiltroDeIntentos,
  type OrdenDeCola,
} from "../colaDeInsistenciaModel";
import { useFiltrosDeCola } from "../colaDeInsistenciaStore";
import { Switch } from "../../../../components/Switch";

const TODOS = "";

/**
 * Prioridad de cada control cuando la barra no cabe en una fila: el de menor
 * uso pasa primero a «Más filtros». Nunca queda un control solo en una
 * segunda fila. Los peldaños viven en `colaDeInsistencia.css`, sobre el ancho
 * de la barra (container query), no del viewport.
 */
type Prioridad = "alta" | "media" | "baja";

function Selector({
  etiqueta,
  valor,
  opciones,
  todos,
  prioridad = "alta",
  onCambiar,
}: {
  etiqueta: string;
  valor: string;
  opciones: ReadonlyArray<{ id: string; etiqueta: string }>;
  todos?: string;
  prioridad?: Prioridad;
  onCambiar: (valor: string) => void;
}) {
  return (
    <label className="mon-cola-filtro" data-prioridad={prioridad}>
      <span>{etiqueta}</span>
      <select value={valor} onChange={(event) => onCambiar(event.target.value)}>
        {todos ? <option value={TODOS}>{todos}</option> : null}
        {opciones.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.etiqueta}</option>)}
      </select>
    </label>
  );
}

/** Barra de filtros de la cola: buscar, responsable, resultado, intentos, cuota, orden y efectivas en Kobo. */
export function FiltrosDeCola({
  responsables,
  resultados,
  cuotas,
  etiquetaCuota,
  plataforma = "Kobo",
}: {
  responsables: readonly string[];
  resultados: readonly string[];
  cuotas: readonly string[];
  etiquetaCuota: string;
  plataforma?: string;
}) {
  const { filtros, cambiar } = useFiltrosDeCola();
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLSpanElement | null>(null);
  const listaId = useId();

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarFuera = (event: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(event.target as Node)) setAbierto(false);
    };
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", cerrarFuera);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("mousedown", cerrarFuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto]);

  const intentos = (prioridad: Prioridad) => (
    <Selector
      etiqueta="Intentos"
      valor={filtros.intentos}
      opciones={FILTROS_DE_INTENTOS}
      prioridad={prioridad}
      onCambiar={(valor) => cambiar({ intentos: valor as FiltroDeIntentos })}
    />
  );
  const cuota = (prioridad: Prioridad) => (cuotas.length ? (
    <Selector
      etiqueta={etiquetaCuota}
      valor={filtros.cuota ?? TODOS}
      todos="Todas"
      opciones={cuotas.map((item) => ({ id: item, etiqueta: item }))}
      prioridad={prioridad}
      onCambiar={(valor) => cambiar({ cuota: valor || null })}
    />
  ) : null);
  const interruptor = (prioridad: Prioridad) => (
    <span className="mon-cola-interruptor" data-prioridad={prioridad}>
      <span aria-hidden="true">{`Ocultar las efectivas en ${plataforma}`}</span>
      <Switch
        checked={filtros.ocultarEfectivas}
        ariaLabel={`Ocultar las efectivas en ${plataforma}`}
        onToggle={() => cambiar({ ocultarEfectivas: !filtros.ocultarEfectivas })}
      />
    </span>
  );

  return (
    <div className="mon-cola-filtros-marco">
      <div className="mon-cola-filtros" role="search" aria-label="Filtros de la cola">
        <label className="mon-cola-buscar">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={filtros.busqueda}
            placeholder="Buscar CodPulso"
            aria-label="Buscar CodPulso"
            onChange={(event) => cambiar({ busqueda: event.target.value })}
          />
        </label>
        <Selector
          etiqueta="Responsable"
          valor={filtros.responsable ?? TODOS}
          todos="Todos"
          opciones={responsables.map((nombre) => ({ id: nombre, etiqueta: nombre }))}
          onCambiar={(valor) => cambiar({ responsable: valor || null })}
        />
        <Selector
          etiqueta="Último resultado"
          valor={filtros.resultado ?? TODOS}
          todos="Todos"
          opciones={resultados.map((status) => ({ id: status, etiqueta: status }))}
          onCambiar={(valor) => cambiar({ resultado: valor || null })}
        />
        {intentos("media")}
        {cuota("baja")}
        <Selector
          etiqueta="Orden"
          valor={filtros.orden}
          opciones={ORDENES_DE_COLA}
          onCambiar={(valor) => cambiar({ orden: valor as OrdenDeCola })}
        />
        <span className="mon-cola-mas" ref={raiz}>
          <button
            type="button"
            className="mon-cola-mas-boton"
            aria-haspopup="dialog"
            aria-expanded={abierto}
            aria-controls={listaId}
            onClick={() => setAbierto((valor) => !valor)}
          >
            Más filtros <ChevronDown size={14} aria-hidden="true" />
          </button>
          {abierto ? (
            <span className="mon-cola-mas-lista" id={listaId} role="dialog" aria-label="Más filtros">
              {intentos("media")}
              {cuota("baja")}
              {interruptor("media")}
            </span>
          ) : null}
        </span>
        {interruptor("media")}
      </div>
    </div>
  );
}
