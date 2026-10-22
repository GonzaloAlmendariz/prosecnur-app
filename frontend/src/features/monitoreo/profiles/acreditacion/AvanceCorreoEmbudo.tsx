import { useId, useMemo } from "react";

import type { MonitoreoMailchimpEnvio } from "../../../../api/monitoreoMailchimp";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { Send } from "../../../../vendor/lucide-react";
import { AvanceCorreoFiltroPublico } from "./AvanceCorreoFiltroPublico";
import { anchoDePaso, embudoCorreo } from "./avanceCorreoEmbudoModelo";
import { cifra, porcentaje } from "./avanceCorreoModelo";
import { clasePublico, type PaletaDePublicos } from "./paletaPublicos";

// La pieza héroe de Correo: el embudo enviados → entregados → abrieron → clic
// → respondieron, a todo el ancho. Cada paso muestra su cifra, su tasa sobre
// el paso anterior (con la base) y sobre los enviados, y lo que se perdió. La
// pista de cada barra deja ver, en tenue, el ancho del paso anterior: la
// pérdida se lee como la parte que no se rellenó.

export function AvanceCorreoEmbudo({
  envios,
  publicos,
  publico,
  paleta,
  onPublico,
}: {
  envios: MonitoreoMailchimpEnvio[];
  publicos: string[];
  publico: string;
  paleta: PaletaDePublicos;
  onPublico: (publico: string) => void;
}) {
  const ids = useId();
  const embudo = useMemo(() => embudoCorreo(envios, publico), [envios, publico]);
  const maximo = embudo.pasos[0]?.valor ?? null;
  const tono = publico ? clasePublico(paleta, publico) : "es-todos";

  return (
    <section className={`mon-correo-bloque mon-correo-embudo ${tono}`} aria-labelledby={`${ids}-t`}>
      <header className="mon-correo-bloque-cabeza">
        <div>
          <h3 id={`${ids}-t`}>Embudo del correo</h3>
          <p className="mon-correo-bloque-meta">
            {publico ? <><i className="mon-publico-punto" aria-hidden /> {publico} · </> : null}
            {cifra(embudo.envios)} {embudo.envios === 1 ? "envío" : "envíos"}
          </p>
        </div>
        <AvanceCorreoFiltroPublico publicos={publicos} elegido={publico} paleta={paleta} onElegir={onPublico} />
      </header>
      {embudo.envios ? (
        <ol
          className="mon-correo-embudo-pasos"
          data-qa-geometry-group="monitoreo/acreditacion/avance/correo/embudo"
          data-qa-geometry-contract="equal"
        >
          {embudo.pasos.map((paso, i) => {
            const previo = i > 0 ? embudo.pasos[i - 1].valor : null;
            const ancho = anchoDePaso(paso.valor, maximo);
            const anchoPrevio = i > 0 ? anchoDePaso(previo, maximo) : 0;
            return (
              <li key={paso.clave} className={`mon-correo-paso es-${paso.clave}`}>
                <div className="mon-correo-paso-cifra">
                  <span className="mon-correo-versalita">{paso.etiqueta}</span>
                  <strong>{cifra(paso.valor)}</strong>
                </div>
                <div
                  className="mon-correo-paso-pista"
                  role="img"
                  aria-label={`${paso.etiqueta}: ${cifra(paso.valor)}${
                    paso.sobreInicio != null ? `, ${porcentaje(paso.sobreInicio)} de ${cifra(maximo)} enviados` : ""
                  }`}
                >
                  {anchoPrevio > ancho ? (
                    <span className="mon-correo-paso-perdida" style={{ inlineSize: `${anchoPrevio}%` }} />
                  ) : null}
                  <span className="mon-correo-paso-relleno" style={{ inlineSize: `${ancho}%` }} />
                </div>
                <div className="mon-correo-paso-tasas">
                  {paso.baseAnterior ? (
                    <>
                      <span>
                        <strong>{porcentaje(paso.sobreAnterior)}</strong>{" "}
                        de {cifra(paso.baseAnterior.valor)} {paso.baseAnterior.nombre}
                      </span>
                      <small>
                        {paso.perdida ? <em>{cifra(paso.perdida.valor)} {paso.perdida.etiqueta}</em> : null}
                        {paso.perdida ? " · " : null}
                        {porcentaje(paso.sobreInicio)} de los enviados
                      </small>
                    </>
                  ) : (
                    <span>suma de {cifra(embudo.envios)} {embudo.envios === 1 ? "envío" : "envíos"}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
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
