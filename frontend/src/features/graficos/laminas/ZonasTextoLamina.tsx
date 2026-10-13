// Zonas de texto seleccionables sobre la lámina (maqueta o imagen): antetítulo, título y base. Un clic abre los ajustes
// de la lámina en Contenido con ese campo enfocado, igual que un clic en un gráfico abre su tarjeta. La geometría es la
// del estándar de la lámina (cabecera y pie fijos), así que sirve para elegir, no para medir.

import "./maquetaLamina.css";

export type CampoTextoLamina = "antetitulo" | "titulo" | "base" | "subtitulo" | "fecha" | "subtexto";

type Zona = { campo: CampoTextoLamina; etiqueta: string; x: number; y: number; w: number; h: number };

/** Cajas en fracción de la lámina (13,333 × 7,5 pulgadas): antetítulo, título y pie con la base. */
const ZONAS: Zona[] = [
  { campo: "antetitulo", etiqueta: "Antetítulo", x: 0.037, y: 0.022, w: 0.68, h: 0.036 },
  { campo: "titulo", etiqueta: "Título", x: 0.037, y: 0.058, w: 0.78, h: 0.07 },
  { campo: "base", etiqueta: "Base", x: 0.037, y: 0.912, w: 0.79, h: 0.05 },
];

/**
 * Qué textos de la lámina se pueden tocar: sólo los que su tipo tiene. Portada, índice, separadores y láminas de ayuda
 * no llevan antetítulo ni base (y algunas tampoco un título editable): no se les ofrece un botón que no lleva a nada.
 */
export function camposTextoDe(tipo: string, args: readonly { name: string }[] | undefined, conGraficos: boolean): ReadonlySet<CampoTextoLamina> {
  // Portada, índice, separadores y láminas de ayuda tienen su propio diseño: sus textos se editan en Contenido, sin zonas
  // sobre la lámina (la cabecera estándar no está donde ellas ponen el título).
  if (!conGraficos) return new Set();
  const nombres = new Set((args ?? []).map((a) => a.name));
  const campos = new Set<CampoTextoLamina>();
  if (nombres.has("titulo")) campos.add("titulo");
  if (conGraficos && tipo !== "p_slide_seccion") campos.add("antetitulo");
  if (conGraficos && (nombres.has("base") || nombres.has("nota") || nombres.has("pie"))) campos.add("base");
  return campos;
}

// La portada pone sus textos donde los dibuja `.lam_laminas_portada` (api/R/lamina_identidad.R), en pulgadas sobre
// 13,333 × 7,5, una geometría por composición. Antes sólo el título tenía zona y la fecha no se podía tocar sobre la
// lámina (Gonzalo, 2026-10-13: «la fecha no es un botón clickeable que me lleva a poder editarlo»).
const W = 13.333;
const H = 7.5;
const enPulgadas = (campo: CampoTextoLamina, etiqueta: string, x: number, y: number, w: number, h: number): Zona =>
  ({ campo, etiqueta, x: x / W, y: y / H, w: w / W, h: h / H });

const ZONAS_PORTADA: Record<"centrada" | "izquierda" | "banda", Zona[]> = {
  centrada: [
    enPulgadas("subtitulo", "Subtítulo", 1.6, 2.06, 10.1, 0.36),
    enPulgadas("titulo", "Título", 1.3, 2.46, 10.7, 1.5),
    enPulgadas("subtexto", "Texto descriptivo", 1.6, 4.62, 10.1, 0.44),
    enPulgadas("fecha", "Fecha", 1.6, 5.1, 10.1, 0.42),
  ],
  izquierda: [
    enPulgadas("subtitulo", "Subtítulo", 1.08, 2.2, 8, 0.36),
    enPulgadas("titulo", "Título", 1.08, 2.6, 9.6, 1.3),
    enPulgadas("subtexto", "Texto descriptivo", 1.08, 4.42, 9.6, 0.4),
    enPulgadas("fecha", "Fecha", 1.08, 4.83, 9.6, 0.38),
  ],
  banda: [
    enPulgadas("subtitulo", "Subtítulo", 1.6, 2.2, 10.1, 0.36),
    enPulgadas("titulo", "Título", 1.4, 2.6, 10.5, 1.3),
    enPulgadas("subtexto", "Texto descriptivo", 1.6, H - 0.98, 10.1, 0.38),
    enPulgadas("fecha", "Fecha", 1.6, H - 0.6, 10.1, 0.34),
  ],
};

/** Las zonas de la portada según su composición (`meta.variante`); `null` para cualquier otro tipo. */
export function zonasPortada(tipo: string, variante: string | null | undefined): readonly Zona[] | null {
  if (tipo !== "p_slide_portada") return null;
  const v = variante === "izquierda" || variante === "banda" ? variante : "centrada";
  return ZONAS_PORTADA[v];
}

export function ZonasTextoLamina({ onTexto, campos, zonas = ZONAS }: {
  onTexto: (campo: CampoTextoLamina) => void;
  campos: ReadonlySet<CampoTextoLamina>;
  /** Por defecto, la cabecera y el pie estándar; la portada pasa las suyas (`zonasPortada`). */
  zonas?: readonly Zona[];
}) {
  const visibles = zonas === ZONAS ? zonas.filter((z) => campos.has(z.campo)) : zonas;
  if (!visibles.length) return null;
  return (
    <div className="pulso-f6-textos-capa" role="group" aria-label="Textos de la lámina">
      {visibles.map((z) => (
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
