import { useMemo, useState } from "react";
import { Bell, BellRing, CalendarPlus, Flag, Loader2, Sparkles } from "../../../vendor/lucide-react";

import {
  apiBitacoraDesvincular,
  apiBitacoraSembrarFases,
  apiBitacoraTareaCrear,
  apiBitacoraTareaEditar,
  apiBitacoraVincular,
  type BitacoraEstado,
  type BitacoraFase,
} from "../../../api/bitacora";
import { Alert } from "../../../components/Alert";
import { PANEL_AVISOS } from "../../../lib/navegacion/manifiesto";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { CentroDeAvisos } from "../avisos/CentroDeAvisos";
import { useAvisos } from "../avisos/useAvisos";
import { toISODate } from "../dateUtils";
import { identidadDeFase } from "../identidadDeFase";
import { FilaDeFase } from "./FilaDeFase";
import { etiquetaRango, fasesSolapadas, rangoDelEstudio } from "./fases";

/**
 * Vista de entrada del cronograma (ADR 0047).
 *
 * La unidad que el usuario crea es el RANGO DE FECHAS DE UNA FASE, elegida de
 * las del catálogo. Antes el cronograma era el espejo de un Excel y el
 * backend adivinaba a qué módulo pertenecía cada actividad leyendo su texto;
 * acá la fase se elige y esa elección no se vuelve a pisar.
 *
 * Meta de interacción: montar un cronograma útil en menos de un minuto.
 */
