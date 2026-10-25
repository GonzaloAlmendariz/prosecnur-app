import { useMemo, useState, type ReactNode } from "react";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { FileSpreadsheet, ListChecks } from "../../../../../vendor/lucide-react";
import type { MonitoreoSource, MonitoreoState } from "../../../../../api/client";
import { enlaceDeFuente } from "../../../fuentes/enlacesDeFuente";
import type { AcreditacionPhoneSourceContract } from "../TelefonicoSourcesModel";
import { columnasQueSeLeen, filasDeFuentes } from "./fuentesModel";
import "../control/controlTelefonico.css";
import "./insumosTelefonico.css";

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

/**
 * Insumos › Fuentes: qué se lee y de dónde. Arriba, las acciones de siempre
 * (traer de Sheets o Kobo, conectar una fuente) y la cadena del corte; luego
 * cada fuente con su papel, volumen y última lectura, el nombre editable y
 * «Cambiar conexión»; al pie, las columnas que cada pieza espera y la que la
 * fuente declara. Las columnas no se editan desde la app.
 */
export function Fuentes({
  state,
  fuentes,
  contrato,
  acciones,
  cadena,
  onCambiar,
  onRenombrar,
}: {
  state: MonitoreoState | null | undefined;
  fuentes: MonitoreoSource[];
  contrato: AcreditacionPhoneSourceContract;
  /** La franja de lectura y sincronización, con «Conectar fuente». */
  acciones: ReactNode;
  /** La cadena del corte: universo, barrido y encuesta. */
  cadena: ReactNode;
  onCambiar: (sourceId: string) => void;
  onRenombrar: (sourceId: string, nombre: string) => Promise<void>;
}) {
  const filas = useMemo(() => filasDeFuentes(fuentes, contrato), [fuentes, contrato]);
  const columnas = useMemo(() => columnasQueSeLeen(contrato, state), [contrato, state]);
  // Mismo aviso que la lista anterior: «Guardando…» mientras se guarda (en la
  // fila y arriba) y «… actualizado.» al terminar.
  const [mensaje, setMensaje] = useState<{ tono: "info" | "exito" | "error"; texto: string; fuente: string } | null>(null);
  const guardando = mensaje?.tono === "info" ? mensaje.fuente : "";
  const activas = filas.filter((fila) => fila.activa);
  const declaradas = columnas.filter((columna) => columna.declarada).length;

  const renombrar = async (sourceId: string, nombre: string, anterior: string) => {
    setMensaje({ tono: "info", texto: `Guardando ${anterior}…`, fuente: sourceId });
    try {
      await onRenombrar(sourceId, nombre);
      setMensaje({ tono: "exito", texto: `${nombre} actualizado.`, fuente: sourceId });
    } catch (error) {
      setMensaje({ tono: "error", texto: (error as Error).message, fuente: sourceId });
      throw error;
    }
  };

  return (
    <div className="mon-fuentes" data-qa-geometry-group="telefonico-insumos-fuentes" data-qa-geometry-contract="intrinsic">
      {acciones}
      {cadena}

      <section className="mon-ctl-panel mon-fuentes-lista" aria-label="Fuentes del proyecto">
        <header className="mon-insumos-cabecera">
          <strong>Fuentes del proyecto</strong>
          <span>
            {n(activas.length)} {activas.length === 1 ? "activa" : "activas"}
            {filas.length > activas.length ? `, ${n(filas.length - activas.length)} sin usar en el corte` : ""}
          </span>
        </header>
        {mensaje ? (
          <NotaDelModo estado className="mon-fuentes-mensaje" tono={mensaje.tono === "error" ? "error" : mensaje.tono === "exito" ? "exito" : "info"}>
            {mensaje.texto}
          </NotaDelModo>
        ) : null}
        {filas.length ? (
          <ul>
            {filas.map((fila) => {
              const fuente = fuentes.find((item) => item.id === fila.id);
              const enlace = fuente ? enlaceDeFuente(fuente) : null;
              return (
                <li key={fila.id} className={fila.activa ? undefined : "is-apagada"}>
                  <span className="mon-fuentes-icono" aria-hidden="true">
                    {fila.unidad === "filas" ? <FileSpreadsheet size={15} /> : <ListChecks size={15} />}
                  </span>
                  <div className="mon-fuentes-nombre">
                    <div>
                      <b>{fila.papel}</b>
                      <em>{fila.servicio}</em>
                      {fila.activa ? null : <em>Apagada</em>}
                    </div>
                    <input
                      defaultValue={fila.etiqueta}
                      disabled={Boolean(guardando)}
                      aria-label={`Nombre de ${fila.nombre}`}
                      title="Nombre con el que la app muestra esta fuente"
                      onBlur={(event) => {
                        const campo = event.currentTarget;
                        const nombre = campo.value.trim();
                        if (!nombre || nombre === fila.etiqueta) {
                          campo.value = fila.etiqueta;
                          return;
                        }
                        void renombrar(fila.id, nombre, fila.etiqueta).catch(() => { campo.value = fila.etiqueta; });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          event.currentTarget.value = fila.etiqueta;
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    <small>
                      {[fila.nombre !== fila.etiqueta ? fila.nombre : "", fila.detalle !== fila.etiqueta && fila.detalle !== fila.nombre ? fila.detalle : ""].filter(Boolean).join(", ")}
                      {guardando === fila.id
                        ? <em className="mon-fuentes-guardando">Guardando…</em>
                        : enlace?.estado === "enlace"
                          ? <a href={enlace.href} target="_blank" rel="noreferrer" title={enlace.titulo}>Abrir en {fila.servicio}</a>
                          : null}
                    </small>
                  </div>
                  <div className="mon-fuentes-volumen">
                    {/* Sin conteo en la metadata de la fuente no se pinta un guion: la cifra del corte está en la cadena. */}
                    {fila.volumen ? <strong className="is-num">{n(fila.volumen)} {fila.unidad}</strong> : null}
                    <small>{fila.leida === "Sin sync" ? "sin leer" : fila.leida === "Inactiva" ? "no se lee" : `leída el ${fila.leida}`}</small>
                  </div>
                  <button type="button" className="mon-insumos-boton" onClick={() => onCambiar(fila.id)}>
                    Cambiar conexión
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <NotaDelModo tono="aviso" className="mon-fuentes-mensaje">Aún no hay fuentes conectadas. Conecta la hoja de barrido y la encuesta.</NotaDelModo>
        )}
      </section>

      <section className="mon-ctl-panel mon-fuentes-columnas" aria-label="Columnas que se leen" data-qa-geometry-capacity="owned">
        <header className="mon-insumos-cabecera">
          <strong>Columnas que se leen</strong>
          <span title="Declaradas por la fuente. El resto se busca por nombre.">{n(declaradas)} {declaradas === 1 ? "declarada" : "declaradas"}</span>
        </header>
        <div className="mon-fuentes-marco">
          <table className="mon-ctl-tabla mon-fuentes-tabla">
            <thead>
              <tr>
                <th scope="col">Pieza</th>
                <th scope="col">Dato</th>
                <th scope="col">Columna</th>
              </tr>
            </thead>
            <tbody>
              {columnas.map((columna) => (
                <tr key={`${columna.pieza}-${columna.dato}`}>
                  <th scope="row">{columna.pieza}</th>
                  <td>{columna.rotulo}</td>
                  <td>{columna.declarada ? <code>{columna.columna}</code> : <span className="mon-fuentes-por-nombre">se busca por nombre</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
