// P8 en el menú «Exportar»: si algún gráfico que pinta cada respuesta con su color tiene respuestas sin color, se dice
// cuáles y no se exporta hasta completarlos. «Completar todo» lo arregla en un clic (reutiliza los colores que ya se
// usan y, si no hay, la marca); «Ver» lleva a la lámina. Deshacer lo revierte en un paso.

import { useLocation, useNavigate } from "react-router-dom";
import { PulsoButton } from "../../../components/PulsoButton";
import { conNivel } from "../../../lib/navegacion/direccion";
import { searchConNivel } from "../../../lib/navegacion/useDireccion";
import { useSession } from "../../../lib/SessionContext";
import { useGraficosReportScope } from "../reportScope";
import { usePlanStore } from "../store";
import { coloresPendientes, conColoresCompletados, type ColorPendiente } from "./coloresPendientes";
import { usePaletasRespuestas } from "./usePaletasRespuestas";
import "./coloresPendientes.css";

export function useColoresPendientes(): { pendientes: ColorPendiente[]; completar: () => void } {
  const slides = usePlanStore((s) => s.plan.slides);
  const paletas = usePlanStore((s) => s.paletas);
  const setPaletas = usePlanStore((s) => s.setPaletas);
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  const { listas, filas } = usePaletasRespuestas();
  const pendientes = listas ? coloresPendientes(slides, filas, baseActiva, scope) : [];
  return { pendientes, completar: () => { if (listas) setPaletas(conColoresCompletados(pendientes, listas, paletas)); } };
}

const MAX_VISIBLES = 4;

export function ColoresPendientesAviso({ pendientes, onCompletar, onVer }: { pendientes: readonly ColorPendiente[]; onCompletar: () => void; onVer?: () => void }) {
  const navigate = useNavigate();
  const loc = useLocation();
  if (!pendientes.length) return null;
  const laminas = new Set(pendientes.map((p) => p.slideId)).size;
  const ver = (slideId: string) => {
    onVer?.();
    navigate({ pathname: loc.pathname, search: conNivel(searchConNivel(loc.search, "pestana", "laminas"), "foco", slideId) });
  };
  return (
    <div className="pulso-cp" role="alert">
      <div className="pulso-cp-cabecera">
        <strong>Faltan colores en {laminas === 1 ? "1 lámina" : `${laminas} láminas`}</strong>
        <span>Estos gráficos pintan cada respuesta con su color; complétalos para exportar.</span>
      </div>
      <ul className="pulso-cp-lista">
        {pendientes.slice(0, MAX_VISIBLES).map((p) => (
          <li key={`${p.slideId}:${p.slot}:${p.fila.id}`}>
            <span className="pulso-cp-barra" aria-hidden="true">
              {p.fila.opciones.map((o) => <span key={o} className={p.fila.colores[o] ? undefined : "is-vacio"} style={p.fila.colores[o] ? { background: p.fila.colores[o] } : undefined} />)}
            </span>
            <span className="pulso-cp-texto">
              <span>Lámina {p.numero}: {p.pregunta}</span>
              <small>{p.fila.faltan === 1 ? "Falta 1 color" : `Faltan ${p.fila.faltan} colores`} en «{p.fila.nombre}»</small>
            </span>
            <button type="button" className="pulso-cp-ver" onClick={() => ver(p.slideId)}>Ver</button>
          </li>
        ))}
      </ul>
      {/* La lista cuenta gráficos (una lámina puede tener varios); el encabezado, láminas. */}
      {pendientes.length > MAX_VISIBLES ? <p className="pulso-cp-mas">y {pendientes.length - MAX_VISIBLES === 1 ? "1 gráfico más" : `${pendientes.length - MAX_VISIBLES} gráficos más`}</p> : null}
      <PulsoButton variant="primary" size="sm" onClick={onCompletar}>Completar todos los colores</PulsoButton>
    </div>
  );
}
