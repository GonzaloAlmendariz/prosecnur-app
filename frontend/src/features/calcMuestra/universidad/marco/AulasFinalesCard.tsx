/**
 * Criterio final y más granular del marco de aulas: la lista de los
 * cursos-horario que sobreviven en ESTA facultad (tras el tipo de sesión),
 * ordenada por elegibles desc, cada uno con un switch —todos activos por
 * defecto— para apagar los que no entren al marco. Presentacional: la lista la
 * arma `aulasSupervivientesFacultad` y las mutaciones `setAulaExcluida`; aquí
 * solo se pinta, con buscador y scroll para las facultades de cientos de CH.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import type { CriteriosSeleccionMarco } from "../../../../api/client";
import type { AulaFinal } from "../../dominio/criteriosImpacto";
import { fmtInt } from "../../sharedCore";
import { Switch } from "../criterios/Switch";
import { aulaExcluida, contarExcluidas, reactivarTodas } from "../criterios/aulasFinalesModel";

/** Búsqueda insensible a acentos y mayúsculas (curso o docente). */
function normalizarBusqueda(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function AulasFinalesCard({
  aulas,
  seleccion,
  facLabel,
  onToggle,
  onReactivarTodas,
}: {
  /** Cursos-horario supervivientes de la facultad (orden elegibles desc). */
  aulas: AulaFinal[];
  seleccion: CriteriosSeleccionMarco;
  facLabel: string;
  /** Enciende/apaga un curso-horario (excluida=true lo saca del marco). */
  onToggle: (classroomId: string, excluida: boolean) => void;
  /** Reactiva todos los apagados de esta facultad (claves en text_key). */
  onReactivarTodas: (clavesTextKey: string[]) => void;
}) {
  // ADR 0057 · Este es el «mayor detalle, ver uno por uno» que cierra el embudo
  // de la facultad: es su destino, no un anexo. Plegado medía 50 px y exigía un
  // click para ver la lista que la facultad acaba de producir —«si algo está
  // oculto es un error de diseño»—. Con una facultad a la vez hay alto de sobra.
  const [abierto, setAbierto] = useState(true);
  const [q, setQ] = useState("");
  const claves = useMemo(() => aulas.map((a) => a.classroomKey), [aulas]);
  const total = aulas.length;
  const apagadas = contarExcluidas(seleccion, claves);
  const activas = total - apagadas;
  const propia = apagadas > 0;
  const filtradas = useMemo(() => {
    const t = normalizarBusqueda(q);
    if (!t) return aulas;
    return aulas.filter(
      (a) => normalizarBusqueda(a.label).includes(t) || normalizarBusqueda(a.detalle).includes(t),
    );
  }, [aulas, q]);

  if (total === 0) return null;

  return (
    <section
      className="cmv2-chfp-crit"
      data-qa-geometry-member
      data-decision={propia ? "propia" : "hereda"}
      data-open={abierto || undefined}
      data-collapsible={!abierto || undefined}
      onClick={abierto ? undefined : () => setAbierto(true)}
    >
      <button
        type="button"
        className="cmv2-chfp-crit-head"
        aria-expanded={abierto}
        onClick={(e) => {
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
      >
        <span className="cmv2-chfp-crit-head-label">
          <span className="cmv2-chfp-crit-chevron" aria-hidden="true">
            {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <strong>Cursos-horario del marco</strong>
        </span>
        <span className="cmv2-chfp-crit-state" data-decision={propia ? "propia" : "hereda"}>
          {activas} de {total} activos
        </span>
      </button>
      {abierto ? (
        <div className="cmv2-aulas-finales">
          <p className="cmv2-chfp-selecciona-nota">
            Todos entran por defecto; apaga los cursos-horario de {facLabel} que no quieras en el marco.
          </p>
          <div className="cmv2-aulas-finales-toolbar">
            <span className="cmv2-aulas-finales-search">
              <Search size={13} aria-hidden="true" />
              <input
                type="search"
                value={q}
                placeholder="Buscar curso o docente…"
                aria-label="Buscar curso-horario"
                onChange={(e) => setQ(e.target.value)}
              />
            </span>
            <span className="cmv2-aulas-finales-meta">
              {filtradas.length === total ? `${total} aulas` : `${filtradas.length} de ${total}`}
              {propia ? (
                <button
                  type="button"
                  className="cmv2-crit-tsf-heredar"
                  onClick={() => onReactivarTodas(claves)}
                >
                  Reactivar {apagadas}
                </button>
              ) : null}
            </span>
          </div>
          <ul className="cmv2-aulas-finales-list">
            {filtradas.map((a) => {
              const off = aulaExcluida(seleccion, a.classroomId);
              return (
                <li key={a.classroomKey} className="cmv2-aulas-finales-row" data-off={off || undefined}>
                  <Switch
                    checked={!off}
                    ariaLabel={`${a.label} en el marco`}
                    onToggle={() => onToggle(a.classroomId, !off)}
                  />
                  <span className="cmv2-aulas-finales-main">
                    <span className="cmv2-aulas-finales-label">{a.label}</span>
                    {a.detalle ? <span className="cmv2-aulas-finales-detalle">{a.detalle}</span> : null}
                  </span>
                  <span className="cmv2-aulas-finales-elig">
                    {fmtInt(a.eligibleN)} <em>alumnos elegibles</em>
                  </span>
                </li>
              );
            })}
            {filtradas.length === 0 ? (
              <li className="cmv2-aulas-finales-vacio">Ningún curso-horario coincide con «{q}».</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
