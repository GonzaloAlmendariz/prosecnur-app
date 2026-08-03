/**
 * Criterio final y más granular del marco de aulas: la lista de los
 * cursos-horario que sobreviven en ESTA facultad (tras el tipo de sesión),
 * ordenada por elegibles desc, cada uno con un switch —todos activos por
 * defecto— para apagar los que no entren al marco. Presentacional: la lista la
 * arma `aulasSupervivientesFacultad` y las mutaciones `setAulaExcluida`; aquí
 * solo se pinta, con buscador y scroll para las facultades de cientos de CH.
 */
import { CategoriaEvidencia } from "../criterios/CategoriaEvidencia";
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
  tasaAsistencia = null,
  aulas,
  seleccion,
  facLabel,
  onToggle,
  onReactivarTodas,
}: {
  /**
   * Asistencia histórica del marco, para estimar presentes por curso-horario.
   * `null` cuando el proyecto no la trae: la tarjeta lo declara en vez de
   * fabricar una estimación.
   */
  tasaAsistencia?: number | null;
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
  const [verTodas, setVerTodas] = useState(false);
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

  // Medido: la lista renderizaba sus 646 filas, cada una con su conmutador —**646
  // paradas de tabulación** para pasar de aquí con el teclado—. Es el mismo
  // defecto que el vuelco de píxeles, en otro eje: el contenido es alcanzable
  // sólo si nadie usa el teclado. Se muestra una ventana y la profundidad se
  // declara; el buscador de arriba llega a cualquier fila sin recorrerlas.
  const TOPE_FILAS = 40;
  const recortada = !verTodas && filtradas.length > TOPE_FILAS;
  const visibles = recortada ? filtradas.slice(0, TOPE_FILAS) : filtradas;

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
                placeholder="Buscar curso-horario o docente…"
                aria-label="Buscar curso-horario"
                onChange={(e) => setQ(e.target.value)}
              />
            </span>
            <span className="cmv2-aulas-finales-meta">
              {/* La casa dice «cursos-horario»; esta tarjeta decía «aulas» en
                  la misma pantalla donde el término aparece 60 veces bien
                  escrito. Un sinónimo suelto obliga a preguntarse si nombra otra
                  cosa. */}
              {filtradas.length === total
                ? `${total} cursos-horario`
                : `${filtradas.length} de ${total}`}
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
          <p className="cmv2-aulas-finales-unidad">
            Cifra por fila: <strong>estudiantes únicos elegibles</strong> en ese curso-horario.
          </p>
          <ul className="cmv2-aulas-finales-list">
            {visibles.map((a) => {
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
                  {/* G22 · La variante `unidad` de la tarjeta estándar.
                      Gonzalo: «para ese caso no podemos tener densidad ni
                      cursos-horario totales, pero sí cuántos alumnos son
                      elegibles y, si hay asistencia histórica, cuánto es y
                      cuánto representa». Con cientos de filas la tarjeta es
                      justo eso: dos cifras, sin gráfico.

                      La unidad se declara una vez en la cabecera de la lista,
                      no una por fila: repetirla no informa. El `title` la
                      conserva para quien llegue a una fila suelta. */}
                  <span className="cmv2-aulas-finales-elig">
                    <CategoriaEvidencia
                      aporte={{
                        ch: 1,
                        chContraste: 1,
                        elegibles: a.eligibleN,
                        tasaAsistencia,
                        distribucion: null,
                      }}
                      dominio={null}
                      variante="unidad"
                    />
                  </span>
                </li>
              );
            })}
            {filtradas.length === 0 ? (
              <li className="cmv2-aulas-finales-vacio">Ningún curso-horario coincide con «{q}».</li>
            ) : null}
          </ul>
          {filtradas.length > TOPE_FILAS && (
            <p className="cmv2-aulas-finales-depth">
              <span>
                {recortada
                  ? `Mostrando ${TOPE_FILAS} de ${fmtInt(filtradas.length)} · usa el buscador para llegar a uno concreto`
                  : `Mostrando los ${fmtInt(filtradas.length)}`}
              </span>
              <button type="button" onClick={() => setVerTodas((v) => !v)}>
                {recortada ? "Ver todos" : `Volver a ${TOPE_FILAS}`}
              </button>
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
