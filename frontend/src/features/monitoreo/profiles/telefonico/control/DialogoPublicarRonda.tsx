import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Upload, X } from "../../../../../vendor/lucide-react";
import { apiSupervisionPublicarRonda, type RondaDeSupervisionApi } from "../../../../../api/monitoreoTelefonico";
import type { MonitoreoSource, MonitoreoState } from "../../../../../api/client";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { useDialogoDeRonda } from "./useDialogoDeRonda";
import "../insumos/insumosTelefonico.css";
import "./supervision.css";
import { mensajeDeError } from "./rondasModel";

/**
 * «Publicar en el Sheets» de una ronda: qué preguntas de control de Kobo van
 * como columnas, el aviso de que se crea la pestaña «Ronda N» sin tocar
 * ninguna otra y, sin hoja de supervisión conectada, el camino a Fuentes.
 */
export function DialogoPublicarRonda({
  numero,
  hoja,
  preguntas,
  onCerrar,
  onIrAFuentes,
  onHecha,
}: {
  numero: number;
  hoja: MonitoreoSource | null;
  /** Preguntas de la encuesta de Kobo: nombre y etiqueta. */
  preguntas: ReadonlyArray<{ nombre: string; etiqueta: string }>;
  onCerrar: () => void;
  onIrAFuentes: () => void;
  onHecha: (rondas: RondaDeSupervisionApi[], state: MonitoreoState) => void;
}) {
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [envio, setEnvio] = useState<{ guardando: boolean; error: string }>({ guardando: false, error: "" });

  const publicar = async () => {
    setEnvio({ guardando: true, error: "" });
    try {
      const resultado = await apiSupervisionPublicarRonda({ numero, preguntas: elegidas });
      onHecha(resultado.rondas, resultado.state);
    } catch (error) {
      setEnvio({ guardando: false, error: mensajeDeError(error) });
    }
  };

  const raiz = useDialogoDeRonda<HTMLElement>(onCerrar);

  return createPortal((
    <div className="mon-sup-dialogo-fondo" onMouseDown={(event) => { if (event.target === event.currentTarget) onCerrar(); }}>
      <section ref={raiz} tabIndex={-1} className="mon-sup-dialogo" role="dialog" aria-modal="true" aria-labelledby="mon-sup-publicar-titulo">
        <header>
          <h2 id="mon-sup-publicar-titulo">Publicar la Ronda {numero.toLocaleString("es-PE")} en el Sheets</h2>
          <button type="button" className="mon-sup-cerrar" aria-label="Cerrar" onClick={onCerrar}><X size={16} /></button>
        </header>
        <div className="mon-sup-dialogo-cuerpo">
          {hoja ? (
            <>
              <NotaDelModo tono="info">
                Se crea la pestaña «Ronda {numero.toLocaleString("es-PE")}» en «{hoja.label || hoja.id}». No se toca ninguna otra pestaña de la hoja.
              </NotaDelModo>
              <fieldset className="mon-sup-preguntas">
                <legend>Preguntas de control de Kobo que van como columnas</legend>
                {preguntas.length ? preguntas.map((pregunta) => (
                  <label key={pregunta.nombre}>
                    <input
                      type="checkbox"
                      checked={elegidas.includes(pregunta.nombre)}
                      onChange={(event) => {
                        const marcada = event.currentTarget.checked;
                        setElegidas((actual) => (marcada ? [...actual, pregunta.nombre] : actual.filter((item) => item !== pregunta.nombre)));
                      }}
                    />
                    <span>{pregunta.etiqueta || pregunta.nombre}{pregunta.etiqueta ? <small> ({pregunta.nombre})</small> : null}</span>
                  </label>
                )) : <p>La encuesta todavía no trae preguntas; actualiza para leerlas.</p>}
              </fieldset>
            </>
          ) : (
            <NotaDelModo tono="aviso">
              No hay hoja de supervisión conectada. Conéctala en Insumos, Fuentes, con el papel de supervisión, y vuelve a publicar.
            </NotaDelModo>
          )}
          {envio.error ? <NotaDelModo tono="error" estado>{envio.error}</NotaDelModo> : null}
        </div>
        <footer>
          <button type="button" className="mon-insumos-boton" onClick={onCerrar}>Cancelar</button>
          {hoja ? (
            <button type="button" className="mon-insumos-boton is-primario" disabled={envio.guardando} onClick={() => { void publicar(); }}>
              {envio.guardando ? <Loader2 size={14} className="pulso-spin" /> : <Upload size={14} />}
              <span>{envio.guardando ? "Publicando…" : `Crear la pestaña «Ronda ${numero.toLocaleString("es-PE")}»`}</span>
            </button>
          ) : (
            <button type="button" className="mon-insumos-boton is-primario" onClick={onIrAFuentes}>Ir a Fuentes</button>
          )}
        </footer>
      </section>
    </div>
  ), document.body);
}
