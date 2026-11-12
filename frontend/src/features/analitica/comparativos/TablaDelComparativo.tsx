// "Preguntas armonizadas" (prototipo, panel central de Analítica › Comparativos):
// los filtros por cobertura, la búsqueda y una fila por pregunta con su
// interruptor de entrada y una columna por base. La celda dice si la pregunta es
// comparable en esa base; el porcentaje del prototipo no se dibuja porque el
// motor no publica cifras antes de generar el archivo. Rejilla con roles de
// tabla; la fila en `?foco=` se marca y se trae a la vista.

import { useEffect, useRef, type CSSProperties } from "react";

import { EstadoVacio } from "../../../components/EstadoVacio";
import { FilterChip } from "../../../components/FilterChip";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { Switch } from "../../../components/Switch";
import { formatoConteoDe } from "../../../lib/formatoNumero";
import { rotuloDeMatriz } from "../../../lib/rotuloDeMatriz";
import { Check, CheckCheck, CircleSlash2, Layers, List, Minus, Search } from "../../../vendor/lucide-react";
import { TEXTO_COBERTURA, coberturaPorMedicion, tituloDeSeccion, type EstadoCobertura, type FilaArmonizada } from "../panes/comparativosModel";
import { claveDeFoco, todasElegidas, type FiltroDeCobertura, type OpcionDeFiltro } from "./modeloDeComparativos";

const ICONO_FILTRO = { "todas-las-bases": CheckCheck, "una-menos": Layers, todas: List } as const;

const TEXTO_CELDA: Record<EstadoCobertura, string> = {
  comparable: "Comparable",
  "sin-variable": "No está",
  "no-comparable": "No comparable",
};

function IconoCelda({ estado }: { estado: EstadoCobertura }) {
  if (estado === "comparable") return <Check size={13} aria-hidden="true" />;
  if (estado === "sin-variable") return <Minus size={13} aria-hidden="true" />;
  return <CircleSlash2 size={13} aria-hidden="true" />;
}

export function TablaDelComparativo({
  visibles, opciones, filtro, consulta, periodos, rotulos, elegidas, segmentos, foco, onFiltro, onBuscar, onAlternar, onElegirVarias, onFoco,
}: {
  visibles: readonly FilaArmonizada[];
  opciones: readonly OpcionDeFiltro[];
  filtro: FiltroDeCobertura;
  consulta: string;
  periodos: readonly string[];
  rotulos: Record<string, string>;
  elegidas: readonly string[];
  /** Claves de las filas que son segmento de cruce del estudio. */
  segmentos: readonly string[];
  foco: string | null;
  onFiltro: (filtro: FiltroDeCobertura) => void;
  onBuscar: (consulta: string) => void;
  onAlternar: (clave: string) => void;
  onElegirVarias: (claves: string[], valor: boolean) => void;
  onFoco: (foco: string) => void;
}) {
  const tablaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tablaRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [foco]);

  const todas = todasElegidas(visibles, elegidas);
  const columnas = { "--comparativos-bases": periodos.length } as CSSProperties;
  const nombreDe = (base: string) => (rotulos[base] ?? "").trim() || base;

  return (
    <PanelDeMesa
      zona="preguntas"
      titulo="Preguntas armonizadas"
      conteo={formatoConteoDe(visibles.length, "pregunta", "preguntas")}
      acciones={(
        <PulsoButton
          variant="ghost"
          size="sm"
          disabled={visibles.length === 0}
          onClick={() => onElegirVarias(visibles.filter((f) => f.seleccionable).map((f) => f.clave), !todas)}
        >
          {todas ? "Quitar las visibles" : "Elegir las visibles"}
        </PulsoButton>
      )}
    >
      <div className="comparativos-barra">
        <div role="group" aria-label="Filtrar por cobertura" className="comparativos-filtros">
          {opciones.map((o) => (
            <FilterChip
              key={o.id}
              label={o.rotulo}
              count={o.conteo}
              icon={ICONO_FILTRO[o.id]}
              tone="neutral"
              active={filtro === o.id}
              onClick={() => onFiltro(o.id)}
            />
          ))}
        </div>
        <div className="comparativos-buscador">
          <Search size={14} aria-hidden="true" />
          <PulsoInput
            size="sm"
            type="search"
            value={consulta}
            onChange={(e) => onBuscar(e.target.value)}
            placeholder="Buscar por pregunta o sección"
            aria-label="Buscar por pregunta o sección"
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio
          icono={<Search size={16} />}
          titulo="Ninguna pregunta coincide"
          descripcion={consulta.trim() ? `Nada con "${consulta.trim()}" en la pregunta ni en la sección.` : "Elige otro filtro para ver las demás."}
        />
      ) : (
        <div
          ref={tablaRef}
          role="table"
          className="comparativos-tabla"
          style={columnas}
          aria-label="Preguntas armonizadas por base"
          data-qa-geometry-group="analitica/comparativos-tabla"
          data-qa-geometry-contract="intrinsic"
        >
          <div role="rowgroup" className="comparativos-tabla-cabecera">
            <div role="row" className="comparativos-fila comparativos-fila--cabecera">
              <span role="columnheader">Entra</span>
              <span role="columnheader">Pregunta armonizada</span>
              {periodos.map((b) => <span key={b} role="columnheader" title={b}>{nombreDe(b)}</span>)}
            </div>
          </div>
          {/* C1: cada fila mide lo que su pregunta; las celdas por base son columnas de la misma fila. */}
          <div role="rowgroup" data-qa-geometry-group="analitica/comparativos-filas" data-qa-geometry-contract="intrinsic">
            {visibles.map((f) => {
              const enFoco = claveDeFoco(f) === foco;
              const elegida = elegidas.includes(f.clave);
              const etiqueta = rotuloDeMatriz(f.etiqueta);
              return (
                <div
                  key={f.clave}
                  role="row"
                  className="comparativos-fila"
                  aria-current={enFoco ? "true" : undefined}
                  data-qa-geometry-group="analitica/comparativos-fila"
                  data-qa-geometry-contract="intrinsic"
                  data-fuera={elegida ? undefined : ""}
                  onClick={() => onFoco(claveDeFoco(f))}
                >
                  <span role="cell" className="comparativos-celda-entra" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={elegida}
                      disabled={!f.seleccionable}
                      ariaLabel={`Incluir en el comparativo: ${etiqueta}`}
                      className="analitica-interruptor"
                      onToggle={() => onAlternar(f.clave)}
                    />
                  </span>
                  <span role="rowheader" className="comparativos-celda-pregunta">
                    <button
                      type="button"
                      className="comparativos-pregunta"
                      aria-pressed={enFoco}
                      onClick={(e) => {
                        e.stopPropagation();
                        onFoco(claveDeFoco(f));
                      }}
                    >
                      <b>{etiqueta}</b>
                    </button>
                    <small>
                      {tituloDeSeccion(f.seccion)}
                      {segmentos.includes(f.clave) ? ", segmento de cruce del estudio" : ""}
                    </small>
                  </span>
                  {coberturaPorMedicion(f, periodos, rotulos).map((c) => (
                    <span
                      key={c.base}
                      role="cell"
                      className="comparativos-celda-base"
                      data-estado={c.estado}
                      title={`${nombreDe(c.base)}: ${TEXTO_COBERTURA[c.estado]}`}
                    >
                      <IconoCelda estado={c.estado} />
                      {TEXTO_CELDA[c.estado]}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PanelDeMesa>
  );
}
