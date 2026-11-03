// =============================================================================
// CrossBar.tsx — «Cruzar por» de la barra de lectura del explorador (E7)
// =============================================================================
// Sin cruce: un chip «Elegir variable» que abre el selector. Con cruce: el
// chip lleno con la variable cruzada, «Cambiar» y × para quitarlo.
//
// El selector lista TODAS las variables (el motor elige el gráfico por el
// par), buscable por texto o código, filtrable por tipo, agrupado por sección
// —la de la pregunta primero— y cada fila anticipa el gráfico que resulta
// (`graficoDelPar`). Una abierta sólo se cruza con una única: las demás quedan
// a la vista, atenuadas, y el pie dice la limitación (`LIMITE_ABIERTA`).
// =============================================================================

import type { CSSProperties, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Info, X as XIcon } from "../../../vendor/lucide-react";
import { Popover } from "../../../components/Popover";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import "./crossBar.css";
import type { ExploradorSeccion, ExploradorVariable } from "../types";
import ChipsTipo from "../tabs/explorar/ChipsTipo";
import InsigniaTipo from "../tabs/explorar/InsigniaTipo";
import { abiertaSinCruce, graficoDelPar, LIMITE_ABIERTA } from "../tabs/explorar/graficoDelPar";
import { coincide, conteoPorFamilia, enFamilia, type FamiliaTipo } from "../tabs/explorar/tiposVariable";

export type CrossBarProps = {
  secciones: ExploradorSeccion[];
  /** Variable principal (no se lista en el selector). */
  selfVar: string;
  /** Sección de la variable principal (va primero en el selector). */
  selfSeccion: string | null;
  /** Variable cruzada actualmente, o null si no hay cruce. */
  cruzar: string | null;
  onChange: (v: string | null) => void;
  style?: CSSProperties;
};

type Candidata = ExploradorVariable & { seccion: string };

export default function CrossBar({
  secciones,
  selfVar,
  selfSeccion,
  cruzar,
  onChange,
  style,
}: CrossBarProps) {
  const [query, setQuery] = useState("");
  const [familia, setFamilia] = useState<FamiliaTipo>("todas");

  const self = useMemo(
    () => secciones.flatMap((s) => s.variables).find((v) => v.name === selfVar) ?? null,
    [secciones, selfVar],
  );

  const candidatas = useMemo<Candidata[]>(
    () =>
      secciones.flatMap((s) =>
        s.variables.filter((v) => v.name !== selfVar).map((v) => ({ ...v, seccion: s.nombre })),
      ),
    [secciones, selfVar],
  );
  const conteo = useMemo(() => conteoPorFamilia(candidatas), [candidatas]);

  const grupos = useMemo(() => {
    const visibles = candidatas.filter((v) => enFamilia(v, familia) && coincide(v, query));
    const orden = secciones
      .map((s) => s.nombre)
      .sort((a, b) => Number(b === selfSeccion) - Number(a === selfSeccion));
    return orden
      .map((nombre) => ({ nombre, vars: visibles.filter((v) => v.seccion === nombre) }))
      .filter((g) => g.vars.length > 0);
  }, [candidatas, familia, query, secciones, selfSeccion]);

  const crossedVar = cruzar ? candidatas.find((v) => v.name === cruzar) ?? null : null;

  function handlePick(name: string) {
    onChange(name);
    setQuery("");
  }

  // Popover del kit (L1): portal, posición, Escape y click fuera los pone él;
  // se cierra solo al elegir (cerrarAlCambiar={cruzar}).
  const panel = (
    <CrossPanel
      total={candidatas.length}
      query={query}
      onQueryChange={setQuery}
      familia={familia}
      onFamilia={setFamilia}
      conteo={conteo}
      grupos={grupos}
      selfTipo={self?.tipo ?? null}
      cruzar={cruzar}
      onPick={handlePick}
    />
  );
  const popover = (trigger: ReactElement) => (
    <Popover
      trigger={trigger}
      side="bottom"
      align="start"
      maxWidth={460}
      className="pulso-crossbar-popover"
      ariaLabel="Elegir variable para cruzar"
      cerrarAlCambiar={cruzar}
    >
      {panel}
    </Popover>
  );

  return (
    <div className="crossbar" style={style}>
      {!crossedVar &&
        popover(
          <button type="button" className="vx-chip" aria-haspopup="dialog">
            Elegir variable
            <ChevronDown size={12} aria-hidden />
          </button>,
        )}
      {crossedVar && (
        <>
          <span className="crossbar-activa" title={crossedVar.name}>
            {crossedVar.label || crossedVar.name}
          </span>
          {popover(
            <PulsoButton variant="link" size="sm" aria-haspopup="dialog" title="Cambiar variable de cruce">
              Cambiar
            </PulsoButton>,
          )}
          <PulsoButton variant="icon" size="sm" intent="remove" aria-label="Quitar cruce" title="Quitar cruce" onClick={() => onChange(null)}>
            <XIcon size={12} aria-hidden />
          </PulsoButton>
        </>
      )}
    </div>
  );
}

