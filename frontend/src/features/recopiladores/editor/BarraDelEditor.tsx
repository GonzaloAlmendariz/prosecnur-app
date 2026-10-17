import type { ReactNode } from "react";

import { PulsoButton } from "../../../components/PulsoButton";
import { Loader2, Redo2, Save, Undo2 } from "../../../vendor/lucide-react";
import { Segmented } from "../../xlsformEditor/kit";

type Props = {
  nombre: string;
  onIrAlCatalogo?: () => void;
  caras: ReadonlyArray<{ value: string; label: string }>;
  caraActiva: string;
  onCara: (pageId: string) => void;
  unidad: ReactNode;
  revision: number;
  conCambios: boolean;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  onDeshacer: () => void;
  onRehacer: () => void;
  guardando: boolean;
  puedeGuardar: boolean;
  /** Por qué «Guardar receta» está apagado (p. ej. «Sin cambios que guardar»). */
  motivoSinGuardar?: string | null;
  onGuardar: () => void;
  /** Texto del aviso antes de guardar, mientras se espera la confirmación. */
  confirmacion: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
};

/**
 * La barra del editor: dónde estoy («Catálogo / Ficha de campo con croquis»),
 * qué cara miro, con qué unidad, y la receta con su revisión y su guardado.
 */
export function BarraDelEditor({
  nombre,
  onIrAlCatalogo,
  caras,
  caraActiva,
  onCara,
  unidad,
  revision,
  conCambios,
  puedeDeshacer,
  puedeRehacer,
  onDeshacer,
  onRehacer,
  guardando,
  puedeGuardar,
  motivoSinGuardar = null,
  onGuardar,
  confirmacion,
  onConfirmar,
  onCancelar,
}: Props) {
  return (
    <div className="rec-ed-barra" role="toolbar" aria-label="Receta del material">
      <nav className="rec-ed-miga" aria-label="Ruta del editor">
        {onIrAlCatalogo ? (
          <button type="button" className="rec-ed-enlace rec-ed-miga-raiz" onClick={onIrAlCatalogo}>Catálogo</button>
        ) : (
          <span className="rec-ed-miga-raiz">Catálogo</span>
        )}
        <span className="rec-ed-miga-sep" aria-hidden>/</span>
        <strong className="rec-ed-miga-actual" aria-current="page">{nombre}</strong>
      </nav>
      {caras.length > 1 ? (
        <Segmented<string> aria-label="Cara de la hoja" size="sm" value={caraActiva} options={caras} onChange={onCara} />
      ) : null}
      <span className="rec-ed-barra-hueco" />
      {unidad}
      <span className="rec-ed-revision">revisión {revision.toLocaleString("es-PE")}</span>
      {conCambios ? <span className="rec-ed-insignia" role="status">cambios sin guardar</span> : null}
      <span className="rec-ed-historia">
        <PulsoButton variant="icon" size="sm" aria-label="Deshacer" title="Deshacer (Cmd/Ctrl+Z)" disabled={!puedeDeshacer} onClick={onDeshacer}>
          <Undo2 size={15} aria-hidden />
        </PulsoButton>
        <PulsoButton variant="icon" size="sm" aria-label="Rehacer" title="Rehacer (Shift+Cmd/Ctrl+Z o Ctrl+Y)" disabled={!puedeRehacer} onClick={onRehacer}>
          <Redo2 size={15} aria-hidden />
        </PulsoButton>
      </span>
      {confirmacion ? (
        <span className="rec-ed-confirmar" role="group" aria-label="Confirmar el guardado">
          <span className="rec-ed-confirmar-texto">{confirmacion}</span>
          <PulsoButton variant="primary" size="sm" onClick={onConfirmar}>Guardar igual</PulsoButton>
          <PulsoButton variant="secondary" size="sm" onClick={onCancelar}>Cancelar</PulsoButton>
        </span>
      ) : (
        <PulsoButton
          variant="primary"
          size="sm"
          disabled={!puedeGuardar || guardando}
          title={!puedeGuardar && motivoSinGuardar ? motivoSinGuardar : undefined}
          onClick={onGuardar}
        >
          {guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Save size={14} aria-hidden />} Guardar receta
        </PulsoButton>
      )}
    </div>
  );
}
