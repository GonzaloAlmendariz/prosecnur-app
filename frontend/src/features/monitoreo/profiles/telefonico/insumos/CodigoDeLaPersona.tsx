import { useEffect, useState } from "react";
import { Loader2, Save } from "../../../../../vendor/lucide-react";
import { apiMonitoreoSource } from "../../../../../api/monitoreo";
import type { MonitoreoSource, MonitoreoState } from "../../../../../api/client";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { sourcePayloadFromExisting } from "../fuentes/payloadDeFuente";
import { coberturaDe, estadoDelCodigo } from "./codigoDePersonaModel";

const ROTULO_DE_ORIGEN = {
  declarada: "Declarada",
  detectada: "Detectada automáticamente",
  sugerida: "Sugerida por el nombre",
  ninguna: "",
} as const;

/**
 * Insumos › Llave y filtros: en cada fuente de respuestas, la pregunta que trae
 * el código de la persona. Se sugiere por nombre o etiqueta (proGres,
 * CodPulso, código), el equipo confirma y se guarda en la fuente
 * (`declared_person_code_var`) por el mismo guardado que usa la página. El
 * cruce se recalcula al Actualizar.
 */
export function CodigoDeLaPersona({
  fuente,
  state,
  cruce,
  onStateChange,
}: {
  fuente: MonitoreoSource;
  state: MonitoreoState | null | undefined;
  /** Cómo cruzan hoy las efectivas, para mostrar el efecto. */
  cruce: { cruzan: number; total: number };
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const stats = state?.source_metadata?.variables_by_source?.[fuente.id] ?? [];
  const estado = estadoDelCodigo(fuente, stats);
  const [elegida, setElegida] = useState(estado.actual);
  const [envio, setEnvio] = useState<{ guardando: boolean; error: string; hecho: boolean }>({ guardando: false, error: "", hecho: false });
  useEffect(() => setElegida(estado.actual), [estado.actual]);
  const opcion = estado.opciones.find((item) => item.nombre === elegida);
  const cambia = elegida !== String(fuente.declared_person_code_var ?? "");

  const confirmar = async () => {
    if (!elegida) return;
    setEnvio({ guardando: true, error: "", hecho: false });
    try {
      const result = await apiMonitoreoSource(sourcePayloadFromExisting(fuente, {
        declared_person_code_var: elegida,
        declared_person_code_label: opcion?.etiqueta || elegida,
      }));
      onStateChange?.(result.state);
      setEnvio({ guardando: false, error: "", hecho: true });
    } catch (error) {
      setEnvio({ guardando: false, error: (error as Error).message, hecho: false });
    }
  };

  return (
    <section className="mon-ctl-panel mon-codigo-persona" aria-label={`Pregunta con el código de la persona en ${fuente.label || fuente.id}`}>
      <header className="mon-insumos-cabecera">
        <strong>Pregunta con el código de la persona</strong>
        {ROTULO_DE_ORIGEN[estado.origen] ? <span className={`mon-insumos-estado${estado.origen === "declarada" ? " is-encendido" : ""}`}>{ROTULO_DE_ORIGEN[estado.origen]}</span> : null}
        <button
          type="button"
          className="mon-insumos-boton is-primario"
          disabled={!elegida || (!cambia && estado.origen === "declarada") || envio.guardando}
          onClick={() => { void confirmar(); }}
        >
          {envio.guardando ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
          <span>{envio.guardando ? "Guardando…" : "Confirmar pregunta"}</span>
        </button>
      </header>
      <div className="mon-codigo-persona-cuerpo">
        <span className="mon-ctl-antetitulo">{fuente.label || fuente.id}</span>
        {estado.opciones.length ? (
          <select
            value={elegida}
            onChange={(event) => setElegida(event.currentTarget.value)}
            aria-label={`Pregunta con el código de la persona en ${fuente.label || fuente.id}`}
          >
            {elegida ? null : <option value="">Elige la pregunta</option>}
            {elegida && !estado.opciones.some((item) => item.nombre === elegida) ? <option value={elegida}>{elegida}</option> : null}
            {estado.opciones.map((item) => (
              <option key={item.nombre} value={item.nombre}>
                {item.etiqueta ? `${item.etiqueta} (${item.nombre})` : item.nombre}
              </option>
            ))}
          </select>
        ) : (
          <NotaDelModo tono="neutro">La fuente todavía no trae preguntas; actualiza para leerlas.</NotaDelModo>
        )}
        {opcion ? (
          <p className="mon-codigo-persona-detalle">
            {opcion.ejemplos.length ? <>Ejemplos: <b>{opcion.ejemplos.join(", ")}</b>. </> : null}
            {coberturaDe(opcion)}
          </p>
        ) : null}
        <p className="mon-codigo-persona-detalle">
          Hoy cruzan {cruce.cruzan.toLocaleString("es-PE")} de {cruce.total.toLocaleString("es-PE")} efectivas.
          {envio.hecho ? " Pregunta guardada: el cruce se recalcula al Actualizar." : cambia && elegida ? " Al confirmar, el cruce se recalcula al Actualizar." : ""}
        </p>
        {envio.error ? <NotaDelModo tono="error" estado>{envio.error}</NotaDelModo> : null}
      </div>
    </section>
  );
}
