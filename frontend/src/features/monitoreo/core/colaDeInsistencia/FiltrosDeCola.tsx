import { Search } from "lucide-react";
import {
  FILTROS_DE_INTENTOS,
  ORDENES_DE_COLA,
  type FiltroDeIntentos,
  type OrdenDeCola,
} from "../colaDeInsistenciaModel";
import { useFiltrosDeCola } from "../colaDeInsistenciaStore";
import { Switch } from "../../../../components/Switch";

const TODOS = "";

function Selector({
  etiqueta,
  valor,
  opciones,
  todos,
  onCambiar,
}: {
  etiqueta: string;
  valor: string;
  opciones: ReadonlyArray<{ id: string; etiqueta: string }>;
  todos?: string;
  onCambiar: (valor: string) => void;
}) {
  return (
    <label className="mon-cola-filtro">
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
}: {
  responsables: readonly string[];
  resultados: readonly string[];
  cuotas: readonly string[];
  etiquetaCuota: string;
}) {
  const { filtros, cambiar } = useFiltrosDeCola();
  return (
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
      <Selector
        etiqueta="Intentos"
        valor={filtros.intentos}
        opciones={FILTROS_DE_INTENTOS}
        onCambiar={(valor) => cambiar({ intentos: valor as FiltroDeIntentos })}
      />
      {cuotas.length ? (
        <Selector
          etiqueta={etiquetaCuota}
          valor={filtros.cuota ?? TODOS}
          todos="Todas"
          opciones={cuotas.map((cuota) => ({ id: cuota, etiqueta: cuota }))}
          onCambiar={(valor) => cambiar({ cuota: valor || null })}
        />
      ) : null}
      <Selector
        etiqueta="Orden"
        valor={filtros.orden}
        opciones={ORDENES_DE_COLA}
        onCambiar={(valor) => cambiar({ orden: valor as OrdenDeCola })}
      />
      <span className="mon-cola-interruptor">
        <span aria-hidden="true">Ocultar las efectivas en Kobo</span>
        <Switch
          checked={filtros.ocultarEfectivas}
          ariaLabel="Ocultar las efectivas en Kobo"
          onToggle={() => cambiar({ ocultarEfectivas: !filtros.ocultarEfectivas })}
        />
      </span>
    </div>
  );
}
