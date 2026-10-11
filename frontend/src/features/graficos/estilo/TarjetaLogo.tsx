// Un lugar del documento donde va un logo (portada izquierda, portada derecha, contraportada). Marco fijo (C2): la vista
// previa ocupa siempre la misma caja, con el logo propio o el aviso de cuál pone el recetario (C3, vacío propio).
// La subida es un botón real que abre el selector de archivos: llega con Tab y se activa con Enter o espacio.

import { useRef, type ChangeEvent, type KeyboardEvent } from "react";
import { downloadUrl } from "../../../api/core";
import type { EstiloLogoRef, EstiloLugarLogo, EstiloOpcionLogo } from "../../../api/graficosEstilo";
import { ImagePlus, RotateCcw } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import { ETIQUETA_LUGAR, type Procedencia } from "./modeloEstilo";
import { SelloProcedencia } from "./SelloProcedencia";

export function TarjetaLogo({
  lugar,
  logo,
  recetario,
  procedencia,
  subiendo,
  error,
  onArchivo,
  onQuitar,
  onNombre,
}: {
  lugar: EstiloLugarLogo;
  logo: EstiloLogoRef | undefined;
  recetario: EstiloOpcionLogo | undefined;
  procedencia: Procedencia;
  subiendo: boolean;
  error: string;
  onArchivo: (archivo: File) => void;
  onQuitar: () => void;
  onNombre: (nombre: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const titulo = ETIQUETA_LUGAR[lugar];
  const idTitulo = `f6-estilo-logo-${lugar}`;
  const idError = `f6-estilo-logo-${lugar}-error`;
  const propio = procedencia === "propio" && logo;

  const alElegir = (event: ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0];
    // Vaciar el valor deja volver a elegir el mismo archivo tras un error.
    event.target.value = "";
    if (archivo) onArchivo(archivo);
  };

  const confirmarConEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };

  return (
    <article className="pulso-f6-estilo-logo" aria-labelledby={idTitulo} data-qa-geometry-member>
      <header className="pulso-f6-estilo-logo-cabecera">
        <h4 id={idTitulo}>{titulo}</h4>
        <SelloProcedencia procedencia={procedencia} />
      </header>
      <div className="pulso-f6-estilo-logo-vista" data-qa-geometry-capacity="owned">
        {propio ? (
          <img src={downloadUrl(logo.file_id)} alt={`Logo ${logo.nombre ?? "propio"} en ${titulo.toLowerCase()}`} />
        ) : (
          <p className="pulso-f6-estilo-logo-vacio">
            {recetario?.nombre ? <>El recetario pone el logo de <strong>{recetario.nombre}</strong>.</> : "El recetario pone su logo."}
          </p>
        )}
      </div>
      {propio ? (
        <label className="pulso-f6-estilo-campo">
          <span>Nombre</span>
          <input
            key={logo.file_id}
            type="text"
            defaultValue={logo.nombre ?? ""}
            placeholder="Por ejemplo, UNSA"
            onBlur={(event) => {
              if (event.currentTarget.value.trim() !== (logo.nombre ?? "")) onNombre(event.currentTarget.value);
            }}
            onKeyDown={confirmarConEnter}
          />
        </label>
      ) : null}
      <div className="pulso-f6-estilo-logo-acciones">
        <input
          ref={entrada}
          type="file"
          accept="image/png,.png"
          className="pulso-sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={alElegir}
        />
        <PulsoButton
          variant="secondary"
          size="sm"
          disabled={subiendo}
          aria-describedby={error ? idError : undefined}
          onClick={() => entrada.current?.click()}
        >
          <ImagePlus size={14} aria-hidden="true" />
          {subiendo ? "Subiendo…" : propio ? "Reemplazar PNG" : "Subir PNG"}
        </PulsoButton>
        {propio ? (
          <PulsoButton variant="ghost" size="sm" onClick={onQuitar} aria-label={`Volver al logo del recetario en ${titulo.toLowerCase()}`}>
            <RotateCcw size={14} aria-hidden="true" />
            Volver al recetario
          </PulsoButton>
        ) : null}
      </div>
      {error ? <p id={idError} className="pulso-f6-estilo-error" role="alert">{error}</p> : null}
    </article>
  );
}
