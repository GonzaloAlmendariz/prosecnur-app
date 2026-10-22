import { useId, useMemo, useState } from "react";

import type { MonitoreoMailchimpEnvio } from "../../../../api/monitoreoMailchimp";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { CalendarRange } from "../../../../vendor/lucide-react";
import { AvanceCorreoDetalleEnvio } from "./AvanceCorreoDetalleEnvio";
import { cronologiaDeEnvios, nodoInicial } from "./avanceCorreoCronologiaModelo";
import { fechaCorta } from "./avanceCorreoMatriz";
import { cifra } from "./avanceCorreoModelo";
import { clasePublico, type PaletaDePublicos } from "./paletaPublicos";

// Cronología de envíos: un carril por público y un nodo por envío, con su
// tamaño proporcional a las respuestas atribuidas. La invitación es un círculo
// lleno; el recordatorio, un rombo abierto. Apuntar o enfocar un nodo lo lleva
// al panel de la derecha con su embudo.

export function AvanceCorreoCronologia({
  envios,
  paleta,
  publico,
}: {
  envios: MonitoreoMailchimpEnvio[];
  paleta: PaletaDePublicos;
  publico: string;
}) {
  const ids = useId();
  const crono = useMemo(() => cronologiaDeEnvios(envios), [envios]);
  const [foco, setFoco] = useState({ clave: "", filtro: "" });
  const visibles = publico ? crono.nodos.filter((n) => n.publico === publico) : crono.nodos;
  const porDefecto = nodoInicial({ ...crono, nodos: visibles.length ? visibles : crono.nodos });
  // El foco vale para el filtro en que se eligió: al cambiar de público, cede
  // al último envío de ese público.
  const nodo = (foco.filtro === publico ? crono.nodos.find((n) => n.clave === foco.clave) : undefined) ?? porDefecto;
  const enfocar = (clave: string) => setFoco({ clave, filtro: publico });
  const fechas = crono.fechas;

  return (
    <section className="mon-correo-bloque" aria-labelledby={`${ids}-t`}>
      <header className="mon-correo-bloque-cabeza">
        <div>
          <h3 id={`${ids}-t`}>Cronología de envíos</h3>
          <p className="mon-correo-bloque-meta">
            {cifra(envios.length)} {envios.length === 1 ? "envío" : "envíos"}
            {fechas.length > 1 ? ` · del ${fechas[0].rotulo} al ${fechas[fechas.length - 1].rotulo}` : fechas.length ? ` · ${fechas[0].rotulo}` : ""}
          </p>
        </div>
        <span className="mon-correo-crono-leyenda" aria-hidden>
          <i className="mon-correo-nodo-forma es-invitacion" /> Invitación
          <i className="mon-correo-nodo-forma es-recordatorio" /> Recordatorio
          <span className="mon-correo-tenue">· tamaño = respuestas</span>
        </span>
      </header>
      {crono.carriles.length ? (
        <div className="mon-correo-crono">
          <div className="mon-correo-crono-lienzo">
            <ol
              className="mon-correo-carriles"
              aria-label="Envíos por público"
              data-qa-geometry-group="monitoreo/acreditacion/avance/correo/carriles"
              data-qa-geometry-contract="equal"
            >
              {crono.carriles.map((carril) => (
                <li
                  key={carril.publico}
                  className={`mon-correo-carril ${clasePublico(paleta, carril.publico)}${publico && publico !== carril.publico ? " is-atenuado" : ""}`}
                >
                  <span className="mon-correo-carril-nombre" title={carril.publico}>
                    <i className="mon-publico-punto" aria-hidden />
                    {carril.publico}
                  </span>
                  <span className="mon-correo-carril-pista">
                    {carril.nodos.map((n) => (
                      <button
                        key={n.clave}
                        type="button"
                        className={`mon-correo-nodo es-${n.tipo}${nodo?.clave === n.clave ? " is-elegido" : ""}`}
                        style={{ insetInlineStart: `${n.x}%`, inlineSize: n.tamano, blockSize: n.tamano }}
                        aria-pressed={nodo?.clave === n.clave}
                        aria-controls={`${ids}-detalle`}
                        aria-label={`${n.rotulo} de ${n.publico}, ${fechaCorta(n.envio.enviado_at) || "sin fecha"}: ${cifra(n.cifras.respuestas)} respuestas`}
                        onMouseEnter={() => enfocar(n.clave)}
                        onFocus={() => enfocar(n.clave)}
                        onClick={() => enfocar(n.clave)}
                      >
                        <i aria-hidden />
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mon-correo-eje" aria-hidden>
              <span />
              <span className="mon-correo-eje-pista">
                {fechas.map((f) => (
                  <small key={f.clave} style={{ insetInlineStart: `${f.x}%` }}>{f.rotulo}</small>
                ))}
              </span>
            </div>
          </div>
          <AvanceCorreoDetalleEnvio nodo={nodo} paleta={paleta} idPanel={`${ids}-detalle`} />
        </div>
      ) : (
        <EstadoVacio
          icono={<CalendarRange size={16} />}
          titulo="Sin envíos en la cronología"
          descripcion="Cuando Mailchimp envíe la invitación, actualiza desde Mailchimp para traerla."
        />
      )}
    </section>
  );
}
