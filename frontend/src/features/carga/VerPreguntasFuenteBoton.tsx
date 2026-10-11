// «Ver preguntas»: abre el detalle de cómo se emparejó cada pregunta de una
// fuente (ADR 0094, ítem 15). Escribe la dirección
// —`?panel=emparejamiento&foco=<base>:<survey_id>`— en vez de abrir un estado
// local, para que el panel sea enlazable y recargarlo abra la misma base.

import { useCallback } from "react";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";
import { ListChecks } from "../../vendor/lucide-react";
import { searchConEmparejamiento } from "./fuentesEmparejamientoModel";
import "./fuentesEmparejamiento.css";

type VerPreguntasProps = {
  surveyId: string;
  titulo: string;
  /** Base a la que pertenece la fuente; viaja en el `foco`. */
  baseNombre?: string | null;
};

function BotonVerPreguntas({ surveyId, titulo, onClick }: Omit<VerPreguntasProps, "baseNombre"> & { onClick?: () => void }) {
  return (
    <button
      type="button"
      className="pulso-carga-ver-preguntas"
      data-emparejamiento-abrir={surveyId}
      aria-haspopup="dialog"
      aria-label={`Ver cómo se emparejaron las preguntas de ${titulo}`}
      onClick={onClick}
    >
      <ListChecks size={12} aria-hidden="true" />
      <span>Ver preguntas</span>
    </button>
  );
}

function VerPreguntasConDireccion(props: VerPreguntasProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const abrir = useCallback(() => {
    navigate(
      { pathname: location.pathname, search: searchConEmparejamiento(location.search, props.surveyId, props.baseNombre) },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, props.surveyId, props.baseNombre]);
  return <BotonVerPreguntas surveyId={props.surveyId} titulo={props.titulo} onClick={abrir} />;
}

/**
 * Fuera de un router (renders estáticos del resumen) el botón se pinta igual,
 * sin acción: la dirección es lo único que abre el panel.
 */
export function VerPreguntasFuenteBoton(props: VerPreguntasProps) {
  return useInRouterContext()
    ? <VerPreguntasConDireccion {...props} />
    : <BotonVerPreguntas surveyId={props.surveyId} titulo={props.titulo} />;
}
