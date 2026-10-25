import type { ReactNode } from "react";
import { CheckCircle2 } from "../../../../../vendor/lucide-react";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import { RotuloDePestana, useHayRotulo } from "../navegacion/RotuloDePestana";
import "./controlTelefonico.css";

/** Una efectiva de Kobo que no se pudo identificar, ya en palabras. */
export type FilaDeSalvedad = {
  id: string;
  fecha: string;
  codigo: string;
  responsable: string;
  kobo: string;
  fuente: string;
  hojaDice: string;
  queHacer: string;
};

const TOPE = 80;

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

/**
 * Control › Respuestas › Salvedades (`panel=salvedades`): las efectivas de Kobo
 * que cuentan pero no se pudieron identificar en la hoja. §2a-bis: el rótulo de
 * la pestaña y el selector de sub-vista encabezan la tarjeta de la lista; la
 * ficha del caso va a la derecha, en la suya. El vacío es de la tarjeta y dice
 * por qué (C3).
 */
export function Salvedades({
  filas,
  elegida,
  revisadas,
  onElegir,
  detalle,
}: {
  filas: readonly FilaDeSalvedad[];
  elegida: string | null;
  /** Efectivas revisadas con los filtros activos (para el vacío). */
  revisadas: number;
  onElegir: (id: string) => void;
  /** Ficha del caso elegido (la de siempre). */
  detalle: ReactNode;
}) {
  const hayRotulo = useHayRotulo();
  const cabecera = (
    <header className="mon-ctl-panel-cabecera mon-salvedades-cabecera">
      {hayRotulo ? <RotuloDePestana sinChips /> : null}
      <b>Efectivas no identificables</b>
      <span className="mon-tel-chip">{n(filas.length)} {filas.length === 1 ? "caso" : "casos"}</span>
    </header>
  );

  if (!filas.length) {
    return (
      <div className="mon-salvedades is-vacia" data-qa-geometry-group="telefonico-control-salvedades" data-qa-geometry-contract="intrinsic">
        <section className="mon-ctl-panel mon-salvedades-lista" aria-label="Salvedades" data-qa-geometry-capacity="owned">
          {cabecera}
          <EstadoVacio
            tamano="normal"
            icono={<CheckCircle2 size={22} />}
            titulo="Sin efectivas con salvedad"
            descripcion={`Las ${n(revisadas)} efectivas revisadas con los filtros activos se identifican en la hoja. Si alguna deja de cruzar, aparece aquí con su CodPulso, su responsable y lo que dice la hoja.`}
          />
        </section>
      </div>
    );
  }

  const visibles = filas.slice(0, TOPE);
  return (
    <div className="mon-salvedades" data-qa-geometry-group="telefonico-control-salvedades" data-qa-geometry-contract="intrinsic">
      <section className="mon-ctl-panel mon-salvedades-lista" aria-label="Efectivas con salvedad" data-qa-geometry-capacity="owned">
        {cabecera}
        <div className="mon-ctl-tabla-marco">
          <table className="mon-ctl-tabla mon-salvedades-tabla">
            <thead>
              <tr>
                <th scope="col">CodPulso</th>
                <th scope="col">Envío</th>
                <th scope="col">Responsable</th>
                <th scope="col">Kobo</th>
                <th scope="col">La hoja dice</th>
                <th scope="col">Qué hacer</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila) => {
                const activa = fila.id === elegida;
                return (
                  <tr key={fila.id} className={activa ? "is-activo" : undefined} aria-current={activa ? "true" : undefined}>
                    <th scope="row">
                      <button type="button" className="mon-salvedades-codigo" onClick={() => onElegir(fila.id)}>{fila.codigo}</button>
                    </th>
                    <td className="is-num">{fila.fecha || "—"}</td>
                    <td>{fila.responsable}</td>
                    <td title={fila.fuente || undefined}>{fila.kobo}</td>
                    <td>{fila.hojaDice}</td>
                    <td>{fila.queHacer}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filas.length > visibles.length ? (
          <footer className="mon-respuestas-pie">{n(visibles.length)} de {n(filas.length)} salvedades; usa los filtros para acotar</footer>
        ) : null}
      </section>
      {detalle}
    </div>
  );
}
