import type { MailTemplate } from "../../../api/materialMail";
import { AlertCircle } from "../../../vendor/lucide-react";
import { claseDeImagen, fraseDeLoQueFaltaDe, rotuloDeLogo } from "./nombresDeImagen";
import { SubirArchivo } from "./SubirArchivo";

type Props = {
  template: Pick<MailTemplate, "header" | "images" | "blocks">;
  /** Imágenes de la cabecera sin archivo (las que la revisión marca). */
  ids: readonly string[];
  ocupado: boolean;
  onSubir: (id: string, file: File) => void;
};

/**
 * H7: lo que falta subir de la cabecera, uno por renglón, con su botón. Dice
 * la causa («Falta el logo 2», sin nombrar a nadie) y el arreglo ahí mismo.
 */
export function LoQueFaltaSubir({ template, ids, ocupado, onSubir }: Props) {
  if (!ids.length) return null;
  return (
    <ul className="rec-capa-chequeos" aria-label="Por subir">
      {ids.map((id) => {
        const banner = claseDeImagen(template, id) === "banner";
        const frase = fraseDeLoQueFaltaDe(template, id);
        return (
          <li key={id} className="rec-capa-chequeo is-error rec-capa-falta">
            <AlertCircle size={14} aria-hidden />
            <span>{frase}: súbelo aquí.</span>
            <SubirArchivo
              etiqueta={banner ? "Subir banner" : "Subir logo"}
              ariaLabel={banner ? "Subir el banner" : `Subir el ${rotuloDeLogo(template, id).toLocaleLowerCase("es-PE")}`}
              disabled={ocupado}
              onArchivo={(file) => onSubir(id, file)}
            />
          </li>
        );
      })}
    </ul>
  );
}
