// Secciones JSON (C12): elegir qué componentes del plan viajan, cómo se importan y exportar o importar el archivo. La
// importación se valida primero y se escribe sólo tras confirmar. Mismo cuerpo en el diálogo de Láminas y en el
// popover del Editor anterior («Selección avanzada»).

import { useId, useRef } from "react";
import { Download, Upload } from "../../../vendor/lucide-react";
import { ConfirmacionCompartir, MotivoNoDisponible } from "./ConfirmacionCompartir";
import { GRAFICOS_JSON_SECTIONS } from "./seccionesJson";
import { textoConfirmarImportacion } from "./textosConfirmacion";
import type { ControlCompartir } from "./useCompartirPlan";

export function SeccionesJsonContenido({ control }: { control: ControlCompartir }) {
  const { estado, disponibilidad, nSecciones } = control;
  const exportar = disponibilidad.exportarJson;
  const importar = disponibilidad.importarJson;
  const motivoExportarId = useId();
  const motivoImportarId = useId();
  const modoId = useId();
  const archivoRef = useRef<HTMLInputElement>(null);
  const pendiente = estado.importacionPendiente;
  const preparando = estado.ocupado === "preparar-json";

  return (
    <div className="pulso-gv2-share-advanced-panel">
      <div className="pulso-gv2-share-section-head">
        <div>
          <strong>Componentes del plan</strong>
          <p>Elige qué viaja dentro del archivo editable.</p>
        </div>
        <div className="pulso-gv2-share-section-actions">
          <button type="button" onClick={() => control.elegirTodas(true)}>Todo</button>
          <button type="button" onClick={() => control.elegirTodas(false)}>Nada</button>
        </div>
      </div>

      <div className="pulso-gv2-share-advanced-body">
        <div className="pulso-gv2-share-section-grid" role="group" aria-label="Componentes incluidos">
          {GRAFICOS_JSON_SECTIONS.map((section) => (
            <label
              key={section.id}
              title={section.help}
              className={`pulso-gv2-share-option${estado.secciones[section.id] ? " is-on" : ""}`}
            >
              <span className="pulso-gv2-share-option-copy">
                <strong>{section.label}</strong>
                <small>{section.help}</small>
              </span>
              <span className="pulso-gv2-share-switch" aria-hidden="true">
                <span />
              </span>
              <input
                type="checkbox"
                checked={estado.secciones[section.id]}
                onChange={(e) => control.elegirSeccion(section.id, e.target.checked)}
                className="pulso-gv2-share-native-input"
              />
            </label>
          ))}
        </div>

        <div className="pulso-gv2-share-advanced-side">
          <div className="pulso-gv2-share-modebox" role="radiogroup" aria-labelledby={modoId}>
            <span id={modoId}>Al importar</span>
            <label className={`pulso-gv2-share-radio${estado.modo === "merge" ? " is-selected" : ""}`}>
              <input type="radio" name={modoId} checked={estado.modo === "merge"} onChange={() => control.elegirModo("merge")} />
              <i aria-hidden="true" />
              <strong>Combinar</strong>
              <small>Conserva lo existente y suma lo elegido.</small>
            </label>
            <label className={`pulso-gv2-share-radio${estado.modo === "replace" ? " is-selected" : ""}`}>
              <input type="radio" name={modoId} checked={estado.modo === "replace"} onChange={() => control.elegirModo("replace")} />
              <i aria-hidden="true" />
              <strong>Reemplazar</strong>
              <small>Sustituye solo los componentes incluidos.</small>
            </label>
          </div>

          <div className="pulso-gv2-share-advanced-actions">
            <button type="button" onClick={() => void control.exportarJson()}
              aria-describedby={exportar.habilitado ? undefined : motivoExportarId}
              disabled={!exportar.habilitado || estado.ocupado === "exportar-json" || nSecciones === 0}>
              <Download size={12} aria-hidden="true" /> {estado.ocupado === "exportar-json" ? "Exportando…" : "Exportar componentes"}
            </button>
            <button type="button" onClick={() => archivoRef.current?.click()}
              aria-describedby={importar.habilitado ? undefined : motivoImportarId}
              disabled={!importar.habilitado || preparando || estado.ocupado === "importar-json" || nSecciones === 0}>
              <Upload size={12} aria-hidden="true" /> {preparando ? "Leyendo…" : "Importar componentes"}
            </button>
            <input
              ref={archivoRef}
              type="file"
              hidden
              tabIndex={-1}
              aria-hidden="true"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void control.prepararImportacion(file);
              }}
            />
          </div>

          {!exportar.habilitado && <MotivoNoDisponible id={motivoExportarId} motivo={exportar.motivo} />}
          {!importar.habilitado && <MotivoNoDisponible id={motivoImportarId} motivo={importar.motivo} />}

          {pendiente && importar.habilitado && (
            <ConfirmacionCompartir
              texto={textoConfirmarImportacion(pendiente.modo, pendiente.seccionIds.length, pendiente.nombreArchivo)}
              ocupado={estado.ocupado === "importar-json"}
              onConfirmar={() => void control.confirmarImportacion()}
              onCancelar={control.cancelarConfirmacion}
            />
          )}
        </div>
      </div>
    </div>
  );
}
