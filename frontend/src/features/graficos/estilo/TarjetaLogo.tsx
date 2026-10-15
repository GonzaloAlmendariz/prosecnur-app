// Un lugar del documento donde va un logo (portada izquierda, portada derecha, contraportada). Arriba, una miniatura de
// esa página con el logo donde de verdad sale —el propio o, si no hay, el de por defecto (PUCP o PULSO PUCP)—; debajo,
// qué es y qué se puede hacer. Marco fijo (C2): la miniatura mide siempre lo mismo.
// La subida es un botón real que abre el selector de archivos: llega con Tab y se activa con Enter o espacio.

import { useRef, type ChangeEvent, type KeyboardEvent } from "react";
import { downloadUrl } from "../../../api/core";
import type { EstiloLogoRef, EstiloLugarLogo, EstiloOpcionLogo } from "../../../api/graficosEstilo";
import { ImagePlus, RotateCcw } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import { ETIQUETA_LUGAR, type Procedencia } from "./modeloEstilo";

/** Dónde sale cada logo, en palabras del documento. ID5 (2026-10-15): hoy sólo el job del Word recibe el estilo del
 *  cliente (graficos_jobs.R, `graficos_job_worker_word`); decía «en el PPT y en el Word». Llegan al PPT con ID9 (D5). */
const DONDE: Record<EstiloLugarLogo, string> = {
  portada_izquierda: "Arriba a la izquierda de la portada del Word.",
  portada_derecha: "Arriba a la derecha de la portada del Word.",
  contraportada: "Al centro de la última página.",
};

/** Los logos por defecto, servidos por la app (copias de api/inst/estandar/logos). */
const IMAGEN_POR_DEFECTO: Record<string, string> = { pucp: "/logos-estandar/pucp.png", pulso: "/logos-estandar/pulso.png" };
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
  const imagenPorDefecto = recetario?.logo ? IMAGEN_POR_DEFECTO[recetario.logo] : undefined;

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
      <div className="pulso-f6-estilo-logo-escena" data-qa-geometry-capacity="owned">
        <div className={`pulso-f6-estilo-logo-pagina is-${lugar === "contraportada" ? "contraportada" : "portada"}`}>
          <span className={`pulso-f6-estilo-logo-sitio is-${lugar}`}>
            {propio ? (
              <img src={downloadUrl(logo.file_id)} alt={`Logo ${logo.nombre ?? "propio"} en ${titulo.toLowerCase()}`} />
            ) : imagenPorDefecto ? (
              <img src={imagenPorDefecto} alt={`Logo por defecto en ${titulo.toLowerCase()}: ${recetario?.nombre ?? ""}`} />
            ) : null}
          </span>
        </div>
      </div>
      <div className="pulso-f6-estilo-logo-cuerpo">
      <header className="pulso-f6-estilo-logo-cabecera">
        <h4 id={idTitulo}>{titulo}</h4>
        <SelloProcedencia procedencia={procedencia} />
      </header>
      <p className="pulso-f6-estilo-logo-donde">
        {DONDE[lugar]}{!propio && recetario?.nombre ? <> Ahora: <strong>{recetario.nombre}</strong>.</> : null}
      </p>
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
          <PulsoButton variant="ghost" size="sm" onClick={onQuitar} aria-label={`Volver al logo por defecto en ${titulo.toLowerCase()}`}>
            <RotateCcw size={14} aria-hidden="true" />
            Usar el de por defecto
          </PulsoButton>
        ) : null}
      </div>
      {error ? <p id={idError} className="pulso-f6-estilo-error" role="alert">{error}</p> : null}
      </div>
    </article>
  );
}
