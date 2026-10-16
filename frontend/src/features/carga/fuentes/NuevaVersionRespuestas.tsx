// Carga › Fuentes: «Nueva versión» de las respuestas de una base cargada desde
// archivo (ADR 0100 D1). Lo que se decide fuera de la app —un script que limpia,
// codifica o marca una selección— se cambia allá y la base recibe su archivo
// nuevo sin perder su formulario, su nombre ni lo que declara. Antes de elegir el
// archivo se dice qué se conserva y qué se vuelve a hacer; después, qué cambió.

import { useId, useState } from "react";
import { apiUpload, uploadKindForDataFile } from "../../../api/client";
import { apiEstudioGet, apiEstudioReemplazarRespuestas, type CambiosDeRespuestas, type EstudioPayload } from "../../../api/estudio";
import { PulsoButton } from "../../../components/PulsoButton";
import { RefreshCw } from "../../../vendor/lucide-react";
import { resumenCambiosDeRespuestas } from "./nuevaVersionRespuestasModel";

export function NuevaVersionRespuestas({
  base,
  ocupado,
  onCambio,
}: {
  base: string;
  ocupado: boolean;
  onCambio: (payload: EstudioPayload) => Promise<void> | void;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<{ archivo: string; cambios: CambiosDeRespuestas } | null>(null);

  const cargar = async (archivo: File | null) => {
    if (!archivo) return;
    setSubiendo(true);
    setError("");
    try {
      const subido = await apiUpload(archivo, uploadKindForDataFile(archivo));
      const r = await apiEstudioReemplazarRespuestas({ nombre: base, data_file_id: subido.file_id });
      setResultado({ archivo: r.archivo || archivo.name, cambios: r.cambios });
      setAbierto(false);
      await onCambio(await apiEstudioGet());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la versión nueva.");
    } finally {
      setSubiendo(false);
    }
  };

  if (abierto) {
    return (
      <div className="pulso-bde-version" role="group" aria-labelledby={`${id}-titulo`}>
        <p id={`${id}-titulo`} className="pulso-bde-version-titulo">Nueva versión de las respuestas de «{base}»</p>
        <p className="pulso-bde-version-ayuda">
          Se conservan el formulario, el nombre y las variables de la base, y también los códigos de la
          codificación. La limpieza hecha aquí se descarta porque hablaba de las respuestas anteriores.
        </p>
        <div className="pulso-bde-version-acciones">
          <label htmlFor={`${id}-archivo`} className="pulso-button pulso-button--primary pulso-button--sm pulso-bde-version-elegir" aria-disabled={subiendo || ocupado}>
            {subiendo ? "Cargando…" : "Elegir archivo"}
            <input
              id={`${id}-archivo`}
              type="file"
              accept=".xlsx,.xls,.csv,.sav"
              className="pulso-sr-only"
              disabled={subiendo || ocupado}
              onChange={(e) => void cargar(e.target.files?.[0] ?? null)}
            />
          </label>
          <PulsoButton variant="ghost" size="sm" disabled={subiendo} onClick={() => { setAbierto(false); setError(""); }}>Cancelar</PulsoButton>
        </div>
        {error ? <p className="pulso-bde-error" role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <>
      {resultado ? (
        <div className="pulso-bde-version-resultado" role="status">
          <strong>Respuestas actualizadas desde {resultado.archivo}</strong>
          {resumenCambiosDeRespuestas(resultado.cambios).map((linea) => <span key={linea}>{linea}</span>)}
          <PulsoButton variant="ghost" size="sm" onClick={() => setResultado(null)}>Entendido</PulsoButton>
        </div>
      ) : null}
      <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => setAbierto(true)}>
        <RefreshCw size={13} aria-hidden="true" />Nueva versión
      </PulsoButton>
    </>
  );
}
