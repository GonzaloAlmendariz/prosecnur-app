// Importar un correo existente (addendum E1l): estado y acciones del diálogo
// `correo-importar`.
//
// Leer un HTML es una lectura pura del backend (`mail-template/import-html`):
// no escribe el estado. Lo que vuelve —la plantilla, el informe y su
// `import_id`— vive aquí mientras el diálogo está abierto. Después hay dos
// salidas:
// - «Crear campaña»: POST mail-campaigns con la plantilla y su `import_id`;
// - «Reemplazar la plantilla de esta campaña»: el borrador pasa a ser la
//   plantilla importada (entra al historial, se deshace con ⌘Z) y el próximo
//   guardado cita el `import_id`.
//
// El HTML crudo nunca se guarda: ni aquí después de leerlo, ni en el `.pulso`.

import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  MAIL_IMPORT_HTML_MAX_BYTES,
  MailApiError,
  apiMailImportHtml,
  apiMailPreview,
  type MailImportHtml,
  type MailPlatform,
} from "../../../api/materialMail";

export type FuenteDelHtml = "archivo" | "pegar";

export type EstadoImportar = {
  fuente: FuenteDelHtml;
  archivo: File | null;
  texto: string;
  asunto: string;
  fase: "fuente" | "leyendo" | "listo" | "aplicando";
  error: string;
  resultado: MailImportHtml | null;
  /** HTML de la vista previa de la plantilla importada (para «Ver»). */
  vista: string | null;
  vistaError: string;
  nombre: string;
  plataforma: MailPlatform;
  /** Bloque que el informe pidió ver. */
  visto: string | null;
};

export type AccionImportar =
  | { type: "fuente"; fuente: FuenteDelHtml }
  | { type: "archivo"; archivo: File | null }
  | { type: "texto"; texto: string }
  | { type: "asunto"; asunto: string }
  | { type: "leyendo" }
  | { type: "leido"; resultado: MailImportHtml; nombre: string; plataforma: MailPlatform }
  | { type: "fallo"; error: string }
  | { type: "vista"; html: string | null; error?: string }
  | { type: "nombre"; nombre: string }
  | { type: "plataforma"; plataforma: MailPlatform }
  | { type: "ver"; blockId: string | null }
  | { type: "aplicando" }
  | { type: "aplicado-fallo"; error: string }
  | { type: "otra" }
  | { type: "reiniciar"; plataforma: MailPlatform };

export function estadoInicialImportar(plataforma: MailPlatform): EstadoImportar {
  return {
    fuente: "archivo",
    archivo: null,
    texto: "",
    asunto: "",
    fase: "fuente",
    error: "",
    resultado: null,
    vista: null,
    vistaError: "",
    nombre: "",
    plataforma,
    visto: null,
  };
}

export function reducirImportar(s: EstadoImportar, a: AccionImportar): EstadoImportar {
  switch (a.type) {
    case "fuente":
      return { ...s, fuente: a.fuente, error: "" };
    case "archivo":
      return { ...s, archivo: a.archivo, error: "" };
    case "texto":
      return { ...s, texto: a.texto, error: "" };
    case "asunto":
      return { ...s, asunto: a.asunto };
    case "leyendo":
      return { ...s, fase: "leyendo", error: "" };
    case "leido":
      return { ...s, fase: "listo", resultado: a.resultado, nombre: a.nombre, plataforma: a.plataforma, vista: null, vistaError: "", visto: null };
    case "fallo":
      return { ...s, fase: "fuente", error: a.error };
    case "vista":
      return { ...s, vista: a.html, vistaError: a.error ?? "" };
    case "nombre":
      return { ...s, nombre: a.nombre, error: "" };
    case "plataforma":
      return { ...s, plataforma: a.plataforma };
    case "ver":
      return { ...s, visto: a.blockId };
    case "aplicando":
      return { ...s, fase: "aplicando", error: "" };
    case "aplicado-fallo":
      return { ...s, fase: "listo", error: a.error };
    case "otra":
      // Leer otro: se olvida el resultado (y con él, el HTML que se leyó).
      return { ...estadoInicialImportar(s.plataforma), fuente: s.fuente };
    case "reiniciar":
      return estadoInicialImportar(a.plataforma);
  }
}

/** Bytes del texto pegado, como los contará el backend (UTF-8). */
export function bytesDelTexto(texto: string): number {
  return new TextEncoder().encode(texto).length;
}

