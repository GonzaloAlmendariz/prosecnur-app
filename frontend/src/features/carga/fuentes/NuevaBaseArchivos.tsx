// «Agregar base» desde archivos (propuesta F): una base nueva con su nombre, su formulario (XLSForm) y sus respuestas.
// Sube los dos archivos y registra la base (`POST /api/estudio/base`); las demás bases no se tocan.

import { useId, useState } from "react";
import { apiUpload, uploadKindForDataFile } from "../../../api/client";
import { apiEstudioAddBase, apiEstudioGet, type EstudioPayload } from "../../../api/estudio";
import { PulsoButton } from "../../../components/PulsoButton";
import { FileSpreadsheet, Upload } from "../../../vendor/lucide-react";

export function errorNombreBase(nombre: string, existentes: readonly string[]): string | null {
  const n = nombre.trim();
  if (!n) return null; // vacío: el motor le pone uno
  if (/\s|\$/.test(n)) return "Sin espacios ni «$»: por ejemplo «egresados» o «docentes_tp».";
  if (existentes.includes(n)) return "Ya hay una base con ese nombre.";
  return null;
}

function CampoArchivo({ rotulo, ayuda, aceptar, archivo, onArchivo }: { rotulo: string; ayuda: string; aceptar: string; archivo: File | null; onArchivo: (f: File | null) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className={archivo ? "pulso-bde-archivo is-listo" : "pulso-bde-archivo"}>
      <FileSpreadsheet size={18} aria-hidden="true" />
      <span>
        <strong>{rotulo}</strong>
        <small>{archivo ? archivo.name : ayuda}</small>
      </span>
      <input id={id} type="file" accept={aceptar} className="pulso-sr-only" onChange={(e) => onArchivo(e.target.files?.[0] ?? null)} />
    </label>
  );
}

export function NuevaBaseArchivos({ estudio, onCambio }: { estudio: EstudioPayload; onCambio: (p: EstudioPayload) => Promise<void> | void }) {
  const idNombre = useId();
  const [nombre, setNombre] = useState("");
  const [formulario, setFormulario] = useState<File | null>(null);
  const [respuestas, setRespuestas] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const problema = errorNombreBase(nombre, Object.keys(estudio.bases ?? {}));
  const listo = !!formulario && !!respuestas && !problema && !subiendo;

  const crear = async () => {
    if (!formulario || !respuestas) return;
    setSubiendo(true);
    setError("");
    try {
      const xls = await apiUpload(formulario, "xlsform");
      const data = await apiUpload(respuestas, uploadKindForDataFile(respuestas));
      await apiEstudioAddBase({ nombre: nombre.trim() || undefined, xlsform_file_id: xls.file_id, data_file_id: data.file_id });
      await onCambio(await apiEstudioGet());
      setNombre("");
      setFormulario(null);
      setRespuestas(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la base.");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="pulso-bde-nueva">
      <label htmlFor={idNombre} className="pulso-bde-nueva-nombre">
        <span>Nombre de la base</span>
        <input id={idNombre} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo, egresados" aria-invalid={problema ? true : undefined} />
        <small className={problema ? "is-error" : undefined}>{problema ?? "El actor que responde. Si lo dejas vacío, se toma del formulario."}</small>
      </label>
      <div className="pulso-bde-nueva-archivos">
        <CampoArchivo rotulo="Formulario" ayuda="El XLSForm en Excel (.xlsx)" aceptar=".xlsx,.xls" archivo={formulario} onArchivo={setFormulario} />
        <CampoArchivo rotulo="Respuestas" ayuda="Excel, CSV, SPSS o ZIP" aceptar=".xlsx,.csv,.sav,.zip" archivo={respuestas} onArchivo={setRespuestas} />
      </div>
      {error ? <p className="pulso-bde-error" role="alert">{error}</p> : null}
      <div>
        <PulsoButton variant="primary" size="sm" disabled={!listo} onClick={() => void crear()}>
          <Upload size={14} aria-hidden="true" />{subiendo ? "Creando…" : "Crear la base"}
        </PulsoButton>
      </div>
    </div>
  );
}
