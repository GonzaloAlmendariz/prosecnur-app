import { useId, useMemo, useState } from "react";

import type { MonitoreoMailchimpEnvio, MonitoreoMailchimpInvalidos } from "../../../../api/monitoreoMailchimp";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PulsoButton } from "../../../../components/PulsoButton";
import { ChevronLeft, ChevronRight, Inbox } from "../../../../vendor/lucide-react";
import { cifra, motivoInvalido, paginar } from "./avanceCorreoModelo";
import { formatDate } from "./formato";

// Avance › Correo › Correos inválidos. Paginado, sin scroll propio: el dueño
// del scroll es el panel (No Scroll Jail). Solo tokens: ningún correo viaja.

const POR_PAGINA = 20;

export function AvanceCorreoInvalidos({
  invalidos,
  envios,
}: {
  invalidos: MonitoreoMailchimpInvalidos;
  envios: MonitoreoMailchimpEnvio[];
}) {
  const base = useId();
  const [pagina, setPagina] = useState(1);
  const titulos = useMemo(
    () => new Map(envios.map((e) => [e.campaign_id, e.titulo || e.campaign_id])),
    [envios],
  );
  const vista = paginar(invalidos.filas, pagina, POR_PAGINA);
  const total = invalidos.total ?? invalidos.filas.length;

  return (
    <section className="mon-correo-bloque" aria-labelledby={`${base}-titulo`}>
      <header className="mon-correo-bloque-cabeza">
        <div>
          <h3 id={`${base}-titulo`}>Correos inválidos · {cifra(total)}</h3>
          <p>No cuentan como «no respondió»: salen de la base alcanzable.</p>
        </div>
      </header>
      {invalidos.por_actor.length ? (
        <ul className="mon-correo-chips" aria-label="Correos inválidos por público">
          {invalidos.por_actor.map((a) => (
            <li key={a.actor}><span>{a.actor}</span><strong>{cifra(a.n)}</strong></li>
          ))}
        </ul>
      ) : null}
      {vista.total ? (
        <>
          <div className="mon-correo-tabla-marco">
            <table className="mon-correo-tabla">
              <thead>
                <tr>
                  <th scope="col">Token</th>
                  <th scope="col">Público</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Envío</th>
                  <th scope="col">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {vista.filas.map((f, i) => (
                  <tr key={`${f.token}-${f.campaign_id}-${i}`}>
                    <th scope="row" className="is-token">{f.token || "—"}</th>
                    <td>{f.actor || "Fuera del universo"}</td>
                    <td>{motivoInvalido(f.motivo)}</td>
                    <td>{f.campaign_id ? titulos.get(f.campaign_id) ?? f.campaign_id : "—"}</td>
                    <td className="is-fecha">{f.fecha ? formatDate(f.fecha) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {vista.paginas > 1 ? (
            <nav className="mon-correo-paginas" aria-label="Páginas de correos inválidos">
              <PulsoButton variant="secondary" size="sm" disabled={vista.pagina <= 1} onClick={() => setPagina(vista.pagina - 1)}>
                <ChevronLeft size={14} aria-hidden /> Anterior
              </PulsoButton>
              <span aria-live="polite">{cifra(vista.desde)}–{cifra(vista.hasta)} de {cifra(vista.total)}</span>
              <PulsoButton variant="secondary" size="sm" disabled={vista.pagina >= vista.paginas} onClick={() => setPagina(vista.pagina + 1)}>
                Siguiente <ChevronRight size={14} aria-hidden />
              </PulsoButton>
            </nav>
          ) : null}
        </>
      ) : (
        <EstadoVacio
          icono={<Inbox size={16} />}
          titulo="Sin correos inválidos"
          descripcion="Ningún destinatario rebotó ni fue dado de baja por Mailchimp."
        />
      )}
    </section>
  );
}