/** Por qué no se puede leer todavía, o `null`. */
export function problemaDeLaFuente(s: Pick<EstadoImportar, "fuente" | "archivo" | "texto">): string | null {
  if (s.fuente === "archivo") {
    if (!s.archivo) return "Elige un archivo .html.";
    if (!/\.html?$/i.test(s.archivo.name) && s.archivo.type !== "text/html") return "El archivo tiene que ser un .html.";
    if (s.archivo.size > MAIL_IMPORT_HTML_MAX_BYTES) return "El archivo supera 512 KB.";
    return null;
  }
  if (!s.texto.trim()) return "Pega el código HTML del correo.";
  if (bytesDelTexto(s.texto) > MAIL_IMPORT_HTML_MAX_BYTES) return "El código supera 512 KB.";
  return null;
}

/** El nombre de la campaña nueva: el título del correo, o el del archivo. */
export function nombreSugerido(resultado: Pick<MailImportHtml, "template">, archivo: File | null): string {
  const titulo = resultado.template.title?.trim();
  if (titulo) return titulo.slice(0, 80);
  const base = archivo?.name.replace(/\.html?$/i, "").replace(/[-_]+/g, " ").trim();
  return (base || "Correo importado").slice(0, 80);
}

const AVISO_DE_LECTURA: Record<string, string> = {
  E_COLLECTION_MAIL_IMPORT_HTML_TOO_LARGE: "El HTML supera 512 KB: no se puede leer.",
  E_COLLECTION_MAIL_IMPORT_HTML_INVALID: "No se pudo leer ese HTML como correo: está vacío, es demasiado grande o tiene demasiados niveles.",
};

export function avisoDeLectura(cause: unknown): string {
  if (cause instanceof MailApiError && AVISO_DE_LECTURA[cause.code]) {
    return cause.code === "E_COLLECTION_MAIL_IMPORT_HTML_INVALID" && cause.message ? `${AVISO_DE_LECTURA[cause.code]} ${cause.message}` : AVISO_DE_LECTURA[cause.code];
  }
  return cause instanceof Error && cause.message ? cause.message : "No se pudo leer el correo.";
}

/**
 * `campanaDeVista(plataforma)`: una campaña con esa plataforma para pedir la
 * vista previa con su pie; `null` si no hay (se usa la de fábrica).
 */
export function useImportarHtml(opciones: { abierto: boolean; plataforma: MailPlatform; campanaDeVista: (p: MailPlatform) => string | null }) {
  const [estado, despachar] = useReducer(reducirImportar, opciones.plataforma, estadoInicialImportar);
  const vivo = useRef(true);
  const turno = useRef(0);
  const turnoVista = useRef(0);
  const campanaDeVista = useRef(opciones.campanaDeVista);
  campanaDeVista.current = opciones.campanaDeVista;

  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  // Cerrar el diálogo olvida lo leído.
  useEffect(() => {
    if (!opciones.abierto) despachar({ type: "reiniciar", plataforma: opciones.plataforma });
  }, [opciones.abierto, opciones.plataforma]);

  const leer = useCallback(async () => {
    const problema = problemaDeLaFuente(estado);
    if (problema) {
      despachar({ type: "fallo", error: problema });
      return;
    }
    despachar({ type: "leyendo" });
    const pedido = ++turno.current;
    try {
      const resultado = estado.fuente === "archivo" && estado.archivo
        ? await apiMailImportHtml({ file: estado.archivo, subject: estado.asunto })
        : await apiMailImportHtml({ html: estado.texto, file_name: "correo-pegado.html", subject: estado.asunto });
      if (!vivo.current || pedido !== turno.current) return;
      despachar({
        type: "leido",
        resultado,
        nombre: nombreSugerido(resultado, estado.fuente === "archivo" ? estado.archivo : null),
        plataforma: resultado.platform_detected ?? opciones.plataforma,
      });
    } catch (cause) {
      if (vivo.current && pedido === turno.current) despachar({ type: "fallo", error: avisoDeLectura(cause) });
    }
  }, [estado, opciones.plataforma]);

  // La vista previa de lo importado, con el pie de la plataforma elegida.
  const plantilla = estado.resultado?.template ?? null;
  useEffect(() => {
    if (!plantilla) return;
    const pedido = ++turnoVista.current;
    apiMailPreview({ mode: "preview", template: plantilla, campaign_id: campanaDeVista.current(estado.plataforma) }).then(
      (preview) => { if (vivo.current && pedido === turnoVista.current) despachar({ type: "vista", html: preview.html }); },
      (cause: unknown) => {
        if (vivo.current && pedido === turnoVista.current) {
          despachar({ type: "vista", html: null, error: cause instanceof Error && cause.message ? cause.message : "No se pudo armar la vista previa." });
        }
      },
    );
  }, [estado.plataforma, plantilla]);

  return { estado, despachar, leer };
}

export type ImportarHtml = ReturnType<typeof useImportarHtml>;
