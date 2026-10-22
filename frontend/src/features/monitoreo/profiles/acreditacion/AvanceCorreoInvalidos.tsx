import { useId, useMemo, useState } from "react";

import type { MonitoreoMailchimpEnvio, MonitoreoMailchimpInvalidos } from "../../../../api/monitoreoMailchimp";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PulsoButton } from "../../../../components/PulsoButton";
import { ChevronLeft, ChevronRight, Inbox } from "../../../../vendor/lucide-react";
import { fechaCompleta } from "./avanceCorreoMatriz";
import { cifra, motivoInvalido, paginar, porcentaje } from "./avanceCorreoModelo";
import { clasePublico, type PaletaDePublicos } from "./paletaPublicos";

// Avance › Correo › Correos inválidos: total, reparto por público en una barra
// apilada con el color de cada público y la lista por token, paginada (el
// panel es el único dueño del scroll). Ningún correo viaja: solo tokens.

const POR_PAGINA = 15;

export function AvanceCorreoInvalidos({
  invalidos,
  envios,
  paleta,
}: {
  invalidos: MonitoreoMailchimpInvalidos;
  envios: MonitoreoMailchimpEnvio[];
  paleta: PaletaDePublicos;
}) {
  const base = useId();
  const [pagina, setPagina] = useState(1);
  const titulos = useMemo(
    () => new Map(envios.map((e) => [e.campaign_id, e.titulo || e.campaign_id])),
    [envios],
  );
  const vista = paginar(invalidos.filas, pagina, POR_PAGINA);
  const total = invalidos.total ?? invalidos.filas.length;
  const reparto = [...invalidos.por_actor].filter((a) => (a.n ?? 0) > 0).sort((a, b) => (b.n ?? 0) - (a.n ?? 0));
  const sumaReparto = reparto.reduce((n, a) => n + (a.n ?? 0), 0);

  return (
    <section className="mon-correo-bloque" aria-labelledby={`${base}-titulo`}>
      <header className="mon-correo-bloque-cabeza">
        <div>
          <h3 id={`${base}-titulo`}>Correos inválidos <span className="mon-correo-cuenta">{cifra(total)}</span></h3>
          <p className="mon-correo-bloque-meta">Rebote duro o dado de baja por Mailchimp · fuera de la base alcanzable</p>
        </div>
      </header>
      {sumaReparto > 0 ? (
        <div className="mon-correo-reparto">
          <span className="mon-correo-reparto-barra" role="img" aria-label={`Reparto por público: ${reparto.map((a) => `${a.actor} ${cifra(a.n)}`).join("; ")}`}>
            {reparto.map((a) => (
              <i
                key={a.actor}
                className={clasePublico(paleta, a.actor)}
                style={{ flexGrow: a.n ?? 0 }}
                title={`${a.actor}: ${cifra(a.n)} · ${porcentaje((a.n ?? 0) / sumaReparto)}`}
              />
            ))}
          </span>
          <ul
            className="mon-correo-reparto-leyenda"
            data-qa-geometry-group="monitoreo/acreditacion/avance/correo/invalidos-reparto"
            data-qa-geometry-contract="intrinsic"
          >
            {reparto.map((a) => (
              <li key={a.actor} className={clasePublico(paleta, a.actor)}>
                <i className="mon-publico-punto" aria-hidden />
                <span>{a.actor}</span>
                <strong>{cifra(a.n)}</strong>
                <small>{porcentaje((a.n ?? 0) / sumaReparto)}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {vista.total ? (
        <>
          <div className="mon-correo-tabla-marco">
            <table className="mon-correo-tabla mon-correo-invalidos">
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
                    <td>
                      <span className={`mon-correo-publico-celda ${clasePublico(paleta, f.actor || "Fuera del universo")}`}>
                        <i className="mon-publico-punto" aria-hidden />
                        {f.actor || "Fuera del universo"}
                      </span>
                    </td>
                    <td><span className={`mon-correo-motivo es-${f.motivo || "otro"}`}>{motivoInvalido(f.motivo)}</span></td>
                    <td>{f.campaign_id ? titulos.get(f.campaign_id) ?? f.campaign_id : "—"}</td>
                    <td className="is-fecha">{f.fecha ? fechaCompleta(f.fecha) : "—"}</td>
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
