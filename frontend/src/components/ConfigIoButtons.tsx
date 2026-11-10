import { useRef, useState } from "react";
import { AlertCircle, Check, Download, Upload } from "../vendor/lucide-react";
import { PulsoButton } from "./PulsoButton";
import { ContenedorEntregable } from "./entregables/ContenedorEntregable";
import { archivoJson, fechaDelNombre } from "./entregables/archivoLocal";
import { nombreConEstudio } from "./entregables/nombreConEstudio";
import { useGeneracion } from "./entregables/useGeneracion";
import "./ConfigIoButtons.css";

// Botones "exportar JSON" + "importar JSON" compartidos.
//
// Exportar es una entrega del kit (ADR 0133, fase 5): el JSON se arma en el
// front (`archivoJson`) y lo entrega `useGeneracion`. El botón solo se
// deshabilita mientras tanto y el resultado, o el fallo, va en el contenedor de
// archivo en forma bloque, en su propia línea bajo los botones (el padre es una
// fila que envuelve). Importar no entrega nada: su resultado es una línea de
// estado junto a los botones.
//
// El consumer pasa dos callbacks: uno que retorna el payload serializable
// (se entrega como JSON), y otro que recibe el objeto parseado del archivo
// importado (y hace lo que corresponda con su store / backend).

export type ConfigIoProps = {
  /**
   * Retorna el payload que se serializa a JSON y se entrega. Puede ser
   * un objeto arbitrario: `ConfigIoButtons` le hace JSON.stringify.
   */
  onExport: () => Promise<unknown>;
  /**
   * Recibe el objeto YA parseado de JSON del archivo que el usuario
   * subió. El caller decide qué hacer con él (enviar al backend,
   * cargar al store, etc.) y opcionalmente retorna un mensaje de éxito
   * que se muestra en el feedback transitorio.
   */
  onImport: (parsed: unknown) => Promise<string | void>;
  /**
   * El entregable en palabras para nombrar el archivo con la regla del motor
   * (ADR 0133 §3): "Plantilla de analítica" →
   * `<Estudio>_Plantilla_de_analitica_dd_mm_yy.json`, con el código de la Ficha
   * del estudio. Manda sobre `filenamePrefix`.
   */
  entregable?: string;
  /**
   * Prefijo del nombre del archivo cuando no se declara `entregable`: se le
   * pega la fecha, `<prefijo>_dd_mm_yy.json`. Default: "prosecnur_config".
   */
  filenamePrefix?: string;
  /** Nombre del archivo en palabras, para el contenedor: "Plantilla de Analítica". Default "Configuración". */
  exportTitulo?: string;
  /** Label del botón exportar (default "Exportar JSON"). */
  exportLabel?: string;
  /** Label del botón importar (default "Importar JSON"). */
  importLabel?: string;
  /** Ayuda del botón de descarga. Útil cuando el label evita jerga técnica. */
  exportTitle?: string;
  /** Ayuda del botón de carga. Útil cuando el label evita jerga técnica. */
  importTitle?: string;
  /** Mensaje de éxito por defecto cuando `onImport` no devuelve texto. */
  importSuccessLabel?: string;
};

const MENSAJE_MS = 3000;

export function ConfigIoButtons({
  onExport,
  onImport,
  entregable,
  filenamePrefix = "prosecnur_config",
  exportTitulo = "Configuración",
  exportLabel = "Exportar JSON",
  importLabel = "Importar JSON",
  exportTitle,
  importTitle,
  importSuccessLabel = "Importado",
}: ConfigIoProps) {
  const exportacion = useGeneracion({ titulo: exportTitulo, formato: "json", articulo: "la" });
  const exportando = exportacion.estado.fase === "en_curso";
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    if (exportando) return;
    setError(""); setMsg("");
    void exportacion.ejecutar(async () => {
      const valor = await onExport();
      const nombre = entregable ? await nombreConEstudio(entregable, "json") : `${filenamePrefix}_${fechaDelNombre()}.json`;
      return archivoJson(valor, nombre);
    });
  }

  async function handleImport(file?: File) {
    if (!file) return;
    setError(""); setMsg(""); setImportando(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const okMsg = await onImport(parsed);
      setMsg(okMsg ?? importSuccessLabel);
      setTimeout(() => setMsg(""), MENSAJE_MS);
    } catch (e) {
      setError(`JSON inválido: ${(e as Error).message}`);
    } finally {
      setImportando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <PulsoButton
        variant="secondary"
        size="sm"
        onClick={handleExport}
        disabled={exportando}
        title={exportTitle}
        aria-label={exportTitle ?? exportLabel}
      >
        <Download size={13} aria-hidden="true" /> {exportLabel}
      </PulsoButton>

      <PulsoButton
        variant="secondary"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={importando}
        aria-busy={importando || undefined}
        title={importTitle}
        aria-label={importTitle ?? importLabel}
      >
        <Upload size={13} aria-hidden="true" /> {importLabel}
      </PulsoButton>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="pulso-sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void handleImport(e.target.files?.[0])}
      />

      {msg && (
        <span role="status" className="pulso-config-io-estado">
          <Check size={12} aria-hidden="true" /> {msg}
        </span>
      )}
      {error && (
        <span role="alert" className="pulso-config-io-error">
          <AlertCircle size={12} aria-hidden="true" /> {error}
        </span>
      )}

      {exportacion.estado.fase !== "inactiva" && (
        <div className="pulso-config-io-entrega">
          <ContenedorEntregable estado={exportacion.estado} forma="bloque" onCerrar={exportacion.cerrar} />
        </div>
      )}
    </>
  );
}