function CrossPanel({
  total,
  query,
  onQueryChange,
  familia,
  onFamilia,
  conteo,
  grupos,
  selfTipo,
  cruzar,
  onPick,
}: {
  total: number;
  query: string;
  onQueryChange: (v: string) => void;
  familia: FamiliaTipo;
  onFamilia: (f: FamiliaTipo) => void;
  conteo: Readonly<Record<FamiliaTipo, number>>;
  grupos: { nombre: string; vars: Candidata[] }[];
  selfTipo: ExploradorVariable["tipo"] | null;
  cruzar: string | null;
  onPick: (name: string) => void;
}) {
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    searchRef.current?.focus();
  }, []);
  const sinCruce = (v: Candidata) => !!selfTipo && abiertaSinCruce(selfTipo, v.tipo);
  const hayLimite = grupos.some((g) => g.vars.some(sinCruce));

  return (
    <div className="crossbar-panel">
      <div className="crossbar-panel-cab">
        <PulsoInput
          ref={searchRef}
          size="sm"
          type="search"
          aria-label="Buscar variable para cruzar"
          placeholder={`Buscar entre las ${total} variables`}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <ChipsTipo valor={familia} conteo={conteo} onCambio={onFamilia} etiqueta="Filtrar por tipo" />
      </div>
      <div className="crossbar-panel-lista">
        {grupos.length === 0 ? (
          <p role="status" className="crossbar-vacio">Sin variables que coincidan.</p>
        ) : (
          grupos.map((g) => (
            <div key={g.nombre} className="crossbar-grupo">
              <span className="vx-eyebrow">{g.nombre}</span>
              {g.vars.map((v) => {
                const grafico = selfTipo ? graficoDelPar(selfTipo, v.tipo) : null;
                const bloqueada = sinCruce(v);
                return (
                  <button
                    key={v.name}
                    type="button"
                    className={`crossbar-opcion${bloqueada ? " is-sin-cruce" : ""}`}
                    aria-current={v.name === cruzar ? "true" : undefined}
                    disabled={bloqueada}
                    title={bloqueada ? LIMITE_ABIERTA : undefined}
                    onClick={() => onPick(v.name)}
                  >
                    <InsigniaTipo tipo={v.tipo} />
                    <span className="crossbar-opcion-texto">
                      <span>{v.label || v.name}</span>
                      <span className="vx-mono">{v.name}</span>
                    </span>
                    {grafico && (
                      <span className="crossbar-grafico">
                        <ArrowRight size={12} aria-hidden />
                        {grafico}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
      {hayLimite && (
        <p className="crossbar-limite">
          <Info size={14} aria-hidden />
          <span>{LIMITE_ABIERTA}</span>
        </p>
      )}
    </div>
  );
}
