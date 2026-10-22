import { Fragment, useId, useMemo, useState } from "react";

import type { MonitoreoMailchimpEnvio } from "../../../../api/monitoreoMailchimp";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { ChevronDown, ChevronRight, Send } from "../../../../vendor/lucide-react";
import { fechaCompleta } from "./avanceCorreoMatriz";
import {
  cifra,
  enviosOrdenados,
  etiquetaTipoEnvio,
  filtrarEnvios,
  porcentaje,
  tieneDesglose,
} from "./avanceCorreoModelo";
import { clasePublico, type PaletaDePublicos } from "./paletaPublicos";

// Avance › Correo › Detalle de envíos. Columnas agrupadas en Entrega,
// Interacción y Salida; las tasas, sobre entregados, en tipografía secundaria.
// Las aperturas del envío son sin Apple; en el desglose por público, con Apple
// (Mailchimp no las separa por persona). Un envío que tocó a varios públicos
// se despliega con su desglose.

const COLUMNAS = 13;

function CifraYTasa({ n, tasa }: { n: number | null; tasa?: number | null }) {
  return (
    <>
      <span>{cifra(n)}</span>
      {tasa !== undefined ? <small>{porcentaje(tasa)}</small> : null}
    </>
  );
}

function DesgloseEnvio({ envio, id, paleta }: { envio: MonitoreoMailchimpEnvio; id: string; paleta: PaletaDePublicos }) {
  return (
    <>
      {envio.por_actor.map((a, i) => (
        <tr key={a.actor} id={i === 0 ? id : undefined} className={`mon-correo-desglose ${clasePublico(paleta, a.actor)}`}>
          <td />
          <th scope="row" colSpan={3} className="mon-correo-desglose-publico">
            <i className="mon-publico-punto" aria-hidden />
            {a.actor}
          </th>
          <td className="is-num es-grupo"><CifraYTasa n={a.enviados} /></td>
          <td className="is-num"><CifraYTasa n={a.entregados} /></td>
          <td className="is-num">{cifra(a.rebotes_duros)} · {cifra(a.rebotes_blandos)}</td>
          <td className="is-num es-grupo" title="Con las aperturas automáticas de Apple"><CifraYTasa n={a.aperturas} tasa={a.tasa_apertura} /></td>
          <td className="is-num"><CifraYTasa n={a.clics} tasa={a.tasa_clic} /></td>
          <td className="is-num es-grupo"><CifraYTasa n={a.bajas} tasa={a.tasa_baja} /></td>
          <td className="is-num"><CifraYTasa n={a.quejas} tasa={a.tasa_queja} /></td>
          <td className="is-num es-fuerte">{cifra(a.respuestas)}</td>
          <td colSpan={COLUMNAS - 12} />
        </tr>
      ))}
    </>
  );
}

