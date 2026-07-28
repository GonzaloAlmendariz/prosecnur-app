import { useMemo, useState } from "react";
import { CalendarPlus, Flag, Loader2, Sparkles } from "../../../vendor/lucide-react";

import {
  apiBitacoraSembrarFases,
  apiBitacoraTareaCrear,
  apiBitacoraTareaEditar,
  type BitacoraEstado,
  type BitacoraFase,
} from "../../../api/bitacora";
import { Alert } from "../../../components/Alert";
import { toISODate } from "../dateUtils";
import { FilaDeFase } from "./FilaDeFase";
import { etiquetaRango, fasesSolapadas, rangoDelEstudio } from "./fases";

/**
 * Vista de entrada del cronograma (ADR 0047).
 *
 * La unidad que el usuario crea es el RANGO DE FECHAS DE UNA FASE, elegida de
 * las seis del catálogo. Antes el cronograma era el espejo de un Excel y el
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

        {/* El recorrido se muestra, no se describe: seis fases en fila dicen de
            un vistazo lo que un párrafo tarda cuatro líneas en explicar. */}
        <ol className="bit-riel" aria-label="Las seis fases de un estudio">
          {estado.catalogo_fases.map((f, i) => (
            <li key={f.id} className="bit-riel-paso">
              <span className="bit-riel-punto" aria-hidden="true">{i + 1}</span>
              <span className="bit-riel-nombre">{f.label}</span>
            </li>
          ))}
        </ol>

        <p>Pones dos fechas por fase. El resto lo arma la app.</p>

        {error && <Alert kind="error">{error}</Alert>}
        <div className="bit-compositor-vacio-acciones">
          <button
            type="button"
            className="bit-boton bit-boton--primario"
            disabled={guardando}
            onClick={() => void ejecutar(() => apiBitacoraSembrarFases())}
          >
            {guardando ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            <span>Sembrar las seis fases</span>
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

      <div
        className="bit-compositor-fases"
        data-qa-geometry-group="bitacora-fases"
        data-qa-geometry-contract="equal"
      >
        {estado.fases.map((fase) => (
          <FilaDeFase
            key={fase.id}
            fase={fase}
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
          />
        ))}
      </div>
    </div>
  );
}
