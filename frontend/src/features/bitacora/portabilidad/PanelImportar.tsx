import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  FileUp,
  Plus,
  RefreshCw,
  X,
} from "../../../vendor/lucide-react";

import {
  apiBitacoraImportAplicar,
  apiBitacoraImportRevisar,
  type BitacoraEstado,
  type BitacoraImportRevision,
} from "../../../api/bitacora";
import { toast } from "../../../components/toasterStore";
import "./portabilidad.css";

/**
 * Importación del mapa del estudio, en dos pasos (ADR 0047).
 *
 * El primer paso es la razón de ser de este panel: el archivo se REVISA contra
 * el proyecto y se muestra qué crearía y qué reemplazaría, sin haber escrito
 * nada todavía. Recién con eso a la vista aparece el botón que aplica.
 *
 * El `token` que devuelve la revisión la ata al estado que la produjo. Si algo
 * cambió en el medio, aplicar falla con 409 y hay que revisar de nuevo: sin esa
 * ligadura se mostraría un plan y se aplicaría otro.
 */
export function PanelImportar({
  onImportado,
  onCerrar,
}: {
  onImportado: (estado: BitacoraEstado) => void;
  onCerrar: () => void;
}) {
  const [documento, setDocumento] = useState<unknown>(null);
  const [nombre, setNombre] = useState("");
  const [revision, setRevision] = useState<BitacoraImportRevision | null>(null);
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const entradaRef = useRef<HTMLInputElement>(null);

  const revisar = useCallback(async (doc: unknown, archivo: string) => {
    setTrabajando(true);
    setError("");
    try {
      const r = await apiBitacoraImportRevisar(doc);
      setDocumento(doc);
      setNombre(archivo);
      setRevision(r);
    } catch (e) {
      setRevision(null);
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setTrabajando(false);
    }
  }, []);

  const alElegirArchivo = useCallback(
    async (archivo: File | undefined) => {
      if (!archivo) return;
      try {
        setDocumento(null);
        setRevision(null);
        await revisar(JSON.parse(await archivo.text()), archivo.name);
      } catch {
        setError("El archivo no es JSON válido.");
      }
    },
    [revisar],
  );

  const aplicar = useCallback(async () => {
    if (!revision?.aplicable || !documento) return;
    setTrabajando(true);
    try {
      const estado = await apiBitacoraImportAplicar(documento, revision.token);
      onImportado(estado);
      toast.exito("Mapa importado", {
        detalle: `${plural(revision.crea.length, "nuevo")}, ${plural(revision.actualiza.length, "actualizado")}.`,
      });
      onCerrar();
    } catch (e) {
      // El 409 no es un fallo del usuario: el proyecto cambió y hay que volver
      // a revisar. Se lo dice acá y se le deja el botón para rehacerlo.
      setError(e instanceof Error ? e.message : "No se pudo importar.");
      setRevision(null);
    } finally {
      setTrabajando(false);
    }
  }, [documento, onCerrar, onImportado, revision]);

  return (
    <div
      className="bport-fondo"
      role="presentation"
      // Click afuera y Escape cierran: es un diálogo, y quedarse encerrado en
      // una vista previa que no se aplicó no le sirve a nadie.
      onClick={(event) => { if (event.target === event.currentTarget) onCerrar(); }}
      onKeyDown={(event) => { if (event.key === "Escape") onCerrar(); }}
    >
    <div
      className="bport"
      role="dialog"
      aria-modal="true"
      aria-label="Importar mapa del estudio"
      data-qa-geometry-group="bitacora-importar"
      data-qa-geometry-contract="intrinsic"
      data-qa-geometry-capacity="owned"
    >
      <header className="bport-cabecera">
        <h2>Importar mapa del estudio</h2>
        <button type="button" onClick={onCerrar} aria-label="Cerrar">
          <X size={15} />
        </button>
      </header>

      <input
        ref={entradaRef}
        type="file"
        accept="application/json,.json"
        className="pulso-sr-only"
        onChange={(event) => void alElegirArchivo(event.target.files?.[0])}
      />

      <button type="button" className="bport-elegir" onClick={() => entradaRef.current?.click()}>
        <FileUp size={15} />
        <span>{nombre || "Elegir archivo .json"}</span>
      </button>

      {error && (
        <p className="bport-error" role="alert">
          <AlertTriangle size={13} aria-hidden="true" />
          {error}
        </p>
      )}

      {revision && (
        <div className="bport-revision">
          {/* La vista previa: qué va a pasar, ANTES de que pase. */}
          <ul className="bport-balance">
            <li className="is-crea">
              <Plus size={13} aria-hidden="true" />
              <strong>{revision.crea.length}</strong>
              <span>por crear</span>
            </li>
            <li className="is-actualiza">
              <RefreshCw size={13} aria-hidden="true" />
              <strong>{revision.actualiza.length}</strong>
              <span>por reemplazar</span>
            </li>
            {revision.errores.length > 0 && (
              <li className="is-error">
                <AlertTriangle size={13} aria-hidden="true" />
                <strong>{revision.errores.length}</strong>
                <span>con problemas</span>
              </li>
            )}
          </ul>

          {revision.actualiza.length > 0 && (
            <Detalle
              titulo="Se reemplazan"
              nota="Estos ya existen en el proyecto y el archivo pisa su contenido."
              filas={revision.actualiza.map((f) => ({ clave: f.id, texto: f.etiqueta, ala: etiquetaTipo(f.tipo) }))}
            />
          )}

          {revision.crea.length > 0 && (
            <Detalle
              titulo="Se agregan"
              nota="No existen todavía en este proyecto."
              filas={revision.crea.map((f) => ({ clave: f.id, texto: f.etiqueta, ala: etiquetaTipo(f.tipo) }))}
            />
          )}

          {revision.errores.length > 0 && (
            <Detalle
              titulo="Hay que resolver esto primero"
              nota="Mientras estén, no se importa nada: media importación es peor que ninguna."
              filas={revision.errores.map((f) => ({
                clave: `${f.tipo}-${f.id}`,
                texto: f.motivo,
                ala: etiquetaTipo(f.tipo),
              }))}
              tono="error"
            />
          )}

          <p className="bport-nota">
            Lo que el archivo no menciona se conserva: importar suma, no reemplaza el proyecto.
          </p>
        </div>
      )}

      <footer className="bport-pie">
        <button type="button" onClick={onCerrar}>
          Cancelar
        </button>
        <button
          type="button"
          className="is-primario"
          disabled={!revision?.aplicable || trabajando}
          onClick={() => void aplicar()}
        >
          <CheckCheck size={14} />
          <span>{trabajando ? "Importando…" : "Importar"}</span>
        </button>
      </footer>
    </div>
    </div>
  );
}

function Detalle({
  titulo,
  nota,
  filas,
  tono,
}: {
  titulo: string;
  nota: string;
  filas: { clave: string; texto: string; ala: string }[];
  tono?: "error";
}) {
  return (
    <details className={`bport-detalle${tono ? ` is-${tono}` : ""}`} open={tono === "error"}>
      <summary>
        {titulo} <span>{filas.length}</span>
      </summary>
      <p>{nota}</p>
      {/* Columnas declaradas una vez y heredadas: el tipo y el nombre caen en
          la misma x aunque las listas tengan largos distintos. */}
      <ul>
        {filas.map((f) => (
          <li key={f.clave}>
            <em>{f.ala}</em>
            <span>{f.texto || f.clave}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** «1 nuevo» y no «1 nuevos»: el resumen de una importación se lee, no se parsea. */
function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

function etiquetaTipo(tipo: string): string {
  if (tipo === "tarea") return "Hito";
  if (tipo === "entrada") return "Entrada";
  if (tipo === "lienzo") return "Lienzo";
  return tipo;
}
