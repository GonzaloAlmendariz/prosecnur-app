import "./theme.css";
/* Después de theme.css porque consume sus tokens. El orden entre estos dos es
 * lo único garantizado: el CSS de cada feature se importa lazy desde su
 * page-file, así que su posición en el bundle depende de qué ruta cargó
 * primero. Por eso nav-states.css no depende del orden para funcionar. */
import "./nav-states.css";

export { default } from "./App";
