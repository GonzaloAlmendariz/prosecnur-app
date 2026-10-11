// Lectura de la vista previa de una lámina para el visor (F6.1; dirección F6 §4.1 «Visor», §4.8 estados).
//
// `POST /api/graficos/preview-slide` con `preview_partes` devuelve la imagen de cada parte «(cont.)», cómo salió cada
// una (nativa, estructura, ruta anterior, sin gráfico) y los avisos sellados del motor. El backend serializa con
// auto_unbox: una lista de un elemento puede llegar como escalar y una parte sin imagen como objeto vacío. Aquí se
// normaliza una sola vez para que la UI no repita esas defensas.

import { normalizeMotivoSinImagen, type MotivoSinImagen, type PreviewSlideParte, type PreviewSlideResponse } from "../../../api/graficos";

export type EstadoSalida = PreviewSlideParte["estado"];

export type ParteVisor = {
  /** 1-based. */
  indice: number;
  titulo: string;
  estado: EstadoSalida | null;
  continuacion: boolean;
  /** data URI de la parte rasterizada, o null si el motor no la rasterizó (truncado, renderer ausente). */
  imagen: string | null;
  ancho: number | null;
  alto: number | null;
};

export type LaminaVisor = {
  partes: ParteVisor[];
  avisos: string[];
  /** El backend rasteriza hasta 6 partes; si hay más, lo dice. */
  truncado: boolean;
  renderer: string | null;
  /** No hubo imagen: sin renderer o falló la rasterización; el PPTX sí se generó. */
  sinImagen: boolean;
  /** Por qué no hubo imagen, si el backend lo dijo; null con imagen o sin motivo conocido. */
  motivoSinImagen: MotivoSinImagen | null;
  /** El mini-PPTX de esta lámina, descargable. */
  fileId: string | null;
};

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const comoLista = <T>(v: T | T[] | null | undefined): T[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

const ESTADOS: ReadonlySet<string> = new Set(["nativa", "estructura", "ruta_anterior", "sin_grafico", "marco"]);

export function leerLaminaVisor(r: PreviewSlideResponse): LaminaVisor {
  const imagenes = new Map<number, { png: string; w: number | null; h: number | null; renderer: string }>();
  for (const p of comoLista(r.slide_previews)) {
    if (!esObjeto(p) || typeof p.png_base64 !== "string" || !p.png_base64.startsWith("data:image/")) continue;
    const indice = Number(p.indice) || 1;
    imagenes.set(indice, {
      png: p.png_base64,
      w: typeof p.width === "number" ? p.width : null,
      h: typeof p.height === "number" ? p.height : null,
      renderer: typeof p.renderer === "string" ? p.renderer : "",
    });
  }
  // Backend sin `slide_previews` (o sin `preview_partes`): la única imagen es la de la parte 1.
  if (!imagenes.size && r.slide_preview?.png_base64?.startsWith("data:image/")) {
    imagenes.set(1, { png: r.slide_preview.png_base64, w: r.slide_preview.width, h: r.slide_preview.height, renderer: r.slide_preview.renderer });
  }

  const declaradas = comoLista(r.partes?.partes).filter(esObjeto);
  const n = Math.max(Number(r.partes?.n) || 0, declaradas.length, imagenes.size ? Math.max(...imagenes.keys()) : 0, 1);
  const partes: ParteVisor[] = [];
  for (let i = 1; i <= n; i += 1) {
    const d = declaradas.find((p) => Number(p.indice) === i) ?? declaradas[i - 1];
    const img = imagenes.get(i);
    const estado = d && typeof d.estado === "string" && ESTADOS.has(d.estado) ? (d.estado as EstadoSalida) : null;
    partes.push({
      indice: i,
      titulo: d && typeof d.titulo === "string" ? d.titulo : "",
      estado,
      continuacion: d ? d.continuacion === true : i > 1,
      imagen: img?.png ?? null,
      ancho: img?.w ?? null,
      alto: img?.h ?? null,
    });
  }

  const avisos = comoLista(r.avisos).filter((a): a is string => typeof a === "string" && a.trim() !== "").map((a) => a.trim());
  const renderer = [...imagenes.values()][0]?.renderer || null;
  return {
    partes,
    avisos: [...new Set(avisos)],
    truncado: r.partes?.truncado === true,
    renderer,
    sinImagen: imagenes.size === 0,
    motivoSinImagen: imagenes.size === 0 ? normalizeMotivoSinImagen(r.motivo_sin_imagen) : null,
    fileId: typeof r.file_id === "string" && r.file_id ? r.file_id : null,
  };
}

/** Estado de la lámina entera: la peor de sus partes (una parte por la ruta anterior basta para avisarlo). */
export function estadoDeLamina(lamina: LaminaVisor): EstadoSalida | null {
  const estados = lamina.partes.map((p) => p.estado).filter((e): e is EstadoSalida => !!e);
  if (estados.includes("ruta_anterior")) return "ruta_anterior";
  if (estados.includes("nativa")) return "nativa";
  if (estados.includes("marco")) return "marco";
  if (estados.includes("estructura")) return "estructura";
  if (estados.includes("sin_grafico")) return "sin_grafico";
  return null;
}

export const ETIQUETA_ESTADO: Record<EstadoSalida, string> = {
  nativa: "Nativa",
  estructura: "Nativa",
  ruta_anterior: "Ruta anterior",
  sin_grafico: "Sin gráfico",
  marco: "Marco",
};

/**
 * Por qué sale así, en una línea. `motorNativoApagado` es la elección explícita del analista (`meta.motor_nativo`);
 * `hayAvisos` evita mandar a leer avisos que no existen (el motor no siempre deja uno al caer a la ruta anterior).
 */
export function motivoDeEstado(estado: EstadoSalida | null, motorNativoApagado: boolean, hayAvisos = false): string {
  switch (estado) {
    case "nativa":
      return "El motor la dibuja con formas nativas de PowerPoint: se puede editar en el archivo.";
    case "estructura":
      return "Lámina de estructura dibujada por el motor con formas nativas.";
    case "ruta_anterior":
      return motorNativoApagado
        ? "Elegiste la ruta anterior para esta lámina: el gráfico sale como imagen."
        : hayAvisos
          ? "El motor no la dibujó con formas nativas y usó la ruta anterior: el gráfico sale como imagen. Los avisos dicen por qué."
          : "El motor no la dibujó con formas nativas y usó la ruta anterior: el gráfico sale como imagen. No dejó un aviso que diga por qué.";
    case "sin_grafico":
      return "La lámina no lleva gráfico: sólo texto o plantilla.";
    case "marco":
      return "El gráfico se dibuja aparte (nube de palabras, serie de varias mediciones) y la lámina lleva el título y el pie del recetario.";
    default:
      return "El motor no informó cómo salió esta lámina.";
  }
}

export type MensajeSinImagen = { titulo: string; detalle: string; reintentable: boolean };

/** Qué dice el visor cuando la lámina salió sin imagen: la causa, no una suposición. Sólo la falta de LibreOffice no se
 *  arregla reintentando. */
export function mensajeSinImagen(motivo: MotivoSinImagen | null): MensajeSinImagen {
  switch (motivo) {
    case "renderer_ausente":
      return {
        titulo: "No hay con qué dibujar la vista previa",
        detalle: "Este equipo no tiene LibreOffice. La exportación a PowerPoint no se ve afectada.",
        reintentable: false,
      };
    case "renderer_timeout":
      return {
        titulo: "LibreOffice tardó demasiado en dibujar esta lámina",
        detalle: "El archivo de PowerPoint sí se generó.",
        reintentable: true,
      };
    case "raster_fallido":
      return { titulo: "No se pudo pasar la lámina a imagen", detalle: "El archivo de PowerPoint sí se generó.", reintentable: true };
    default:
      return { titulo: "LibreOffice no pudo dibujar esta lámina", detalle: "El archivo de PowerPoint sí se generó.", reintentable: true };
  }
}
