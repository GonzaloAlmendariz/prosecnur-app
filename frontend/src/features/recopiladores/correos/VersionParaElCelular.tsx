// La versión para el celular de un bloque Imagen (GOAL editor profesional,
// L12): una pieza ya diseñada (afiche, tabla, infografía) se encoge en el
// celular hasta dejar letras de ~9 px; con esta versión, bajo 480 px el correo
// muestra otra imagen compuesta para esa pantalla (collection_mail_movil.R).

import { useRef, useState } from "react";

import type { MailBlock, MailImageBlock, MailProblem } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { Smartphone, Trash2, Upload } from "../../../vendor/lucide-react";
import { AvisoDeReduccion } from "./AvisoDeReduccion";
import { CampoDeTexto } from "./CampoDeTexto";
import { problemaDelArchivo } from "./PanelDeImagen";
import "./correosPiezas.css";

type Props = {
  block: MailImageBlock;
  /** Lo que ya se ve: el `blob:` recién subido o el `src` de la vista previa. */
  vista: string | null;
  ocupado: boolean;
  onEditarBloque: (update: (b: MailBlock) => MailBlock, grupo?: string) => void;
  onSubir: (file: File) => void;
  /** Con la imagen alojada por URL (SurveyMonkey), la URL de esta versión; `null` si va en el archivo. */
  url?: string | null;
  onUrl?: (url: string) => void;
  problemas?: readonly MailProblem[];
};

/** Ancho de la columna del celular (327 px con 375 de pantalla), al doble: nítida. */
const ANCHO_SUGERIDO = 654;

export function VersionParaElCelular({ block, vista, ocupado, onEditarBloque, onSubir, url = null, onUrl, problemas = [] }: Props) {
  const archivo = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tiene = Boolean(block.mobile_ref);

  const elegir = (file: File | undefined) => {
    if (!file) return;
    const problema = problemaDelArchivo(file);
    setError(problema);
    if (!problema) onSubir(file);
  };

  return (
    <section className="rec-pieza-lado" aria-label="Versión para el celular">
      <span className="rec-pieza-lado-titulo">Para el celular (opcional)</span>
      {tiene && vista ? (
        <div className="rec-capa-img-vista rec-pieza-lado-vista" data-qa-geometry-capacity="owned">
          <img src={vista} alt="" />
        </div>
      ) : null}
      <span className="rec-mail-insp-acciones">
        <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => archivo.current?.click()}>
          {tiene ? <Upload size={14} aria-hidden /> : <Smartphone size={14} aria-hidden />} {tiene ? "Cambiar" : "Subir una versión para el celular"}
        </PulsoButton>
        {tiene ? (
          <PulsoButton
            variant="ghost"
            size="sm"
            onClick={() => onEditarBloque((b) => {
              if (b.type !== "image") return b;
              const { mobile_ref: _movil, ...resto } = b;
              return resto;
            })}
          >
            <Trash2 size={14} aria-hidden /> Quitar
          </PulsoButton>
        ) : null}
      </span>
      <input
        ref={archivo}
        type="file"
        accept="image/png,image/jpeg"
        className="pulso-sr-only"
        aria-label="Elegir la versión para el celular (PNG o JPEG)"
        tabIndex={-1}
        onChange={(event) => {
          elegir(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {error ? <p className="rec-mail-problemas" role="alert">{error}</p> : block.mobile_ref ? <AvisoDeReduccion imageId={block.mobile_ref} /> : null}
      {url !== null && onUrl ? (
        <CampoDeTexto
          label="URL pública de la versión para el celular"
          valor={url}
          mono
          placeholder="https://…/afiche-celular.png"
          ayuda="Como la de arriba: una dirección https que no caduque. Sin ella, en el celular queda la de arriba."
          problemas={problemas}
          onCambio={(v) => onUrl(v.trim())}
        />
      ) : problemas.length ? (
        <ul className="rec-mail-problemas">{problemas.map((p, i) => <li key={i}>{p.detail}</li>)}</ul>
      ) : null}
      <p className="rec-capa-img-ayuda">
        Para una pieza con letras chicas (un afiche, una tabla): en el celular se muestra esta en vez de la de arriba.
        Súbela de unos {ANCHO_SUGERIDO} px de ancho. Usa la misma descripción y el mismo enlace.
      </p>
    </section>
  );
}
