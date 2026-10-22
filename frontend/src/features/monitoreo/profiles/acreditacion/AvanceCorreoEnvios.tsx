import { Fragment, useId, useMemo, useState } from "react";

import type { MonitoreoMailchimpEnvio } from "../../../../api/monitoreoMailchimp";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { ChevronDown, ChevronRight, Send } from "../../../../vendor/lucide-react";
import {
  cifra,
  enviosOrdenados,
  etiquetaTipoEnvio,
  filtrarEnvios,
  porcentaje,
  publicosDeEnvios,
  tieneDesglose,
} from "./avanceCorreoModelo";
import { formatDate } from "./formato";

// Avance › Correo › Por envío. Las tasas se leen sobre entregados; la apertura
// es la del reporte de Mailchimp, sin las aperturas automáticas de Apple. Un
// envío que tocó a más de un público se despliega con su desglose por público.

const COLUMNAS = 12;

function CifraYTasa({ n, tasa }: { n: number | null; tasa: number | null }) {
  return (
    <>
      <span>{cifra(n)}</span>
      <small>{porcentaje(tasa)}</small>
    </>
  );
}

function DesgloseEnvio({ envio, id }: { envio: MonitoreoMailchimpEnvio; id: string }) {
  return (
    <tr id={id} className="mon-correo-desglose">
      <td colSpan={COLUMNAS}>
        <table className="mon-correo-tabla is-anidada" aria-label={`Desglose por público de ${envio.titulo || envio.campaign_id}`}>
          <thead>
            <tr>
              <th scope="col">Público</th>
              <th scope="col" className="is-num">Enviados</th>
              <th scope="col" className="is-num">Entregados</th>
              <th scope="col" className="is-num">Rebotes duros · blandos</th>
              <th scope="col" className="is-num">Aperturas (incluye automáticas)</th>
              <th scope="col" className="is-num">Clics</th>
              <th scope="col" className="is-num">Bajas</th>
              <th scope="col" className="is-num">Quejas</th>
              <th scope="col" className="is-num">Respuestas atribuidas</th>
            </tr>
          </thead>
          <tbody>
            {envio.por_actor.map((a) => (
              <tr key={a.actor}>
                <th scope="row">{a.actor}</th>
                <td className="is-num">{cifra(a.enviados)}</td>
                <td className="is-num">{cifra(a.entregados)}</td>
                <td className="is-num">{cifra(a.rebotes_duros)} · {cifra(a.rebotes_blandos)}</td>
                <td className="is-num">{cifra(a.aperturas)}</td>
                <td className="is-num">{cifra(a.clics)}</td>
                <td className="is-num">{cifra(a.bajas)}</td>
                <td className="is-num">{cifra(a.quejas)}</td>
                <td className="is-num">{cifra(a.respuestas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mon-correo-nota">
          Mailchimp no separa por persona las aperturas automáticas de Apple: por público se muestran todas las aperturas.
        </p>
      </td>
    </tr>
  );
}

export function AvanceCorreoEnvios({ envios }: { envios: MonitoreoMailchimpEnvio[] }) {
  const base = useId();
  const [publico, setPublico] = useState("");
  const [abiertos, setAbiertos] = useState<ReadonlySet<string>>(() => new Set());
  const publicos = useMemo(() => publicosDeEnvios(envios), [envios]);
  const visibles = useMemo(
    () => enviosOrdenados(filtrarEnvios(envios, publicos.includes(publico) ? publico : "")),
    [envios, publico, publicos],
  );

  const alternar = (id: string) => setAbiertos((prev) => {
    const sig = new Set(prev);
    if (sig.has(id)) sig.delete(id); else sig.add(id);
    return sig;
  });

  return (
    <section className="mon-correo-bloque" aria-labelledby={`${base}-titulo`}>
      <header className="mon-correo-bloque-cabeza">
        <div>
          <h3 id={`${base}-titulo`}>Por envío</h3>
          <p>Tasas sobre entregados. Las aperturas no incluyen las automáticas de Apple.</p>
        </div>
        {publicos.length > 1 ? (
          <label className="mon-correo-filtro">
            <span>Público</span>
            <select value={publicos.includes(publico) ? publico : ""} onChange={(e) => setPublico(e.target.value)}>
              <option value="">Todos los públicos</option>
              {publicos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        ) : null}
      </header>
      {visibles.length ? (
        <div className="mon-correo-tabla-marco">
          <table className="mon-correo-tabla">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Envío</th>
                <th scope="col">Tipo</th>
                <th scope="col">Público</th>
                <th scope="col" className="is-num">Entregados</th>
                <th scope="col" className="is-num">Rebotes duros · blandos</th>
                <th scope="col" className="is-num">Aperturas</th>
                <th scope="col" className="is-num">Clics</th>
                <th scope="col" className="is-num">Bajas</th>
                <th scope="col" className="is-num">Quejas</th>
                <th scope="col" className="is-num">Respuestas atribuidas</th>
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
                    <tr className={abierto ? "is-abierta" : undefined}>
                      <td className="is-fecha">{e.enviado_at ? formatDate(e.enviado_at) : "—"}</td>
                      <th scope="row" className="mon-correo-envio">
                        <span>{e.titulo || e.campaign_id}</span>
                        {e.asunto ? <small>{e.asunto}</small> : null}
                      </th>
                      <td>{etiquetaTipoEnvio(e)}</td>
                      <td>{e.actor || "—"}{desglosable ? <small>{cifra(e.por_actor.length)} públicos</small> : null}</td>
                      <td className="is-num">{cifra(e.entregados)}<small>de {cifra(e.enviados)} enviados</small></td>
                      <td className="is-num">{cifra(e.rebotes_duros)} · {cifra(e.rebotes_blandos)}</td>
                      <td className="is-num"><CifraYTasa n={e.aperturas_sin_proxy} tasa={e.tasa_apertura} /></td>
                      <td className="is-num"><CifraYTasa n={e.clics} tasa={e.tasa_clic} /></td>
                      <td className="is-num"><CifraYTasa n={e.bajas} tasa={e.tasa_baja} /></td>
                      <td className="is-num"><CifraYTasa n={e.quejas} tasa={e.tasa_queja} /></td>
                      <td className="is-num">{cifra(e.respuestas)}</td>
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
                    {abierto ? <DesgloseEnvio envio={e} id={idDesglose} /> : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EstadoVacio
          icono={<Send size={16} />}
          titulo="Esta audiencia todavía no tiene envíos"
          descripcion="Cuando Mailchimp envíe la invitación, actualiza desde Mailchimp para traerla."
        />
      )}
    </section>
  );
}
