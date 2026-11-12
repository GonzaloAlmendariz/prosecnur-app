// "Variables de la base" (prototipo, Analítica › Variables): los filtros con su
// conteo, el buscador y la lista agrupada por sección. Una sola rejilla con
// roles de tabla: las filas de sección cruzan todas las columnas y la cabecera
// queda pegada arriba mientras la lista se desplaza dentro del panel.

import type { ReactNode } from "react";

import type { DataReviewVariable } from "../../../api/analitica";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { FilterChip } from "../../../components/FilterChip";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { formatoConteo } from "../../../lib/formatoNumero";
import { textoPlano } from "../../../lib/textoPlano";
import { ClipboardList, Eye, EyeOff, LayoutGrid, PencilLine, RefreshCw, Search } from "../../../vendor/lucide-react";
import type { DataReviewSectionGroup } from "./borradorDeEtiquetas";
import { FilaDeSeccion } from "./FilaDeSeccion";
import { FilaDeVariable } from "./FilaDeVariable";
import { coincideBusqueda, conteosDeFiltro, enFiltro, type EstadoDeFila, type FiltroDeVariables } from "./modeloDeVariables";

export type PanelDeVariablesProps = {
  grupos: DataReviewSectionGroup[];
  total: number;
  filtro: FiltroDeVariables;
  consulta: string;
  /** Lo que la lista sabe de cada variable: si entra y si tiene etiquetas por confirmar. */
  estadoDe: (variable: DataReviewVariable, grupo: DataReviewSectionGroup) => EstadoDeFila;
  etiquetaDe: (variable: DataReviewVariable) => string;
  detallesDe: (variable: DataReviewVariable) => number;
  repartidas: Set<string>;
  baseComun: number | null;
  elegida: string | null;
  cargando: boolean;
  /** Los casos que cuentan y la versión de la base; ver la nota del pie. */
  pie: ReactNode;
  onFiltro: (filtro: FiltroDeVariables) => void;
  onBuscar: (consulta: string) => void;
  onIncluir: (name: string) => void;
  onIncluirSeccion: (names: string[], incluir: boolean) => void;
  onRenombrarSeccion: (id: string, nombre: string) => void;
  onOcultarSeccion: (id: string, names: string[], ocultar: boolean) => void;
  onElegir: (name: string) => void;
  onRecargar: () => void;
};

const FILTROS: readonly { id: FiltroDeVariables; rotulo: string; icono: typeof LayoutGrid; tono: "neutral" | "primary" | "warn" }[] = [
  { id: "todas", rotulo: "Todas", icono: LayoutGrid, tono: "neutral" },
  { id: "incluidas", rotulo: "Incluidas", icono: Eye, tono: "primary" },
  { id: "excluidas", rotulo: "Excluidas", icono: EyeOff, tono: "neutral" },
  { id: "por-confirmar", rotulo: "Por confirmar", icono: PencilLine, tono: "warn" },
];

