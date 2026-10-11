// Zonas de texto seleccionables sobre la lámina (maqueta o imagen): antetítulo, título y base. Un clic abre los ajustes
// de la lámina en Contenido con ese campo enfocado, igual que un clic en un gráfico abre su tarjeta. La geometría es la
// del estándar de la lámina (cabecera y pie fijos), así que sirve para elegir, no para medir.

import "./maquetaLamina.css";

export type CampoTextoLamina = "antetitulo" | "titulo" | "base";

/** Cajas en fracción de la lámina (13,333 × 7,5 pulgadas): antetítulo, título y pie con la base. */
const ZONAS: { campo: CampoTextoLamina; etiqueta: string; x: number; y: number; w: number; h: number }[] = [
  { campo: "antetitulo", etiqueta: "Antetítulo", x: 0.037, y: 0.022, w: 0.68, h: 0.036 },
  { campo: "titulo", etiqueta: "Título", x: 0.037, y: 0.058, w: 0.78, h: 0.07 },
  { campo: "base", etiqueta: "Base", x: 0.037, y: 0.912, w: 0.79, h: 0.05 },
];

export function ZonasTextoLamina({ onTexto, sinAntetitulo = false }: { onTexto: (campo: CampoTextoLamina) => void; sinAntetitulo?: boolean }) {
  return (
    <div className="pulso-f6-textos-capa" role="group" aria-label="Textos de la lámina">
      {ZONAS.filter((z) => !(sinAntetitulo && z.campo === "antetitulo")).map((z) => (
        <button
          key={z.campo}
          type="button"
          className="pulso-f6-ranura-zona pulso-f6-texto-zona"
          style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%` }}
          aria-label={`Editar ${z.etiqueta.toLowerCase()}`}
          onClick={() => onTexto(z.campo)}
        >
          <span className="pulso-f6-ranura-etiqueta" aria-hidden="true">{z.etiqueta}</span>
        </button>
      ))}
    </div>
  );
}
