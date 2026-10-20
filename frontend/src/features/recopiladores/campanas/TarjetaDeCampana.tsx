// Una campaña en la lista (ADR 0111 §2): tipo, nombre, estado y avance.
//
// Arriba, la miniatura: en un correo, su banner real (o la primera imagen del
// cuerpo, ver miniaturaDeCorreo.ts). Sin ella —y en aulas, cuya ficha del
// catálogo no está en el cliente de la lista— va el emblema del tipo en la
// misma franja, así todas las tarjetas conservan el mismo marco (C2).
//
// El nombre es el enlace y su área cubre la tarjeta; el menú queda por encima.
// Una archivada no se abre: se reabre desde su menú.

import { Link } from "react-router-dom";

import type { CampanaMaterial } from "../../../api/materialCampanas";
import type { LucideIcon } from "../../../vendor/lucide-react";
import { Backpack, Mail, MapPinned } from "../../../vendor/lucide-react";
import type { AccionDeCampana, IdDeAccion } from "./accionesDeCampana";
import type { MiniaturaDeCorreo } from "./miniaturaDeCorreo";
import { MenuDeCampana } from "./MenuDeCampana";
import { ROTULO_DEL_TIPO, resumenDeTarjeta } from "./modeloRegistro";

export const ICONO_DEL_TIPO: Readonly<Record<CampanaMaterial["tipo"], LucideIcon>> = {
  aulas: Backpack,
  territorial: MapPinned,
  correo: Mail,
};

type Props = {
  campana: CampanaMaterial;
  href: string;
  acciones: readonly AccionDeCampana[];
  onAccion: (accion: IdDeAccion, campana: CampanaMaterial) => void;
  miniatura?: MiniaturaDeCorreo | null;
};

export function TarjetaDeCampana({ campana, href, acciones, onAccion, miniatura = null }: Props) {
  const resumen = resumenDeTarjeta(campana);
  const Icono = ICONO_DEL_TIPO[campana.tipo];
  const pct = resumen.avance && resumen.avance.total > 0
    ? Math.round((resumen.avance.actual / resumen.avance.total) * 100)
    : 0;
  return (
    <article
      className={`rec-campana-tarjeta is-${campana.tipo}${campana.archived ? " is-archivada" : ""}`}
      data-campana={campana.id}
      data-qa-geometry-member
    >
      <div className={`rec-campana-franja${miniatura ? " con-miniatura" : ""}`} aria-hidden>
        {miniatura ? <img src={miniatura.url} alt="" loading="lazy" /> : <span className="rec-campana-emblema"><Icono size={28} /></span>}
      </div>
      <header className="rec-campana-tarjeta-cabeza">
        <span className="rec-campana-titulos">
          <span className="rec-campana-tipo"><Icono size={13} aria-hidden /> {ROTULO_DEL_TIPO[campana.tipo]}</span>
          <h3 className="rec-campana-nombre" title={campana.name}>
            {campana.archived ? campana.name : <Link className="rec-campana-abrir" to={href}>{campana.name}</Link>}
          </h3>
          {campana.actor ? <span className="rec-campana-actor">{campana.actor}</span> : null}
        </span>
        <MenuDeCampana campana={campana} acciones={acciones} onAccion={onAccion} />
      </header>

      <span className={`rec-campana-estado is-${campana.archived ? "neutral" : resumen.tono}`}>
        {campana.archived ? "Archivada" : resumen.estado}
      </span>

      {resumen.cifras.length ? (
        <dl className="rec-campana-cifras" data-qa-geometry-group={`material-campo/campanas/cifras/${campana.id}`} data-qa-geometry-contract="equal">
          {resumen.cifras.map((c) => (
            <div key={c.rotulo} className="rec-campana-cifra" data-qa-geometry-member>
              <dt>{c.rotulo}</dt>
              <dd>{c.valor.toLocaleString("es-PE")}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {resumen.avance ? (
        <div className="rec-campana-avance">
          <div
            className="rec-campana-avance-barra"
            role="progressbar"
            aria-label={resumen.avance.rotulo}
            aria-valuemin={0}
            aria-valuemax={resumen.avance.total}
            aria-valuenow={resumen.avance.actual}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="rec-campana-avance-texto">
            {resumen.avance.actual.toLocaleString("es-PE")}/{resumen.avance.total.toLocaleString("es-PE")} {resumen.avance.rotulo}
          </span>
        </div>
      ) : null}

      {resumen.envios.length ? (
        <ul className="rec-campana-envios" aria-label="Envíos">
          {resumen.envios.map((e) => (
            <li key={e.label} className={e.exportado ? "is-exportado" : undefined}>
              <span className="rec-campana-punto" aria-hidden />
              <span>{e.label} · {e.texto}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Lo que no es cifra ni envío: plataforma, bloques, avisos. */}
      {resumen.hechos.length ? (
        <ul className="rec-campana-hechos">
          {resumen.hechos.map((h) => <li key={h}>{h}</li>)}
        </ul>
      ) : null}
    </article>
  );
}