export function AvanceCorreoEnvios({
  envios,
  publico,
  paleta,
}: {
  envios: MonitoreoMailchimpEnvio[];
  publico: string;
  paleta: PaletaDePublicos;
}) {
  const base = useId();
  const [abiertos, setAbiertos] = useState<ReadonlySet<string>>(() => new Set());
  const visibles = useMemo(() => enviosOrdenados(filtrarEnvios(envios, publico)), [envios, publico]);

  const alternar = (id: string) => setAbiertos((prev) => {
    const sig = new Set(prev);
    if (sig.has(id)) sig.delete(id); else sig.add(id);
    return sig;
  });

  return (
    <section className="mon-correo-bloque" aria-labelledby={`${base}-titulo`}>
      <header className="mon-correo-bloque-cabeza">
        <div>
          <h3 id={`${base}-titulo`}>Detalle de envíos</h3>
          <p className="mon-correo-bloque-meta">
            {publico ? <><i className={`mon-publico-punto ${clasePublico(paleta, publico)}`} aria-hidden /> {publico} · </> : null}
            {cifra(visibles.length)} de {cifra(envios.length)} · tasas sobre entregados
          </p>
        </div>
      </header>
      {visibles.length ? (
        <div className="mon-correo-tabla-marco">
          <table className="mon-correo-tabla mon-correo-envios">
            <thead>
              <tr className="mon-correo-grupos">
                <td colSpan={4} />
                <th scope="colgroup" colSpan={3} className="es-grupo">Entrega</th>
                <th scope="colgroup" colSpan={2} className="es-grupo">Interacción</th>
                <th scope="colgroup" colSpan={3} className="es-grupo">Salida</th>
                <td />
              </tr>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Envío</th>
                <th scope="col">Tipo</th>
                <th scope="col">Público</th>
                <th scope="col" className="is-num es-grupo">Enviados</th>
                <th scope="col" className="is-num">Entregados</th>
                <th scope="col" className="is-num">Rebotes duros · blandos</th>
                <th scope="col" className="is-num es-grupo">Abrieron</th>
                <th scope="col" className="is-num">Clics</th>
                <th scope="col" className="is-num es-grupo">Bajas</th>
                <th scope="col" className="is-num">Quejas</th>
                <th scope="col" className="is-num">Respuestas</th>
                <th scope="col"><span className="pulso-sr-only">Desglose</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((e) => {
                const desglosable = tieneDesglose(e);
                const abierto = desglosable && abiertos.has(e.campaign_id);
                const idDesglose = `${base}-desglose-${e.campaign_id}`;
                return (
                  <Fragment key={e.campaign_id}>
                    <tr className={`${clasePublico(paleta, e.actor)}${abierto ? " is-abierta" : ""}`}>
                      <td className="is-fecha">
                        {e.enviado_at ? fechaCompleta(e.enviado_at) : "—"}
                      </td>
                      <th scope="row" className="mon-correo-envio">
                        <span>{e.titulo || e.campaign_id}</span>
                        {e.asunto ? <small>{e.asunto}</small> : null}
                      </th>
                      <td>
                        <span className="mon-correo-tipo">
                          <i className={`mon-correo-nodo-forma es-${e.tipo}`} aria-hidden />
                          {etiquetaTipoEnvio(e)}
                        </span>
                      </td>
                      <td>
                        <span className="mon-correo-publico-celda">
                          <i className="mon-publico-punto" aria-hidden />
                          {e.actor || "—"}
                        </span>
                        {desglosable ? <small>{cifra(e.por_actor.length)} públicos</small> : null}
                      </td>
                      <td className="is-num es-grupo"><CifraYTasa n={e.enviados} /></td>
                      <td className="is-num"><CifraYTasa n={e.entregados} /></td>
                      <td className="is-num">{cifra(e.rebotes_duros)} · {cifra(e.rebotes_blandos)}</td>
                      <td className="is-num es-grupo"><CifraYTasa n={e.aperturas_sin_proxy} tasa={e.tasa_apertura} /></td>
                      <td className="is-num"><CifraYTasa n={e.clics} tasa={e.tasa_clic} /></td>
                      <td className="is-num es-grupo"><CifraYTasa n={e.bajas} tasa={e.tasa_baja} /></td>
                      <td className="is-num"><CifraYTasa n={e.quejas} tasa={e.tasa_queja} /></td>
                      <td className="is-num es-fuerte">{cifra(e.respuestas)}</td>
                      <td className="is-accion">
                        {desglosable ? (
                          <button
                            type="button"
                            className="mon-correo-desplegar"
                            aria-expanded={abierto}
                            aria-controls={abierto ? idDesglose : undefined}
                            onClick={() => alternar(e.campaign_id)}
                          >
                            {abierto ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                            {abierto ? "Ocultar públicos" : "Ver por público"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {abierto ? <DesgloseEnvio envio={e} id={idDesglose} paleta={paleta} /> : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EstadoVacio
          icono={<Send size={16} />}
          titulo={publico ? `${publico} todavía no recibe envíos` : "Esta audiencia todavía no tiene envíos"}
          descripcion="Cuando Mailchimp envíe la invitación, actualiza desde Mailchimp para traerla."
        />
      )}
    </section>
  );
}
