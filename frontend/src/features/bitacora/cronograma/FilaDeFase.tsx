import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarRange, ChevronDown, ChevronRight, CircleDot, Link2, Plus } from "../../../vendor/lucide-react";

import type { BitacoraEstado, BitacoraFaseVista } from "../../../api/bitacora";
import type { BitacoraVinculo } from "../../../api/planTrabajo";
import type { BitacoraRecordatorio, PlanTrabajoTask } from "../../../api/planTrabajo";
import { EditorRecordatorios } from "../avisos/EditorRecordatorios";
import { identidadDeFase } from "../identidadDeFase";
import { ListaDeVinculos } from "../vinculos/ListaDeVinculos";
import { SelectorDeVinculo } from "../vinculos/SelectorDeVinculo";
import { duracionEnDias, etiquetaRango } from "./fases";

/**
 * Una fila del compositor: la fase, su rango y sus dos campos de fecha.
 *
 * Poner una fase en el cronograma tiene que costar dos clics —abrir el rango,
 * marcar dos fechas—; por eso los `input[type=date]` están en la fila y no
 * detrás de un diálogo. Las actividades sueltas viven en un disclosure, no en
 * el camino principal.
 */
export function FilaDeFase({
  fase,
  estado,
  tareas,
  tareaDeclarada,
  expandida,
  solapada,
  guardando,
  onToggle,
  onRango,
  onNuevaActividad,
  onRecordatorios,
  onVincular,
  onDesvincular,
}: {
  fase: BitacoraFaseVista;
  estado: BitacoraEstado;
  tareas: PlanTrabajoTask[];
  /** La tarea que declara la etapa; es la que lleva sus recordatorios. */
  tareaDeclarada: PlanTrabajoTask | null;
  expandida: boolean;
  solapada: boolean;
  guardando: boolean;
  onToggle: () => void;
  onRango: (inicio: string, fin: string) => void;
  onNuevaActividad: () => void;
  onRecordatorios: (recordatorios: BitacoraRecordatorio[]) => void;
  onVincular: (tareaId: string, vinculo: BitacoraVinculo) => void;
  onDesvincular: (tareaId: string, destinoTipo: string, destinoId: string) => void;
}) {
  const [enlazando, setEnlazando] = useState(false);
  const dias = duracionEnDias(fase.start_date, fase.end_date);
  const conEvidencia = fase.evidence_state === "evidence_available";
  const sinFechas = !fase.start_date && !fase.end_date;
  const identidad = identidadDeFase(fase.modulo, fase.seccion);
  const Icono = identidad.icono;

  return (
    <div
      className={`bit-fase${expandida ? " is-expandida" : ""}${sinFechas ? " is-vacia" : ""}`}
      data-fase={fase.id}
      data-modulo={fase.modulo}
      data-qa-geometry-member=""
      // El acento del módulo tiñe la fila: es el mismo sello que el usuario ve
      // en la barra de módulos, así la etapa se ancla a una parte de la app.
      style={identidad.vars}
    >
      <div className="bit-fase-cabecera">
        <button
          type="button"
          className="bit-fase-toggle"
          onClick={onToggle}
          aria-expanded={expandida}
          aria-label={`${expandida ? "Contraer" : "Expandir"} las actividades de ${fase.label}`}
        >
          {expandida ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        <span className="bit-fase-nombre">
          <span className="bit-fase-sello" aria-hidden="true">
            {Icono ? <Icono size={15} /> : null}
          </span>
          <span className="bit-fase-titulo">
            <strong>{fase.label}</strong>
            <small>
              {/* La etapa dice a qué parte de la app pertenece y lleva ahí: sin
                  eso sería una fecha sin destino. */}
              {identidad.href ? (
                <Link to={identidad.href} className="bit-fase-destino">
                  {identidad.etiquetaModulo}
                  <ArrowUpRight size={11} aria-hidden="true" />
                </Link>
              ) : (
                identidad.etiquetaModulo
              )}
              {fase.task_count > 0 && (
                <span className="bit-fase-conteo">
                  {fase.task_count} {fase.task_count === 1 ? "actividad" : "actividades"}
                </span>
              )}
            </small>
          </span>
        </span>

        <span
          className={`bit-fase-evidencia is-${conEvidencia ? "real" : "plan"}`}
          title={
            conEvidencia
              ? `Ya hay trabajo registrado en ${fase.modulos.join(", ")}`
              : "Planificada; todavía sin trabajo registrado en la app"
          }
        >
          <CircleDot size={12} aria-hidden="true" />
          {/* «Con avance» y no «En marcha»: el chip responde si YA HAY TRABAJO
              registrado en ese módulo, no si la fase está corriendo ahora. Una
              fase que terminó en mayo decía «En marcha» en julio. */}
          <span>{conEvidencia ? "Con avance" : "Planificada"}</span>
        </span>

        <span className="bit-fase-fechas">
          <label>
            <span className="pulso-sr-only">Inicio de {fase.label}</span>
            <input
              type="date"
              value={fase.start_date}
              disabled={guardando}
              onChange={(event) => onRango(event.target.value, fase.end_date)}
            />
          </label>
          <span aria-hidden="true">→</span>
          <label>
            <span className="pulso-sr-only">Fin de {fase.label}</span>
            <input
              type="date"
              value={fase.end_date}
              min={fase.start_date || undefined}
              disabled={guardando}
              onChange={(event) => onRango(fase.start_date, event.target.value)}
            />
          </label>
        </span>

        <span className={`bit-fase-rango${solapada ? " is-solapada" : ""}`}>
          <CalendarRange size={13} aria-hidden="true" />
          <span>{etiquetaRango(fase.start_date, fase.end_date)}</span>
          {dias > 0 && <small>{dias} d</small>}
        </span>
      </div>

      {solapada && (
        <p className="bit-fase-aviso">
          Se superpone con otra fase. Suele ser correcto —el procesamiento arranca
          antes de que cierre el campo—, pero conviene revisar que no sea un dedazo.
        </p>
      )}

      {expandida && (
        <div className="bit-fase-actividades">
          {tareas.length === 0 ? (
            <p className="bit-fase-sin-actividades">
              Esta fase todavía no tiene actividades sueltas. El rango de arriba ya
              la ubica en el cronograma; agrega actividades solo si necesitas
              detallarla.
            </p>
          ) : (
            <ul>
              {tareas.map((t) => (
                <li key={t.id} className={`bit-fase-actividad is-${t.status}`}>
                  <span>{t.activity}</span>
                  <small>{etiquetaRango(t.start_date, t.end_date)}</small>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="bit-boton-sutil" onClick={onNuevaActividad}>
            <Plus size={14} />
            <span>Actividad en {fase.label}</span>
          </button>

          {tareaDeclarada && (
            <>
              <EditorRecordatorios
                tarea={tareaDeclarada}
                guardando={guardando}
                onCambio={onRecordatorios}
              />

              <ListaDeVinculos
                estado={estado}
                origenTipo="tarea"
                origenId={tareaDeclarada.id}
                salientes={tareaDeclarada.links ?? []}
                onDesvincular={(tipo, id) => onDesvincular(tareaDeclarada.id, tipo, id)}
              />

              {enlazando ? (
                <SelectorDeVinculo
                  estado={estado}
                  origenTipo="tarea"
                  origenId={tareaDeclarada.id}
                  yaEnlazados={tareaDeclarada.links ?? []}
                  onElegir={(v) => {
                    onVincular(tareaDeclarada.id, v);
                    setEnlazando(false);
                  }}
                  onCerrar={() => setEnlazando(false)}
                />
              ) : (
                <button
                  type="button"
                  className="bit-boton-sutil"
                  onClick={() => setEnlazando(true)}
                  disabled={guardando}
                >
                  <Link2 size={13} />
                  <span>Enlazar con…</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
