// La foto de una sección en el inspector (GOAL editor profesional, L5 y L6):
// Destacado, Pasos, Cita y Contacto. Verla, subirla o cambiarla, encuadrarla,
// describirla y quitarla. Sin foto, la sección sale sólo con su texto (Contacto,
// con las iniciales), así que quitarla nunca deja un hueco.

import { useRef, useState } from "react";

import { tieneFoto, type MailBlock, type MailBlockConFoto, type MailProblem } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { ImagePlus, Trash2, Upload } from "../../../vendor/lucide-react";
import { AvisoDeReduccion } from "./AvisoDeReduccion";
import { CampoDeTexto } from "./CampoDeTexto";
import { EncuadreDeFoto } from "./EncuadreDeFoto";
import { propDelProblema } from "./modeloCorreo";
import { problemaDelArchivo } from "./PanelDeImagen";
import { descripcionesPendientes } from "./piezasGraficas";
import "./correosPiezas.css";

type Props = {
  block: MailBlockConFoto;
  /** Lo que ya se ve: el `blob:` recién subido o el `src` de la vista previa. */
  vista: string | null;
  problemas: readonly MailProblem[];
  ocupado: boolean;
  onEditarBloque: (update: (b: MailBlock) => MailBlock, grupo?: string) => void;
  onSubir: (file: File) => void;
};

/** Ancho con que sale la foto con 600 px de columna (`.cmail_photo_shown`): se sube al doble. */
function anchoMostrado(block: MailBlockConFoto): number {
  if (block.type === "feature") return block.layout === "arriba" ? 504 : 216;
  return block.type === "steps" ? 504 : 96;
}

export function FotoDeLaSeccion({ block, vista, problemas, ocupado, onEditarBloque, onSubir }: Props) {
  const archivo = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tiene = Boolean(block.image_ref);
  const delContrato = problemas.filter((p) => propDelProblema(p.path) === "alt");
  const pendiente = descripcionesPendientes({ blocks: [block] }).length > 0;
  const propios: MailProblem[] = delContrato.length ? delContrato
    : pendiente ? [{ path: `${block.block_id}.alt`, code: "missing_alt", detail: "Falta describirla: es lo que se lee si la foto no carga." }]
    : [];

  const elegir = (file: File | undefined) => {
    if (!file) return;
    const problema = problemaDelArchivo(file);
    setError(problema);
    if (!problema) onSubir(file);
  };

  return (
    <section className="rec-pieza-lado" aria-label="Foto de la sección">
      <span className="rec-pieza-lado-titulo">{block.type === "quote" || block.type === "contact" ? "Retrato" : "Foto"}</span>
      {vista && tiene ? (
        // Con foto: la foto entera y, encima, el encuadre del recorte (L7).
        <EncuadreDeFoto block={block} vista={vista} onEditarBloque={onEditarBloque} />
      ) : (
        <div className="rec-capa-img-vista rec-pieza-lado-vista is-vacia" data-qa-geometry-capacity="owned">
          <span className="rec-capa-img-vacia">
            <ImagePlus size={18} aria-hidden />
            <span>{tiene ? "Sin archivo todavía" : block.type === "contact" ? "Sin foto: salen las iniciales" : "Sin foto: sale sólo el texto"}</span>
          </span>
        </div>
      )}
      <span className="rec-mail-insp-acciones">
        <PulsoButton variant={vista ? "secondary" : "primary"} size="sm" disabled={ocupado} onClick={() => archivo.current?.click()}>
          <Upload size={14} aria-hidden /> {vista ? "Cambiar la foto" : "Subir una foto"}
        </PulsoButton>
        {tiene ? (
          <PulsoButton
            variant="ghost"
            size="sm"
            onClick={() => onEditarBloque((b) => {
              if (!tieneFoto(b)) return b;
              const { image_ref: _foto, alt: _alt, ...resto } = b;
              return resto;
            })}
          >
            <Trash2 size={14} aria-hidden /> Quitar la foto
          </PulsoButton>
        ) : null}
      </span>
      <input
        ref={archivo}
        type="file"
        accept="image/png,image/jpeg"
        className="pulso-sr-only"
        aria-label="Elegir la foto de la sección (PNG o JPEG)"
        tabIndex={-1}
        onChange={(event) => {
          elegir(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {error ? <p className="rec-mail-problemas" role="alert">{error}</p> : block.image_ref ? <AvisoDeReduccion imageId={block.image_ref} /> : null}
      {tiene ? (
        <CampoDeTexto
          label="Descripción"
          valor={block.alt ?? ""}
          maximo={160}
          problemas={propios}
          onCambio={(valor) => onEditarBloque((b) => ({ ...b, alt: valor }) as MailBlock, `${block.block_id}.alt`)}
        />
      ) : null}
      <p className="rec-capa-img-ayuda">
        PNG o JPEG, al menos {anchoMostrado(block) * 2} px de ancho: así se ve nítida.
      </p>
    </section>
  );
}
