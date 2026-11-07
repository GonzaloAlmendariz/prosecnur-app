// Contrato del kit de entregables (ADR 0133, fase 4 de «descargas unificadas»).
//
// Un entregable es un archivo que la app genera y deja en manos del usuario.
// Estos dos tipos son lo único que una pantalla necesita conocer: qué archivo
// salió (`ArchivoEntregable`) y en qué punto está su generación
// (`EstadoGeneracion`). El hook `useGeneracion` produce el estado y
// `ContenedorEntregable` lo dibuja.

/** Un archivo entregado, ya normalizado desde la respuesta del backend. */
export type ArchivoEntregable = {
  fileId: string;
  nombre: string;
  /** Extensión en minúsculas («xlsx», «pdf»); vacía si el nombre no la trae. */
  formato: string;
  tamano?: number | null;
  /** Ruta absoluta de la copia junto al proyecto (`Entregables\<Módulo>`), o null. */
  guardadoEn?: string | null;
  /** Por qué no se copió junto al proyecto, o null. */
  avisoGuardado?: string | null;
  modulo?: string | null;
  rotulo?: string | null;
};

export type EstadoGeneracion =
  | { fase: "inactiva" }
  | {
      fase: "en_curso";
      titulo: string;
      /** Formato esperado («xlsx», «pptx») si se sabe de antemano; sin él, el ícono va sin sigla. */
      formato?: string | null;
      paso?: number;
      pasos?: number;
      mensaje?: string;
      /** 0–100; null o ausente = el motor no reporta avance (línea indeterminada). */
      porcentaje?: number | null;
      cancelar?: () => void;
    }
  | {
      fase: "lista";
      titulo: string;
      archivos: ArchivoEntregable[];
      /** Ruta donde Electron dejó la descarga (Descargas), si la avisó. */
      rutaDescargada?: string | null;
    }
  | {
      fase: "fallo";
      /** Lo que no se pudo generar: «No se pudieron generar las frecuencias». */
      titulo: string;
      formato?: string | null;
      causa: string;
      codigo?: string | null;
      reintentar?: () => void;
    };

/** Dónde vive el contenedor respecto del botón que dispara la generación. */
export type FormaContenedor = "bloque" | "anclada" | "fila";