export function CompositorDeFases({
  estado,
  onEstado,
}: {
  estado: BitacoraEstado;
  onEstado: (siguiente: BitacoraEstado) => void;
}) {
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El centro de avisos es un panel direccionable (`?panel=avisos`): la regla
  // de la casa pide que todo overlay viva en la URL, no en un `useState`.
  const panelAvisos = usePanelDireccionable(PANEL_AVISOS);
  const avisos = useAvisos(estado, panelAvisos.abrir);

  const tareasPorId = useMemo(() => {
    const mapa = new Map(estado.plan.tasks.map((t) => [t.id, t]));
    return mapa;
  }, [estado.plan.tasks]);

  const solapadas = useMemo(() => new Set(fasesSolapadas(estado.fases)), [estado.fases]);
  const rango = useMemo(() => rangoDelEstudio(estado.fases), [estado.fases]);
  const conFechas = estado.fases.filter((f) => f.start_date || f.end_date).length;
  const sembrado = estado.fases.some((f) => f.declarada);

  async function ejecutar(accion: () => Promise<BitacoraEstado>) {
    setGuardando(true);
    setError(null);
    try {
      onEstado(await accion());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio en el cronograma.");
    } finally {
      setGuardando(false);
    }
  }

  // La fila de una fase escribe sobre la tarea que la declara. Si todavía no
  // existe (fase derivada de actividades sueltas), se crea al poner la fecha:
  // el usuario no debería tener que "declarar" nada antes de fechar.
  async function guardarRango(fase: BitacoraFase, inicio: string, fin: string) {
    const vista = estado.fases.find((f) => f.id === fase);
    const declarada = vista?.task_ids
      .map((id) => tareasPorId.get(id))
      .find((t) => t?.fase_manual);
    const finReal = fin || inicio;

    await ejecutar(() =>
      declarada
        ? apiBitacoraTareaEditar(declarada.id, { start_date: inicio, end_date: finReal, fase })
        : apiBitacoraTareaCrear({
            activity: vista?.label ?? fase,
            fase,
            start_date: inicio,
            end_date: finReal,
          }),
    );
  }

  function alternar(fase: string) {
    setExpandidas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(fase)) siguiente.delete(fase);
      else siguiente.add(fase);
      return siguiente;
    });
  }

  if (!sembrado && estado.plan.tasks.length === 0) {
    return (
      <div className="bit-compositor-vacio" data-audit-ready="bitacora-cronograma-vacio">
        <strong>Arma el cronograma del estudio</strong>

        {/* El recorrido se muestra, no se describe. Y cada paso lleva el sello
            de su módulo —el mismo ícono y color que el usuario ya ve en la
            barra de módulos—, así la etapa se reconoce como una parte concreta
            de la app y no como una abstracción de cronograma. */}
        {/* El número sale del catálogo, no del texto. Decía «seis» y el
            canon tiene cinco desde que se quitó la fase «Diseño» a propósito
            —`bitacora_fases.R` lo explica: una fase que apunta al módulo donde
            ya estás parado no declara nada—. Un conteo escrito a mano envejece
            en silencio; derivado, no puede. */}
        <ol
          className="bit-riel"
          aria-label={`Las ${estado.catalogo_fases.length} etapas de un estudio`}
          data-qa-geometry-group="bitacora/riel-fases"
          data-qa-geometry-contract="intrinsic"
        >
          {estado.catalogo_fases.map((f) => {
            const id = identidadDeFase(f.modulo, f.seccion);
            const Icono = id.icono;
            return (
              <li key={f.id} className="bit-riel-paso" style={id.vars}>
                <span className="bit-riel-punto" aria-hidden="true">
                  {Icono ? <Icono size={14} /> : null}
                </span>
                <span className="bit-riel-nombre">{f.label}</span>
                {/* La pieza más específica que quepa: el color ya dice de qué
                    módulo es, así que acá lo útil es la sección. Con "Módulo"
                    a secas, Procesamiento y Entregables dirían lo mismo. */}
                <small className="bit-riel-modulo">{id.etiquetaCorta}</small>
              </li>
            );
          })}
        </ol>

        <p>Pones dos fechas por etapa. El resto lo arma la app.</p>

        {error && <Alert kind="error">{error}</Alert>}
        <div className="bit-compositor-vacio-acciones">
          <button
            type="button"
            className="bit-boton bit-boton--primario"
            disabled={guardando}
            onClick={() => void ejecutar(() => apiBitacoraSembrarFases())}
          >
            {guardando ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            <span>Sembrar las {estado.catalogo_fases.length} fases</span>
          </button>
          <button
            type="button"
            className="bit-boton"
            disabled={guardando}
            onClick={() =>
              void ejecutar(() =>
                apiBitacoraTareaCrear({
                  activity: "Nueva actividad",
                  start_date: toISODate(new Date()),
                  end_date: toISODate(new Date()),
                }),
              )
            }
          >
            <CalendarPlus size={15} />
            <span>Empezar con una actividad</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bit-compositor" data-audit-ready="bitacora-cronograma-fases">
      <div className="bit-compositor-resumen">
        <span className="bit-compositor-token">
          <small>Fases con fecha</small>
          <strong>{conFechas} de {estado.fases.length}</strong>
        </span>
        <span className="bit-compositor-token">
          <small>Ventana del estudio</small>
          <strong>{etiquetaRango(rango.inicio, rango.fin)}</strong>
        </span>
        <span className="bit-compositor-token">
          <small>Actividades</small>
          <strong>{estado.contadores.tareas}</strong>
        </span>
        <div className="bit-compositor-acciones">
          <button
            type="button"
            className={`bit-campana${avisos.vencidos.length > 0 ? " is-pendiente" : ""}`}
            onClick={panelAvisos.alternar}
            aria-expanded={panelAvisos.abierto}
          >
            {avisos.vencidos.length > 0 ? <BellRing size={14} /> : <Bell size={14} />}
            <span>Avisos</span>
            {avisos.vencidos.length > 0 && (
              <span className="bit-campana-conteo">{avisos.vencidos.length}</span>
            )}
          </button>
          {!sembrado && (
            <button
              type="button"
              className="bit-boton"
              disabled={guardando}
              onClick={() => void ejecutar(() => apiBitacoraSembrarFases())}
            >
              <Sparkles size={14} />
              <span>Sembrar fases faltantes</span>
            </button>
          )}
          <button
            type="button"
            className="bit-boton"
            disabled={guardando}
            onClick={() =>
              void ejecutar(() =>
                apiBitacoraTareaCrear({
                  activity: "Nuevo entregable",
                  fase: "entregables",
                  kind: "deliverable",
                  start_date: toISODate(new Date()),
                  end_date: toISODate(new Date()),
                }),
              )
            }
          >
            <Flag size={14} />
            <span>Entregable</span>
          </button>
        </div>
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      {/* `intrinsic`, no `equal`.
       *
       * Una fila de fase NO es una variante repetida de alto fijo: se expande
       * con su disclosure para mostrar las actividades, y lleva un aviso cuando
       * sus fechas se solapan con otra. Declararla `equal` era prometer algo que
       * el propio diseño no puede cumplir —medido: 71, 71, 71, 48, 48 según
       * llevaran aviso—, y la promesa se rompía sola en cuanto alguien expandía
       * una fila. Lo que sí se sostiene, y es lo que el runner verifica con
       * `intrinsic`, es que cada fila contenga su propio vacío. */}
      <div
        className="bit-compositor-fases"
        data-qa-geometry-group="bitacora-fases"
        data-qa-geometry-contract="intrinsic"
      >
        {estado.fases.map((fase) => (
          <FilaDeFase
            key={fase.id}
            fase={fase}
            estado={estado}
            expandida={expandidas.has(fase.id)}
            solapada={solapadas.has(fase.id)}
            guardando={guardando}
            tareas={fase.task_ids
              .map((id) => tareasPorId.get(id))
              .filter((t): t is NonNullable<typeof t> => Boolean(t) && !t?.fase_manual)}
            onToggle={() => alternar(fase.id)}
            onRango={(inicio, fin) => void guardarRango(fase.id, inicio, fin)}
            onNuevaActividad={() =>
              void ejecutar(() =>
                apiBitacoraTareaCrear({
                  activity: `Actividad de ${fase.label.toLowerCase()}`,
                  fase: fase.id,
                  start_date: fase.start_date || toISODate(new Date()),
                  end_date: fase.end_date || fase.start_date || toISODate(new Date()),
                }),
              )
            }
            onRecordatorios={(recordatorios) => {
              const declarada = fase.task_ids
                .map((id) => tareasPorId.get(id))
                .find((t) => t?.fase_manual);
              if (!declarada) return;
              void ejecutar(() => apiBitacoraTareaEditar(declarada.id, { reminders: recordatorios }));
            }}
            tareaDeclarada={fase.task_ids.map((id) => tareasPorId.get(id)).find((t) => t?.fase_manual) ?? null}
            onVincular={(tareaId, vinculo) =>
              void ejecutar(() => apiBitacoraVincular("tarea", tareaId, vinculo))
            }
            onDesvincular={(tareaId, destinoTipo, destinoId) =>
              void ejecutar(() => apiBitacoraDesvincular("tarea", tareaId, destinoTipo, destinoId))
            }
          />
        ))}
      </div>

      {panelAvisos.abierto && (
        <div {...panelAvisos.props}>
          <CentroDeAvisos
            control={avisos}
            catalogoFases={estado.catalogo_fases}
            onCerrar={panelAvisos.cerrar}
          />
        </div>
      )}
    </div>
  );
}
