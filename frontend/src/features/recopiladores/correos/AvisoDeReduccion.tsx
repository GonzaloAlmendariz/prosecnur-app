import type { MailImageReduccion } from "../../../api/materialMail";
import { Check } from "../../../vendor/lucide-react";
import { lineaDeReduccion } from "./reduccionDeImagen";
import { useCorreosStore } from "./store";
import "./correosReduccion.css";

/**
 * La línea que dice que el backend redujo una imagen al subirla; nada si no la
 * redujo. Es un `<span>` para poder ir dentro de las filas de logos.
 */
export function LineaDeReduccion({ reduccion }: { reduccion: MailImageReduccion | null | undefined }) {
  const linea = lineaDeReduccion(reduccion);
  if (!linea) return null;
  return (
    <span className="rec-img-reducida" role="status">
      <Check size={13} aria-hidden className="rec-img-reducida-icono" />
      <span>
        {linea.texto}
        {linea.aviso ? <span className="rec-img-reducida-aviso"> {linea.aviso}</span> : null}
      </span>
    </span>
  );
}

/** Junto a una imagen del correo: lo que pasó con su última subida en esta sesión. */
export function AvisoDeReduccion({ imageId }: { imageId: string }) {
  const reduccion = useCorreosStore((st) => st.reducciones[imageId]);
  return <LineaDeReduccion reduccion={reduccion} />;
}
