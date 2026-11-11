// "Agregar una fuente" (Carga › Bases, R2): otra encuesta de SurveyMonkey que
// entra a una base que ya existe, por otra vía (correo además del QR en aula).
// Abierto por `panel=agregar-fuente&foco=<base>`. Es el mismo flujo que tenía
// la tarjeta de "Bases del estudio": la vía, el catálogo y, antes de unir, qué
// preguntas calzan y cuáles no.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { VistaPreviaFuente } from "../../../../api/xlsformEditor";
import { Dialog } from "../../../../components/Dialog";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoField } from "../../../../components/PulsoField";
import { PulsoInput } from "../../../../components/PulsoInput";
import { conNivel } from "../../../../lib/navegacion/direccion";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { useSeccion } from "../../../../lib/navegacion/useDireccion";
import { GitMerge } from "../../../../vendor/lucide-react";
import { PANEL_AGREGAR_FUENTE } from "../../panelesCarga";
import { searchConInspector } from "./agregarBaseModel";
import type { ColeccionDeBases } from "./basesModel";

export type AgregarFuenteProps = {
  coleccion: ColeccionDeBases;
  ocupado: boolean;
  panelPlataforma: ReactNode;
  /** La página dirige el próximo import del catálogo a esa base con esa vía. */
  onDestinoFuente: (destino: { base: string; canal: string } | null) => void;
  vistaPrevia: VistaPreviaFuente | null;
  onConfirmar: () => void;
  onDescartarVistaPrevia: () => void;
};

export function AgregarFuente(props: AgregarFuenteProps) {
  const panel = usePanelDireccionable(PANEL_AGREGAR_FUENTE);
  const { foco } = useSeccion("procesamiento");
  const location = useLocation();
  const navigate = useNavigate();
  const base = panel.abierto ? props.coleccion.bases.find((b) => b.nombre === foco && b.puedeAgregarFuente) ?? null : null;
  // Al cerrar queda abierto el inspector de la misma base.
  const cerrar = () => navigate({ pathname: location.pathname, search: searchConInspector(conNivel(location.search, "panel", null), foco) }, { replace: true });
  return (
    <Dialog
      open={panel.abierto}
      onOpenChange={(abierto) => { if (!abierto) cerrar(); }}
      size="lg"
      alto="fijo"
      title={base ? `Agregar una fuente a ${base.etiqueta}` : "Agregar una fuente"}
      icon={<GitMerge size={16} aria-hidden="true" />}
      closeLabel="Cerrar el recorrido para agregar una fuente"
    >
      {panel.abierto ? (
        base ? <Flujo {...props} base={base.nombre} /> : (
          <p className="pulso-bases-causa">Esta base no recibe otra fuente desde aquí: solo las bases de SurveyMonkey la reciben.</p>
        )
      ) : null}
    </Dialog>
  );
}

function Flujo({ base, ocupado, panelPlataforma, onDestinoFuente, vistaPrevia, onConfirmar, onDescartarVistaPrevia }: AgregarFuenteProps & { base: string }) {
  const [canal, setCanal] = useState("");
  const destino = useRef(onDestinoFuente);
  destino.current = onDestinoFuente;
  useEffect(() => {
    destino.current({ base, canal });
  }, [base, canal]);
  // Al cerrar, el próximo import vuelve a crear una base nueva.
  useEffect(() => () => destino.current(null), []);
  return (
    <div className="pulso-bases-recorrido">
      <PulsoField label="Vía de esta encuesta" hint="Distingue en la base de dónde vino cada respuesta.">
        <PulsoInput value={canal} onChange={(e) => setCanal(e.target.value)} placeholder="Por ejemplo, correo" />
      </PulsoField>
      {vistaPrevia ? (
        <div className="pulso-bde-previa" role="status">
          <strong>"{vistaPrevia.titulo}" y "{vistaPrevia.base_name}"</strong>
          <p>Calzan {vistaPrevia.n_emparejadas} de las {vistaPrevia.n_preguntas_base} preguntas de la base.</p>
          {vistaPrevia.extra.length ? (
            <div>
              <span className="pulso-bde-previa-rotulo">Trae de más (se suman a la base; quedan vacías en las respuestas anteriores)</span>
              <ul>{vistaPrevia.extra.map((x) => <li key={x.variable}>{x.etiqueta || x.variable}</li>)}</ul>
            </div>
          ) : null}
          {vistaPrevia.faltan.length ? (
            <div>
              <span className="pulso-bde-previa-rotulo">No las pregunta (quedan vacías en sus respuestas)</span>
              <ul>{vistaPrevia.faltan.map((x) => <li key={x.variable}>{x.etiqueta || x.variable}</li>)}</ul>
            </div>
          ) : null}
          <div className="pulso-bases-acciones">
            <PulsoButton variant="primary" size="sm" disabled={ocupado} onClick={onConfirmar}><GitMerge size={14} aria-hidden="true" />Unir a "{vistaPrevia.base_name}"</PulsoButton>
            <PulsoButton variant="ghost" size="sm" onClick={onDescartarVistaPrevia}>Elegir otra encuesta</PulsoButton>
          </div>
        </div>
      ) : (
        panelPlataforma
      )}
    </div>
  );
}
