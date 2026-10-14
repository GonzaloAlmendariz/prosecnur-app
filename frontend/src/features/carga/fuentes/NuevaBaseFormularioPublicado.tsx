// «Agregar base» desde un formulario publicado (ADR 0102): primero el
// instrumento, después los datos. Se elige la revisión publicada en Formularios,
// de dónde vienen las respuestas (su encuesta de SurveyMonkey, un .sav o un
// Excel), se revisa la vista previa y la base se crea ligada a esa revisión.

import { useId } from "react";
import type { FormularioPublicado, ImportarFormularioPublicadoResultado } from "../../../api/cargaFormularioPublicado";
import type { EstudioPayload } from "../../../api/estudio";
import { PulsoButton } from "../../../components/PulsoButton";
import { CloudDownload, FileCheck2, FileSpreadsheet, FileUp, Loader2, Plus } from "../../../vendor/lucide-react";
import { textoDeProgresoImport } from "../importEnSegundoPlano";
import {
  ROTULOS_FUENTE,
  detallesFormulario,
  fuentesDisponibles,
  puedeCrear,
  rotuloRevision,
} from "./formularioPublicadoModel";
import { errorNombreBase } from "./NuevaBaseArchivos";
import { useFormularioPublicadoFlujo } from "./useFormularioPublicadoFlujo";
import { VistaPreviaFormularioPublicado } from "./VistaPreviaFormularioPublicado";
import "./formularioPublicado.css";

const ICONO_FUENTE = {
  surveymonkey: <CloudDownload size={16} aria-hidden="true" />,
  sav: <FileUp size={16} aria-hidden="true" />,
  excel: <FileSpreadsheet size={16} aria-hidden="true" />,
} as const;

