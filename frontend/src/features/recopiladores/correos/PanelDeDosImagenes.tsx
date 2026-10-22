import { useRef, useState } from "react";

import type { MailBlock, MailProblem, MailTwoImagesBlock } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { ImagePlus, Upload } from "../../../vendor/lucide-react";
import { CampoDeTexto } from "./CampoDeTexto";
import { propDelProblema } from "./modeloCorreo";
import { problemaDelArchivo } from "./PanelDeImagen";
import { descripcionesPendientes, type LadoDelPar } from "./piezasGraficas";
import "./correosPiezas.css";

type Props = {
  block: MailTwoImagesBlock;
  /** Lo que ya se ve de cada lado: el `blob:` recién subido o el `src` de la vista previa. */
  vistas: Record<LadoDelPar, string | null> | null;
  problemas: readonly MailProblem[];
  ocupado: boolean;
  onEditarBloque: (update: (b: MailBlock) => MailBlock, grupo?: string) => void;
  onSubir: (lado: LadoDelPar, file: File) => void;
};

const NOMBRE_DEL_LADO: Record<LadoDelPar, string> = { left: "Izquierda", right: "Derecha" };

/** La descripción que falta, dicha en el campo antes de que la revisión la marque. */
function falta(blockId: string, lado: LadoDelPar): MailProblem {
  return {
    path: `${blockId}.alt_${lado}`,
    code: "missing_alt",
    detail: "Falta describirla: es lo que se lee con las imágenes bloqueadas.",
  };
}

function LadoDelParEditable({
  block,
  lado,
  vista,
  problemas,
  ocupado,
  onEditarBloque,
  onSubir,
}: Omit<Props, "vistas" | "onSubir"> & { lado: LadoDelPar; vista: string | null; onSubir: (file: File) => void }) {
  const archivo = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prop = lado === "left" ? "alt_left" : "alt_right";
  const nombre = NOMBRE_DEL_LADO[lado];
  const delContrato = problemas.filter((p) => propDelProblema(p.path) === prop);
  const pendiente = descripcionesPendientes({ blocks: [block] }).some((d) => d.prop === prop);
  const propios = delContrato.length ? delContrato : pendiente ? [falta(block.block_id, lado)] : [];

  const elegir = (file: File | undefined) => {
    if (!file) return;
    const problema = problemaDelArchivo(file);
    setError(problema);
    if (!problema) onSubir(file);
  };

  return (
    <section className="rec-pieza-lado" aria-label={`Imagen ${nombre.toLowerCase()}`} data-qa-geometry-member>
      <span className="rec-pieza-lado-titulo">{nombre}</span>
      <div className={`rec-capa-img-vista rec-pieza-lado-vista${vista ? "" : " is-vacia"}`} data-qa-geometry-capacity="owned">
        {vista ? (
          <img src={vista} alt={block[prop] || `Imagen ${nombre.toLowerCase()}`} />
        ) : (
          <span className="rec-capa-img-vacia">
            <ImagePlus size={18} aria-hidden />
            <span>Sin archivo todavía</span>
          </span>
        )}
      </div>
      <PulsoButton variant={vista ? "secondary" : "primary"} size="sm" disabled={ocupado} onClick={() => archivo.current?.click()}>
        <Upload size={14} aria-hidden /> {vista ? "Cambiar la imagen" : "Subir imagen"}
      </PulsoButton>
      <input
        ref={archivo}
        type="file"
        accept="image/png,image/jpeg"
        className="pulso-sr-only"
        aria-label={`Elegir la imagen ${nombre.toLowerCase()} (PNG o JPEG)`}
        tabIndex={-1}
        onChange={(event) => {
          elegir(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {error ? <p className="rec-mail-problemas" role="alert">{error}</p> : null}
      <CampoDeTexto
        label="Descripción"
        valor={block[prop]}
        maximo={160}
        problemas={propios}
        onCambio={(valor) => onEditarBloque((b) => ({ ...b, [prop]: valor }) as MailBlock, `${block.block_id}.${prop}`)}
      />
    </section>
  );
}

/**
 * Inspector de «Dos imágenes» (E1o): cada lado con su archivo y su
 * descripción, obligatoria. En el correo cada imagen conserva su proporción y,
 * si difieren, se alinean arriba sin forzar el mismo alto; en el teléfono se apilan.
 */
export function PanelDeDosImagenes({ block, vistas, problemas, ocupado, onEditarBloque, onSubir }: Props) {
  return (
    <div className="rec-pieza-par" data-qa-geometry-group="material-campo/correo/par" data-qa-geometry-contract="intrinsic">
      {(["left", "right"] as const).map((lado) => (
        <LadoDelParEditable
          key={lado}
          block={block}
          lado={lado}
          vista={vistas?.[lado] ?? null}
          problemas={problemas}
          ocupado={ocupado}
          onEditarBloque={onEditarBloque}
          onSubir={(file) => onSubir(lado, file)}
        />
      ))}
      <p className="rec-capa-img-ayuda">PNG o JPEG, hasta 1 MB. Cada una sale a lo más a 244 px de ancho; súbelas al doble para que se vean nítidas.</p>
    </div>
  );
}
