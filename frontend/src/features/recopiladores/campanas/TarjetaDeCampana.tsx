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

import { BarraDeAvance } from "../../../components/BarraDeAvance";
import { formatoConteo } from "../../../lib/formatoNumero";

import type { CampanaMaterial } from "../../../api/materialCampanas";
import type { LucideIcon } from "../../../vendor/lucide-react";
import { Backpack, Mail, MapPinned, PhoneCall, ShieldCheck } from "../../../vendor/lucide-react";
import type { AccionDeCampana, IdDeAccion } from "./accionesDeCampana";
import type { MiniaturaDeCorreo } from "./miniaturaDeCorreo";
import { MenuDeCampana } from "./MenuDeCampana";
import { ROTULO_DEL_TIPO, resumenDeTarjeta } from "./modeloRegistro";
import { subtituloDeCampana } from "./nombreUnico";

export const ICONO_DEL_TIPO: Readonly<Record<CampanaMaterial["tipo"], LucideIcon>> = {
  aulas: Backpack,
  territorial: MapPinned,
  correo: Mail,
  telefonica: PhoneCall,
  supervision: ShieldCheck,
};

type Props = {
  campana: CampanaMaterial;
  href: string;
  acciones: readonly AccionDeCampana[];
  onAccion: (accion: IdDeAccion, campana: CampanaMaterial) => void;
  miniatura?: MiniaturaDeCorreo | null;
  /** El asunto del correo: distingue a dos campañas del mismo nombre cuando no hay actor (F1). */
  asunto?: string | null;
  /** Ronda y de qué campaña viene (acreditación, supervisión), ya redactado. */
  procedencia?: string | null;
};

export function TarjetaDeCampana({ campana, href, acciones, onAccion, miniatura = null, asunto = null, procedencia = null }: Props) {
  const resumen = resumenDeTarjeta(campana);
  const subtitulo = subtituloDeCampana(campana, asunto);
  const Icono = ICONO_DEL_TIPO[campana.tipo];
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
          {subtitulo ? <span className="rec-campana-actor" title={subtitulo}>{subtitulo}</span> : null}
          {procedencia ? <span className="rec-campana-procedencia" title={procedencia}>{procedencia}</span> : null}
        </span>
        <MenuDeCampana campana={campana} acciones={acciones} onAccion={onAccion} subtitulo={subtitulo} />
      </header>

      <span className={`rec-campana-estado is-${campana.archived || campana.fuera_del_estudio ? "neutral" : resumen.tono}`}>
        {campana.archived ? "Archivada" : campana.fuera_del_estudio ? "Fuera del estudio" : resumen.estado}
      </span>

      {resumen.cifras.length ? (
        <dl className="rec-campana-cifras" data-qa-geometry-group={`material-campo/campanas/cifras/${campana.id}`} data-qa-geometry-contract="equal">
          {resumen.cifras.map((c) => (
            <div key={c.rotulo} className="rec-campana-cifra" data-qa-geometry-member>
              <dt>{c.rotulo}</dt>
              <dd>{formatoConteo(c.valor)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {resumen.avance ? (
        <div className="rec-campana-avance">
          <BarraDeAvance valor={resumen.avance.actual} total={resumen.avance.total} etiqueta={resumen.avance.rotulo} />
          <span className="rec-campana-avance-texto">
            {formatoConteo(resumen.avance.actual)} de {formatoConteo(resumen.avance.total)} {resumen.avance.rotulo}
          </span>
        </div>
      ) : null}

      {resumen.envios.length ? (
        <ul className="rec-campana-envios" aria-label="Envíos">
          {resumen.envios.map((e) => (
            <li key={e.label} className={e.exportado ? "is-exportado" : undefined}>
              <span className="rec-campana-punto" aria-hidden />
              <span><b>{e.label}</b> {e.texto}</span>
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
