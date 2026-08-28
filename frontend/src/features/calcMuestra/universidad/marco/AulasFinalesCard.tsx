/**
 * Criterio final y más granular del marco de aulas: la lista de los
 * cursos-horario que sobreviven en ESTA facultad (tras el tipo de sesión),
 * ordenada por elegibles desc, cada uno con un switch —todos activos por
 * defecto— para apagar los que no entren al marco. Presentacional: la lista la
 * arma `aulasSupervivientesFacultad` y las mutaciones `setAulaExcluida`; aquí
 * solo se pinta, con buscador y scroll para las facultades de cientos de CH.
 */
import { CategoriaEvidencia } from "../criterios/CategoriaEvidencia";
import { usarPlegado } from "../criterios/usarPlegado";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import type { CriteriosSeleccionMarco } from "../../../../api/client";
import type { AulaFinal } from "../../dominio/criteriosImpacto";
import { fmtInt } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
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
  marcoDesactualizado = false,
  desfasadas = null,
  descartadas,
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
  /**
   * El marco vigente ya no refleja los criterios declarados. La lista sale de
   * ese marco, así que cuando es true lo que se ve es una foto anterior a los
   * criterios de ahora y hay que decirlo antes de que alguien apague a mano.
   */
  marcoDesactualizado?: boolean;
  /**
   * Cuántos cursos-horario de los que ESTA lista enseña ya no pasan los
   * criterios del borrador, según el recorrido vivo de la facultad.
   *
   * La lista sale del `aula_frame` ejecutado y el embudo de arriba va con el
   * borrador: son dos relojes. Pero avisar cada vez que difieren convierte el
   * aviso en permanente —con el recorrido vivo, diferir ES el estado normal de
   * trabajo— y un aviso siempre encendido deja de ser señal. Con la cifra, sólo
   * aparece cuando de verdad sobran filas, y dice cuántas.
   *
   * `null` cuando no hay recorrido vivo con el que comparar.
   */
  desfasadas?: number | null;
  /**
   * `classroom_id` que el borrador ya descarta, tal como los publica el motor.
   * La lista los OCULTA: enseñarlos y avisar de que sobran obliga a apagar a
   * mano lo que el recálculo iba a quitar solo, que es justo lo que pasó.
   * No se evalúan aquí los criterios —eso pondría la regla en dos sitios—: se
   * consume la identidad que decide el motor.
   */
  descartadas?: ReadonlySet<string>;
}) {
  // ADR 0057 · Este es el «mayor detalle, ver uno por uno» que cierra el embudo
  // de la facultad: es su destino, no un anexo. Plegado medía 50 px y exigía un
  // click para ver la lista que la facultad acaba de producir —«si algo está
  // oculto es un error de diseño»—. Con una facultad a la vez hay alto de sobra.
  /*
   * G39 · También obedece a «plegar todos».
   *
   * Se quedó fuera de la primera pasada por vivir en otro archivo: los cinco
   * criterios del bloque migraron y éste no, así que plegar todos dejaba uno
   * abierto. Medido en la app —5 de 6— y no leído: un `grep` de `useState(true)`
   * acotado al directorio del bloque no lo veía porque su tarjeta está aquí.
   */
  const [abierto, setAbierto] = usarPlegado(true);
  const [q, setQ] = useState("");
  const [verTodas, setVerTodas] = useState(false);
  /* Fuera las que el borrador ya descarta: la lista enseña lo que va a quedar,
     no lo que quedó la última vez. */
  const vigentes = useMemo(
    () => (descartadas?.size ? aulas.filter((a) => !descartadas.has(a.classroomId)) : aulas),
    [aulas, descartadas],
  );
  const ocultas = aulas.length - vigentes.length;
  const claves = useMemo(() => vigentes.map((a) => a.classroomKey), [vigentes]);
  const total = vigentes.length;
  const apagadas = contarExcluidas(seleccion, claves);
  const activas = total - apagadas;
  const propia = apagadas > 0;
  const filtradas = useMemo(() => {
    const t = normalizarBusqueda(q);
    if (!t) return vigentes;
    return vigentes.filter(
      (a) => normalizarBusqueda(a.label).includes(t) || normalizarBusqueda(a.detalle).includes(t),
    );
  }, [vigentes, q]);

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
          {/* C1 · La lista describe el MARCO CONSTRUIDO, no el borrador.
              `aulasSupervivientesFacultad` filtra por `included` del último
              `aula_frame`, así que con criterios cambiados sin recalcular
              enseña cursos que esos criterios ya descartan. Medido el
              2026-08-25 sobre HSVG26DEF: Ingeniería listaba 899 cursos-horario
              con laboratorios y seminarios dentro porque el marco vigente se
              construyó antes de declararse los criterios de curso-horario.
              Gonzalo estuvo apagándolos a mano —«de todas formas no debería
              pasar»— sobre una lista que el recálculo iba a cambiar sola. La
              superficie no puede impedir el recálculo, pero sí decir de cuándo
              es lo que enseña. */}
          {ocultas > 0 ? (
            <AvisoModulo tone="info" role="status" compact>
              <strong>{fmtInt(ocultas)}</strong> cursos-horario del último marco ya no pasan tus
              criterios y no se listan. Vuelven a aparecer si aflojas el criterio que los deja fuera.
            </AvisoModulo>
          ) : desfasadas == null && marcoDesactualizado ? (
            <AvisoModulo tone="warn" role="status" compact>
              Esta lista es la del último marco construido y tus criterios cambiaron. Sin
              recorrido vivo no se puede decir cuáles sobran: recalcula para verla al día.
            </AvisoModulo>
          ) : null}
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
