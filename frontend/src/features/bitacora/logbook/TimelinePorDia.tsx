import { useMemo, useState } from "react";
import { Archive, History, Pencil, Trash2 } from "../../../vendor/lucide-react";

import type { DisenoEstudioBitacoraEntry } from "../../../api/disenoEstudio";
import { EmptyState } from "../../../components/States";
import { identidadDeFase } from "../identidadDeFase";
import { etiquetaModulo, etiquetaTono } from "./gramatica";
import { HistorialEntrada } from "./HistorialEntrada";

/**
 * Timeline agrupada por día (ADR 0047).
 *
 * Una bitácora se lee por jornadas: "qué pasó el martes" es la pregunta real,
 * y una lista corrida de cincuenta entradas no la responde.
 */
export function TimelinePorDia({
  entradas,
  onEditar,
  onArchivar,
  onPurgar,
}: {
  entradas: DisenoEstudioBitacoraEntry[];
  onEditar: (entrada: DisenoEstudioBitacoraEntry) => void;
  onArchivar: (entrada: DisenoEstudioBitacoraEntry) => void;
  onPurgar: (entrada: DisenoEstudioBitacoraEntry) => void;
}) {
  const [historialAbierto, setHistorialAbierto] = useState<string | null>(null);

  const dias = useMemo(() => {
    const mapa = new Map<string, DisenoEstudioBitacoraEntry[]>();
    for (const e of entradas) {
      const dia = diaLocal(e.occurred_at);
      const lista = mapa.get(dia);
      if (lista) lista.push(e);
      else mapa.set(dia, [e]);
    }
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entradas]);

  if (entradas.length === 0) {
    return (
      <EmptyState
        icon={<History size={26} aria-hidden="true" />}
        title="La bitácora está vacía"
        hint="Registra decisiones, riesgos y bloqueos mientras pasan. Escribe arriba y pulsa Enter: lo que anotes acá es lo que vas a agradecer tener cuando toque explicar el estudio."
      />
    );
  }

  return (
    <div className="bit-timeline" data-qa-geometry-capacity="owned">
      {dias.map(([dia, delDia]) => (
        <section key={dia} className="bit-timeline-dia" aria-label={etiquetaDia(dia)}>
          <h3 className="bit-timeline-fecha">
            <span>{etiquetaDia(dia)}</span>
            <small>{delDia.length}</small>
          </h3>
          <ul className="bit-timeline-lista">
            {delDia.map((entrada) => (
              <li
                key={entrada.id}
                className={`bit-entrada is-${entrada.tone}${entrada.archived_at ? " is-archivada" : ""}`}
              >
                <Sello moduloId={entrada.module_id} />
                <div className="bit-entrada-cuerpo">
                  <div className="bit-entrada-meta">
                    <span className={`bit-chip is-tono is-${entrada.tone}`}>{etiquetaTono(entrada.tone)}</span>
                    <span className="bit-entrada-modulo">{etiquetaModulo(entrada.module_id)}</span>
                    <span className="bit-entrada-hora">{hora(entrada.occurred_at)}</span>
                    {(entrada.revisions?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        className="bit-entrada-editada"
                        onClick={() =>
                          setHistorialAbierto(historialAbierto === entrada.id ? null : entrada.id)
                        }
                        aria-expanded={historialAbierto === entrada.id}
                      >
                        <History size={11} />
                        <span>
                          editada {entrada.revisions!.length}{" "}
                          {entrada.revisions!.length === 1 ? "vez" : "veces"}
                        </span>
                      </button>
                    )}
                  </div>
                  <strong>{entrada.title}</strong>
                  {entrada.body && <p>{entrada.body}</p>}
                  {entrada.tags.length > 0 && (
                    <div className="bit-entrada-etiquetas">
                      {entrada.tags.map((t) => (
                        <span key={t} className="bit-chip is-etiqueta">#{t}</span>
                      ))}
                    </div>
                  )}
                  {historialAbierto === entrada.id && <HistorialEntrada entrada={entrada} />}
                </div>
                <div className="bit-entrada-acciones">
                  <button type="button" onClick={() => onEditar(entrada)} title="Editar" aria-label={`Editar ${entrada.title}`}>
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onArchivar(entrada)}
                    title={entrada.archived_at ? "Restaurar" : "Archivar"}
                    aria-label={`${entrada.archived_at ? "Restaurar" : "Archivar"} ${entrada.title}`}
                  >
                    <Archive size={13} />
                  </button>
                  {/* Borrar es la excepción y por eso pide confirmación en el
                      llamador: una bitácora que se puede vaciar de un clic deja
                      de servir como registro. */}
                  <button type="button" onClick={() => onPurgar(entrada)} title="Borrar" aria-label={`Borrar ${entrada.title}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Sello({ moduloId }: { moduloId: string }) {
  // Las entradas se etiquetan con módulos que a veces son secciones
  // (`carga`, `validacion`): se resuelve primero como módulo y, si no existe,
  // como sección de Procesamiento, que es donde viven todas ellas.
  const directa = identidadDeFase(moduloId);
  const identidad = directa.modulo ? directa : identidadDeFase("procesamiento", moduloId);
  const Icono = identidad.icono;
  return (
    <span className="bit-entrada-sello" style={identidad.vars} aria-hidden="true">
      {Icono ? <Icono size={14} /> : null}
    </span>
  );
}

const FORMATO_DIA = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const FORMATO_HORA = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Día LOCAL de una marca ISO.
 *
 * `occurred_at.slice(0, 10)` toma el día UTC, y con eso una entrada de las
 * 20:21 del 28 aparecía bajo el 29 mientras su hora seguía diciendo 20:21.
 * Agrupar por un día y mostrar la hora de otro es la trampa de husos que el
 * ADR 0047 nombra: las dos cosas tienen que salir del mismo reloj.
 */
function diaLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sin-fecha";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function etiquetaDia(dia: string): string {
  if (dia === "sin-fecha") return "Sin fecha";
  const d = new Date(`${dia}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dia;
  const hoy = new Date();
  const mismoDia =
    d.getFullYear() === hoy.getFullYear() &&
    d.getMonth() === hoy.getMonth() &&
    d.getDate() === hoy.getDate();
  if (mismoDia) return "Hoy";
  const texto = FORMATO_DIA.format(d);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function hora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : FORMATO_HORA.format(d);
}
