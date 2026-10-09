import type { CalcMuestraEstudio, CalcMuestraWorkspace } from "../../../api/calcMuestra";
import { CambiarTipoEstudio } from "./CambiarTipoEstudio";
import "./general.css";

type CampoContexto = "cliente" | "tipo_cliente" | "descripcion_libre";

/**
 * Ficha del estudio. En Muestra general describe el marco único del estudio;
 * en Acreditación cada actor tiene su propio marco y su unidad (se declaran en
 * Actores y Selección), así que la ficha no los finge: sólo lleva lo que es
 * del estudio entero.
 */
export function FichaEstudio({
  variante,
  estudio,
  workspace,
  onTitulo,
  onContexto,
  onWorkspace,
  onCambiarTipo,
}: {
  variante: "general" | "acreditacion";
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: CampoContexto, valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  /** Volver a elegir el tipo de estudio (antes era un atajo en la barra del módulo). */
  onCambiarTipo?: () => void;
}) {
  const acreditacion = variante === "acreditacion";
  return (
    <section className="cmv2-panel cmv2-basics" aria-labelledby="cmg-ficha-estudio-titulo">
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Ficha del estudio</span>
          <h3 className="cmg-panel-titulo" id="cmg-ficha-estudio-titulo">{acreditacion ? "Proceso de acreditación" : "Contexto y marco"}</h3>
        </div>
        {onCambiarTipo && <CambiarTipoEstudio onCambiarTipo={onCambiarTipo} />}
      </div>
      <div className="cmv2-form-grid">
        <label>
          <span>Título</span>
          <input value={estudio.titulo} placeholder="Nombre del estudio o propuesta" onChange={(e) => onTitulo(e.currentTarget.value)} />
        </label>
        <label>
          <span>{acreditacion ? "Institución" : "Cliente"}</span>
          <input
            value={estudio.contexto.cliente}
            placeholder={acreditacion ? "Universidad o facultad" : "Institución o área solicitante"}
            onChange={(e) => onContexto("cliente", e.currentTarget.value)}
          />
        </label>
        <label>
          <span>{acreditacion ? "Fuente de los marcos" : "Fuente del marco"}</span>
          <input
            value={workspace.fuente_marco}
            placeholder={acreditacion ? "Dirección académica, registro de egresados…" : "Censo, padrón, listado externo..."}
            onChange={(e) => onWorkspace({ ...workspace, fuente_marco: e.currentTarget.value })}
          />
        </label>
        {acreditacion ? (
          <label className="cmg-ficha-notas">
            <span>Programas y alcance</span>
            <textarea
              rows={3}
              value={estudio.contexto.descripcion_libre ?? ""}
              placeholder="Programas evaluados, modelo de acreditación, periodo"
              onChange={(e) => onContexto("descripcion_libre", e.currentTarget.value)}
            />
          </label>
        ) : (
          <>
            <label>
              <span>Marco disponible</span>
              <input
                value={workspace.marco_disponible}
                placeholder="Universo validado o cobertura estimada"
                onChange={(e) => onWorkspace({ ...workspace, marco_disponible: e.currentTarget.value })}
              />
            </label>
            <label>
              <span>Unidad de observación</span>
              <input
                value={workspace.unidad_observacion}
                placeholder="Persona, hogar, institución, actor..."
                onChange={(e) => onWorkspace({ ...workspace, unidad_observacion: e.currentTarget.value })}
              />
            </label>
            <label>
              <span>Unidad de muestreo</span>
              <input
                value={workspace.unidad_muestreo}
                placeholder="Unidad seleccionable del marco"
                onChange={(e) => onWorkspace({ ...workspace, unidad_muestreo: e.currentTarget.value })}
              />
            </label>
          </>
        )}
      </div>
      {acreditacion && <p className="cmg-nota">El marco y la unidad de cada actor se declaran en Actores y Selección.</p>}
    </section>
  );
}
