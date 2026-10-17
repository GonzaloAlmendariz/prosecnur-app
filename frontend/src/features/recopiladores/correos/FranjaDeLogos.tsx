import { Fragment, useMemo, useRef } from "react";

import type { MailImage } from "../../../api/materialMail";
import { logosDeLaVistaPrevia } from "./modeloCorreo";
import "./correosIdentidad.css";

type Props = {
  logoIds: readonly string[];
  images: Record<string, MailImage>;
  fondo: "dark" | "light";
  /** Acento del correo: es el fondo de la franja oscura, como en el render. */
  acento: string;
  imagenesLocales: Record<string, string>;
  /** HTML de la vista previa cuando la cabecera en uso es la franja; si no, `null`. */
  htmlDeLaVista: string | null;
  /** La franja no es la cabecera en uso (hay banner): se muestra atenuada. */
  enReserva: boolean;
};

/**
 * La franja de logos como sale en el correo: los logos reales sobre su fondo.
 *
 * Cada logo se pinta con lo más fresco que haya: el PNG subido en esta sesión,
 * el que ya pinta la vista previa (data URI del archivo del proyecto) o su URL
 * pública. Lo último visto se recuerda, para que pasar al banner no deje la
 * franja en blanco.
 */
export function FranjaDeLogos({ logoIds, images, fondo, acento, imagenesLocales, htmlDeLaVista, enReserva }: Props) {
  const vistos = useRef<Record<string, string>>({});
  const deLaVista = useMemo(() => logosDeLaVistaPrevia(htmlDeLaVista, logoIds), [htmlDeLaVista, logoIds]);
  vistos.current = { ...vistos.current, ...deLaVista };
  const oscura = fondo === "dark";
  const nombres = logoIds.map((id) => images[id]?.alt || id).join(", ");
  return (
    <div
      className={`rec-mail-franja-vista${oscura ? " is-oscura" : ""}${enReserva ? " is-reserva" : ""}`}
      style={oscura ? { backgroundColor: acento } : undefined}
      role="img"
      aria-label={`Franja de logos sobre fondo ${oscura ? "oscuro" : "claro"}: ${nombres || "sin logos"}`}
      data-qa-geometry-group="material-campo/catalogo/correos-franja"
      data-qa-geometry-contract="intrinsic"
    >
      {logoIds.map((id, i) => {
        const src = imagenesLocales[id] ?? deLaVista[id] ?? vistos.current[id] ?? images[id]?.url;
        return (
          <Fragment key={id}>
            {i > 0 ? <span className="rec-mail-franja-vista-sep" aria-hidden /> : null}
            {/* C1: los miembros son los logos, no los separadores; la caja de
                cada uno abraza su imagen o su hueco. */}
            <span className="rec-mail-franja-vista-item" data-qa-geometry-member>
              {src ? (
                <img className="rec-mail-franja-vista-logo" src={src} alt="" />
              ) : (
                <span className="rec-mail-franja-vista-hueco">{images[id]?.alt || id}</span>
              )}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
