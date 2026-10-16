import { Navigate, useLocation } from "react-router-dom";

type Props = {
  /** Pathname vigente del módulo, sin query. */
  to: string;
};

/**
 * Redirige una ruta vieja a la vigente CONSERVANDO la query y el hash.
 *
 * Un `<Navigate to="/x">` estático tira la query: un enlace guardado a
 * `/recopiladores?seccion=accesos&pestana=vinculacion` aterrizaba en el
 * aterrizaje del módulo y perdía la vista que nombraba. Aquí solo se cambia el
 * pathname; los VALORES viejos de sección y pestaña los traduce el resolvedor
 * de cada módulo al leerlos, que es donde vive la tabla de alias (ADR 0108 §5).
 */
export function RedireccionConQuery({ to }: Props) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
}
