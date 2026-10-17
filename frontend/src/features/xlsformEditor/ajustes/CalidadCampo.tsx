// Calidad de campo en Ajustes del formulario: ubicación al abrir y registro de la entrevista (ver calidadCampoModel.ts).

import type { XlsformEditorWorkbook } from "../types";
import { Switch } from "../../../components/Switch";
import { MaquetaTipo } from "../kit";
import {
  aplicarRegistro,
  aplicarUbicacionInicio,
  leerCalidadCampo,
  NOMBRE_UBICACION,
  type NivelRegistro,
} from "./calidadCampoModel";
import "./calidadCampo.css";

const NIVELES: Array<{ id: NivelRegistro; nombre: string; detalle: string }> = [
  { id: "tiempos", nombre: "Tiempos", detalle: "Por pregunta." },
  { id: "cambios", nombre: "Y cambios", detalle: "Qué respuesta cambió." },
  { id: "ubicacion", nombre: "Y ubicación", detalle: "Cada minuto. Usa más batería." },
];

export function CalidadCampo({ workbook, onEditar }: {
  workbook: XlsformEditorWorkbook | null;
  onEditar: (mutar: (draft: XlsformEditorWorkbook) => void) => void;
}) {
  const estado = leerCalidadCampo(workbook);
  const registroActivo = estado.registro !== null;
  const conUbicacion = estado.ubicacionInicio || estado.registro === "ubicacion";
  return (
    <section className="xfcc" aria-labelledby="xfcc-tit">
      <header className="xfcc__cab">
        <span className="pulso-section-eyebrow" id="xfcc-tit">Calidad de campo</span>
        <p>Lo registra el dispositivo. El encuestado no ve ninguna pregunta.</p>
      </header>

      <div className="xfcc__filas" data-qa-geometry-group="xlsform/calidad-campo" data-qa-geometry-contract="intrinsic">
      <div className="xfcc__fila" data-qa-geometry-member="">
        <span className="xfcc__maq"><MaquetaTipo baseType="start-geopoint" ancho={52} /></span>
        <div className="xfcc__txt">
          <strong>Ubicación al abrir</strong>
          <span>Una toma de GPS al empezar la entrevista.</span>
          {estado.ubicacionInicio ? <code>{NOMBRE_UBICACION}</code> : null}
        </div>
        <Switch
          checked={estado.ubicacionInicio}
          ariaLabel="Ubicación al abrir"
          onToggle={() => onEditar((d) => aplicarUbicacionInicio(d, !estado.ubicacionInicio))}
        />
      </div>

      <div className="xfcc__fila" data-qa-geometry-member="">
        <span className="xfcc__maq"><MaquetaTipo baseType="audit" ancho={52} /></span>
        <div className="xfcc__txt">
          <strong>Registro de la entrevista</strong>
          <span>Sirve para detectar entrevistas apuradas o rehechas.</span>
          {registroActivo ? <code>audit</code> : null}
        </div>
        <Switch
          checked={registroActivo}
          ariaLabel="Registro de la entrevista"
          onToggle={() => onEditar((d) => aplicarRegistro(d, registroActivo ? null : "cambios"))}
        />
        {registroActivo ? (
          <div className="xfcc__niveles" role="radiogroup" aria-label="Qué registra" data-qa-geometry-group="xlsform/calidad-niveles" data-qa-geometry-contract="equal">
            {NIVELES.map((n) => (
              <button
                key={n.id}
                type="button"
                role="radio"
                aria-checked={estado.registro === n.id}
                className="xfcc__nivel"
                data-qa-geometry-member=""
                onClick={() => onEditar((d) => aplicarRegistro(d, n.id))}
              >
                <strong>{n.nombre}</strong>
                <span>{n.detalle}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      </div>

      {estado.registro === "personalizado" ? (
        <p className="xfcc__nota">Parámetros propios del formulario: <code>{estado.parametrosRegistro}</code>. Elegir un nivel los reemplaza.</p>
      ) : null}

      {conUbicacion ? <p className="xfcc__nota">Menciona el registro de ubicación en el consentimiento.</p> : null}
      {estado.ubicacionInicio || registroActivo ? (
        <p className="xfcc__nota">Funciona completo en KoboCollect. En enlaces web la ubicación puede no guardarse.</p>
      ) : null}
    </section>
  );
}
