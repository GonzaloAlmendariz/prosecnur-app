import { X } from "lucide-react";
import type { CasoDeCola } from "../colaDeInsistenciaModel";
import { fechaDeCola } from "../colaDeInsistenciaModel";
import { telefonoDelCaso } from "./TablaDeCola";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="mon-cola-dato">
      <dt>{etiqueta}</dt>
      <dd>{valor || "—"}</dd>
    </div>
  );
}

/**
 * Ficha del caso: lo que dice la hoja de barrido, su observación literal y lo
 * que se sabe de Kobo. Lo que la hoja no registra se dice, no se dibuja: va
 * como un bloque más, en el flujo, y la ficha toma su alto natural (§2a-bis:
 * sin nota flotando sobre un hueco).
 */
export function FichaDelCaso({
  caso,
  etiquetaCategoria,
  corte,
  cerrable,
  onCerrar,
  panelProps,
  plataforma = "Kobo",
  vacia = "Elige un caso de la cola.",
}: {
  /** Plataforma de las respuestas; Telefónico lee Kobo. */
  plataforma?: string;
  caso: CasoDeCola | null;
  /** Qué decir sin caso en la ficha. */
  vacia?: string;
  etiquetaCategoria: string;
  /** Fecha del corte, ya corta («27/07»). */
  corte: string;
  cerrable: boolean;
  onCerrar: () => void;
  panelProps: { "data-pulso-panel": string };
}) {
  if (!caso) {
    return (
      <aside className="mon-cola-panel mon-cola-ficha is-vacia" aria-label="Ficha del caso" data-qa-geometry-capacity="owned" {...panelProps}>
        <span className="mon-cola-antetitulo">Ficha del caso</span>
        <p>{vacia}</p>
      </aside>
    );
  }
  const telefono = telefonoDelCaso(caso);
  const dias = caso.diasSinRegistro;
  return (
    <aside className="mon-cola-panel mon-cola-ficha" aria-label={`Ficha del caso ${caso.codigo}`} {...panelProps}>
      <header className="mon-cola-ficha-cabecera">
        <span className="mon-cola-antetitulo">Ficha del caso</span>
        <span className="mon-cola-ficha-titulo">
          <b>{caso.codigo}</b>
          {caso.intentos != null ? (
            <span className="mon-cola-ficha-chip">
              {caso.intentos.toLocaleString("es-PE")} {caso.intentos === 1 ? "intento" : "intentos"} en la hoja
            </span>
          ) : null}
        </span>
        {caso.cuota ? <span className="mon-cola-ficha-sub">{caso.cuota}</span> : null}
        {cerrable ? (
          <button type="button" className="mon-cola-ficha-cerrar" aria-label="Cerrar la ficha" onClick={onCerrar}>
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </header>
      <section className="mon-cola-ficha-bloque">
        <span className="mon-cola-antetitulo">Lo que dice la hoja de barrido</span>
        <dl>
          <Dato etiqueta="Responsable" valor={caso.sinAsignar ? "Sin asignar" : caso.responsable} />
          <Dato etiqueta={etiquetaCategoria} valor={caso.cuota} />
          {caso.origen != null ? <Dato etiqueta="Origen" valor={caso.origen} /> : null}
          <Dato etiqueta="Último resultado" valor={caso.status} />
          <Dato etiqueta="Intentos" valor={caso.intentos == null ? "Sin dato" : caso.intentos.toLocaleString("es-PE")} />
          <Dato etiqueta="Fecha" valor={fechaDeCola(caso.fecha) || "Sin fecha"} />
          {telefono ? <Dato etiqueta="Teléfono en uso" valor={telefono} /> : null}
          {caso.telefonosIntentados ? <Dato etiqueta="Teléfonos intentados" valor={caso.telefonosIntentados} /> : null}
        </dl>
      </section>
      <section className="mon-cola-ficha-bloque">
        <span className="mon-cola-antetitulo">Observación</span>
        <p className={caso.observacion ? "mon-cola-ficha-observacion" : "mon-cola-ficha-observacion is-vacia"}>
          {caso.observacion ? `“${caso.observacion}”` : "Sin observación"}
        </p>
      </section>
      <section className="mon-cola-ficha-bloque">
        <span className="mon-cola-antetitulo">{`${plataforma} y tiempos`}</span>
        <dl>
          <Dato etiqueta={`Envío en ${plataforma}`} valor={caso.efectivaKobo ? "Efectiva" : "Sin efectiva"} />
          <Dato
            etiqueta="Días sin registro"
            valor={dias == null ? "Sin fecha" : dias < 0 ? `fecha posterior al corte del ${corte}` : `${dias.toLocaleString("es-PE")} al corte del ${corte}`}
          />
        </dl>
      </section>
      <section className="mon-cola-ficha-bloque mon-cola-ficha-nota">
        <span className="mon-cola-antetitulo">Lo que la hoja no registra</span>
        <p>La fecha y el resultado de cada intento, la hora y el número marcado. Por eso la ficha no muestra historia de llamadas.</p>
      </section>
      <footer className="mon-cola-ficha-pie">
        El supervisor decide si se sigue insistiendo. La asignación se cambia en la hoja del equipo; Monitoreo la lee al actualizar.
      </footer>
    </aside>
  );
}