export function NuevaBaseFormularioPublicado({
  estudio,
  formularios,
  onCreada,
}: {
  estudio: EstudioPayload;
  formularios: readonly FormularioPublicado[];
  onCreada: (resultado: ImportarFormularioPublicadoResultado) => Promise<void> | void;
}) {
  const flujo = useFormularioPublicadoFlujo();
  const { estado } = flujo;
  const idNombre = useId();
  const idArchivo = useId();
  const idCampanas = useId();
  const elegido = formularios.find((f) => f.revision_id === estado.revisionId) ?? null;
  const fuentes = fuentesDisponibles(elegido);
  const problemaNombre = errorNombreBase(estado.nombreBase, Object.keys(estudio.bases ?? {}));
  const creando = estado.fase === "creando";
  const ocupado = estado.fase !== "eligiendo";
  const listo = puedeCrear(estado, problemaNombre);

  const crear = async () => {
    const resultado = await flujo.crear();
    if (resultado) await onCreada(resultado);
  };

  const progresoTexto = creando
    ? textoDeProgresoImport(estado.fuente === "surveymonkey" ? "Trayendo las respuestas de SurveyMonkey" : "Creando la base", estado.progreso)
    : estado.fase === "subiendo"
      ? "Subiendo el archivo…"
      : estado.fase === "previsualizando"
        ? "Comparando las respuestas con el formulario…"
        : "";

  return (
    <div className="pulso-bfp">
      <fieldset className="pulso-bfp-paso">
        <legend>Formulario</legend>
        <div
          className="pulso-bfp-formularios"
          role="radiogroup"
          aria-label="Formulario publicado"
          data-qa-geometry-group="carga/formulario-publicado/formularios"
          data-qa-geometry-contract="equal"
        >
          {formularios.map((f) => {
            const activo = f.revision_id === estado.revisionId;
            const detalles = detallesFormulario(f);
            return (
              <button
                key={f.revision_id}
                type="button"
                role="radio"
                aria-checked={activo}
                disabled={creando}
                className={activo ? "pulso-bfp-formulario is-activo" : "pulso-bfp-formulario"}
                onClick={() => flujo.elegirFormulario(f)}
                data-qa-geometry-member
              >
                <FileCheck2 size={16} aria-hidden="true" />
                <span className="pulso-bfp-formulario-texto">
                  <strong>{f.form_name}</strong>
                  <small>{rotuloRevision(f.revision_no)}</small>
                  {detalles.length ? <small className="pulso-bfp-formulario-meta">{detalles.join(" · ")}</small> : null}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {elegido ? (
        <fieldset className="pulso-bfp-paso">
          <legend>¿De dónde vienen las respuestas?</legend>
          <div
            className="pulso-bfp-fuentes-opciones"
            role="radiogroup"
            aria-label="Origen de las respuestas"
            data-qa-geometry-group="carga/formulario-publicado/fuentes"
            data-qa-geometry-contract="equal"
          >
            {fuentes.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={estado.fuente === id}
                disabled={creando}
                className={estado.fuente === id ? "pulso-bde-origen-opcion is-activa" : "pulso-bde-origen-opcion"}
                onClick={() => flujo.elegirFuente(id)}
                data-qa-geometry-member
              >
                {ICONO_FUENTE[id]}
                <span><strong>{ROTULOS_FUENTE[id].rotulo}</strong><small>{ROTULOS_FUENTE[id].ayuda}</small></span>
              </button>
            ))}
          </div>

          {estado.fuente === "surveymonkey" && elegido.campanas.length ? (
            <label htmlFor={idCampanas} className="pulso-bfp-casilla">
              <input
                id={idCampanas}
                type="checkbox"
                checked={estado.incluirCampanas}
                disabled={ocupado}
                onChange={(e) => flujo.incluirCampanas(e.target.checked)}
              />
              <span>Incluir campañas: {elegido.campanas.map((c) => c.titulo).join(", ")}</span>
            </label>
          ) : null}

          {estado.fuente === "sav" || estado.fuente === "excel" ? (
            <label htmlFor={idArchivo} className={estado.archivo ? "pulso-bde-archivo is-listo" : "pulso-bde-archivo"}>
              <FileSpreadsheet size={18} aria-hidden="true" />
              <span>
                <strong>{estado.fuente === "sav" ? "Archivo .sav" : "Excel con las respuestas"}</strong>
                <small>{estado.archivo ? estado.archivo.nombre : estado.fuente === "sav" ? "Elige el .sav" : "Elige el .xlsx o .csv"}</small>
              </span>
              <input
                id={idArchivo}
                key={estado.fuente}
                type="file"
                accept={estado.fuente === "sav" ? ".sav" : ".xlsx,.xls,.csv"}
                className="pulso-sr-only"
                disabled={ocupado}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void flujo.subir(f); }}
              />
            </label>
          ) : null}
        </fieldset>
      ) : null}

      <p className="pulso-bfp-progreso" role="status" aria-live="polite">
        {progresoTexto ? <><Loader2 size={14} aria-hidden="true" className="pulso-bfp-giro" />{progresoTexto}</> : null}
      </p>

      {estado.error ? (
        <div className="pulso-bde-error pulso-bfp-error" role="alert">
          <span>{estado.error}</span>
          {!estado.vistaPrevia ? <PulsoButton variant="ghost" size="sm" onClick={flujo.reintentar}>Reintentar</PulsoButton> : null}
        </div>
      ) : null}

      {estado.vistaPrevia ? (
        <>
          <VistaPreviaFormularioPublicado vistaPrevia={estado.vistaPrevia} />
          <div className="pulso-bfp-cierre">
            <label htmlFor={idNombre} className="pulso-bde-nueva-nombre">
              <span>Nombre de la base</span>
              <input
                id={idNombre}
                value={estado.nombreBase}
                disabled={creando}
                onChange={(e) => flujo.cambiarNombre(e.target.value)}
                aria-invalid={problemaNombre ? true : undefined}
              />
              <small className={problemaNombre ? "is-error" : undefined}>{problemaNombre ?? "Sale del formulario; cámbialo si quieres."}</small>
            </label>
            <PulsoButton variant="primary" size="sm" disabled={!listo} onClick={() => void crear()}>
              <Plus size={14} aria-hidden="true" />{creando ? "Creando…" : "Crear base"}
            </PulsoButton>
          </div>
        </>
      ) : null}
    </div>
  );
}
