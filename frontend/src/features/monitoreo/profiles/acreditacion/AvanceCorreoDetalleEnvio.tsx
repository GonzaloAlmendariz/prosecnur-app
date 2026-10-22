import type { NodoDeEnvio } from "./avanceCorreoCronologiaModelo";
import { fechaCompleta } from "./avanceCorreoMatriz";
import { cifra, porcentaje } from "./avanceCorreoModelo";
import { clasePublico, type PaletaDePublicos } from "./paletaPublicos";

// El embudo de UN envío para un público: lo que se ve al apuntar o enfocar un
// nodo de la cronología. Las tasas son las del backend, sobre entregados.

type Fila = { clave: string; rotulo: string; n: number | null; tasa: number | null };

export function filasDelDetalle(nodo: NodoDeEnvio): Fila[] {
  const c = nodo.cifras;
  // En un tramo por público Mailchimp no separa las aperturas de Apple: la
  // cifra y su tasa son las de todas las aperturas, y así se rotula.
  const sinProxy = !nodo.parcial && c.aperturas_sin_proxy != null;
  const respuestaTasa = c.respuestas != null && c.entregados ? c.respuestas / c.entregados : null;
  return [
    { clave: "aperturas", rotulo: sinProxy ? "Abrieron" : "Abrieron (con Apple)", n: sinProxy ? c.aperturas_sin_proxy : c.aperturas, tasa: c.tasa_apertura },
    { clave: "clics", rotulo: "Clic en la encuesta", n: c.clics, tasa: c.tasa_clic },
    { clave: "respuestas", rotulo: "Respondieron", n: c.respuestas, tasa: respuestaTasa },
    { clave: "bajas", rotulo: "Bajas", n: c.bajas, tasa: c.tasa_baja },
    { clave: "quejas", rotulo: "Quejas", n: c.quejas, tasa: c.tasa_queja },
  ];
}

export function AvanceCorreoDetalleEnvio({
  nodo,
  paleta,
  idPanel,
}: {
  nodo: NodoDeEnvio | null;
  paleta: PaletaDePublicos;
  idPanel: string;
}) {
  if (!nodo) {
    return (
      <aside className="mon-correo-detalle" id={idPanel} aria-live="polite">
        <p className="mon-correo-tenue">Sin envíos que detallar.</p>
      </aside>
    );
  }
  const c = nodo.cifras;
  const rebotes = (c.rebotes_duros ?? 0) + (c.rebotes_blandos ?? 0);
  return (
    <aside className={`mon-correo-detalle ${clasePublico(paleta, nodo.publico)}`} id={idPanel} aria-live="polite" aria-label="Detalle del envío">
      <header>
        <span className="mon-correo-detalle-tipo">
          <i className={`mon-correo-nodo-forma es-${nodo.tipo}`} aria-hidden />
          {nodo.rotulo} · {nodo.publico}
        </span>
        <strong>{nodo.envio.titulo || nodo.envio.campaign_id}</strong>
        <small>{nodo.envio.enviado_at ? fechaCompleta(nodo.envio.enviado_at) : "Sin fecha"}{nodo.envio.asunto ? ` · ${nodo.envio.asunto}` : ""}</small>
      </header>
      <div className="mon-correo-detalle-entrega">
        <span className="mon-correo-versalita">Entregados</span>
        <strong>{cifra(c.entregados)}</strong>
        <small>de {cifra(c.enviados)} enviados · {cifra(rebotes)} {rebotes === 1 ? "rebote" : "rebotes"}</small>
      </div>
      <dl
        className="mon-correo-detalle-filas"
        data-qa-geometry-group="monitoreo/acreditacion/avance/correo/detalle-envio"
        data-qa-geometry-contract="equal"
      >
        {filasDelDetalle(nodo).map((f) => (
          <div key={f.clave} className={`mon-correo-detalle-fila es-${f.clave}`}>
            <dt>{f.rotulo}</dt>
            <dd>
              <strong>{cifra(f.n)}</strong>
              <span>{porcentaje(f.tasa)} de {cifra(c.entregados)}</span>
            </dd>
          </div>
        ))}
      </dl>
      {nodo.parcial ? (
        <p className="mon-correo-tenue">Parte de un envío a {cifra(nodo.envio.por_actor.length)} públicos · {cifra(nodo.envio.entregados)} entregados en total.</p>
      ) : null}
    </aside>
  );
}