export function PanelDeVariables(props: PanelDeVariablesProps) {
  const { grupos, filtro, consulta, estadoDe, etiquetaDe } = props;
  const estados = grupos.flatMap((g) => g.variables.map((v) => estadoDe(v, g)));
  const conteos = conteosDeFiltro(estados);
  const visibles = grupos
    .map((g) => ({
      grupo: g,
      variables: g.variables.filter((v) => enFiltro(estadoDe(v, g), filtro) && coincideBusqueda(v.name, etiquetaDe(v), consulta)),
    }))
    .filter((g) => g.variables.length > 0);

  return (
    <PanelDeMesa
      zona="variables"
      titulo="Variables de la base"
      conteo={props.cargando ? undefined : props.total}
      ocupado={props.cargando && props.total > 0}
      acciones={(
        <PulsoButton
          variant="icon"
          size="sm"
          onClick={props.onRecargar}
          disabled={props.cargando}
          aria-label="Volver a leer las variables de la base"
          title="Volver a leer las variables de la base"
        >
          <RefreshCw size={14} className={props.cargando ? "pulso-spin" : undefined} aria-hidden="true" />
        </PulsoButton>
      )}
      pie={props.pie}
    >
      <div className="datos-barra-lista">
        <div role="group" aria-label="Filtrar variables" className="datos-filtros">
          {FILTROS.map((f) => (
            <FilterChip
              key={f.id}
              label={f.rotulo}
              count={conteos[f.id]}
              icon={f.icono}
              tone={f.tono}
              active={filtro === f.id}
              onClick={() => props.onFiltro(f.id)}
            />
          ))}
        </div>
        <div className="datos-buscador">
          <Search size={14} aria-hidden="true" />
          <PulsoInput
            size="sm"
            type="search"
            value={consulta}
            onChange={(e) => props.onBuscar(e.target.value)}
            placeholder="Buscar variable o etiqueta"
            aria-label="Buscar variable o etiqueta"
          />
        </div>
      </div>

      {props.total === 0 && !props.cargando ? (
        <EstadoVacio
          icono={<ClipboardList size={16} />}
          titulo="La base no trae variables"
          descripcion="Revisa la base activa en Carga; al volver, la lista se lee de nuevo."
        />
      ) : null}
      {props.total > 0 && visibles.length === 0 ? (
        <EstadoVacio
          icono={<Search size={16} />}
          titulo="Ninguna variable coincide"
          descripcion={consulta.trim() ? `Nada con "${consulta.trim()}" en el código ni en la etiqueta.` : "Elige otro filtro para ver las demás."}
        />
      ) : null}
      {visibles.length > 0 ? (
        <div className="datos-tabla" role="table" aria-label="Variables de la base">
          <div role="rowgroup" className="datos-tabla-cabecera">
            <div role="row" className="datos-fila datos-fila--cabecera">
              <span role="columnheader">Entra</span>
              <span role="columnheader">Código</span>
              <span role="columnheader">Etiqueta en los entregables</span>
              <span role="columnheader">Tipo</span>
              <span role="columnheader">
                Con dato{props.baseComun !== null ? <small>, de {formatoConteo(props.baseComun)}</small> : null}
              </span>
              <span role="columnheader" className="datos-celda-opciones">Opciones</span>
            </div>
          </div>
          {/* C1: cada sección mide lo que sus variables; no son marcos pares. */}
          <div
            className="datos-secciones"
            data-qa-geometry-group="analitica/datos-secciones"
            data-qa-geometry-contract="intrinsic"
          >
            {visibles.map(({ grupo, variables }) => (
              <div
                key={grupo.id}
                role="rowgroup"
                className="datos-grupo"
                aria-label={textoPlano(grupo.name)}
                // C1: cada fila mide lo que su etiqueta y sus notas; no son marcos pares.
                data-qa-geometry-group="analitica/datos-filas"
                data-qa-geometry-contract="intrinsic"
              >
                <FilaDeSeccion
                  grupo={grupo}
                  incluidas={grupo.variables.filter((v) => estadoDe(v, grupo).incluida).length}
                  onIncluirTodas={(incluir) => props.onIncluirSeccion(grupo.variables.map((v) => v.name), incluir)}
                  onRenombrar={(nombre) => props.onRenombrarSeccion(grupo.id, nombre)}
                  onOcultar={(ocultar) => props.onOcultarSeccion(grupo.id, grupo.variables.map((v) => v.name), ocultar)}
                />
                {variables.map((v) => {
                  const estado = estadoDe(v, grupo);
                  return (
                    <FilaDeVariable
                      key={v.name}
                      variable={v}
                      etiqueta={etiquetaDe(v)}
                      incluida={estado.incluida}
                      bloqueada={grupo.hidden && !grupo.synthetic}
                      porConfirmar={estado.porConfirmar}
                      detalles={props.detallesDe(v)}
                      repartida={props.repartidas.has(v.name)}
                      baseComun={props.baseComun}
                      elegida={props.elegida === v.name}
                      onIncluir={props.onIncluir}
                      onElegir={props.onElegir}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </PanelDeMesa>
  );
}
