// El pie de la lista "Preguntas": lo que deja preguntas fuera del archivo y se
// cambia en otro lugar. Las secciones ocultas se deciden en Datos; las variables
// excluidas, en su panel. El prototipo no lo tiene: aparece solo cuando hay algo
// oculto o excluido, como un enlace discreto a donde se decide.

import { Link, useLocation } from "react-router-dom";

import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import { searchConPanel } from "../../../lib/navegacion/paneles";
import { DIRECCION_DATOS } from "../direccionesAnalitica";
import type { ResumenSecciones } from "../estructuraDeSecciones";
import { PANEL_VARIABLES_EXCLUIDAS } from "../panelesAnalitica";

/** "8 de 9 secciones visibles", o las del formulario cuando Datos no declara ninguna. */
export function textoDeSecciones(resumen: ResumenSecciones, declaradas: number): string {
  if (resumen.modo === "instrumento") return "Secciones del formulario";
  return `${formatoConteo(resumen.activas)} de ${formatoConteoDe(declaradas, "sección visible", "secciones visibles")}`;
}

/** Hay preguntas fuera del archivo por una sección oculta o una variable excluida. */
export function hayPreguntasFuera(resumen: ResumenSecciones, declaradas: number, excluidas: number): boolean {
  return excluidas > 0 || (resumen.modo === "declaradas" && resumen.activas < declaradas);
}

export function PieDePreguntas({ resumen, seccionesDeclaradas, excluidas }: {
  resumen: ResumenSecciones;
  seccionesDeclaradas: number;
  excluidas: number;
}) {
  const location = useLocation();
  const haciaExcluidas = { pathname: location.pathname, search: searchConPanel(location.search, PANEL_VARIABLES_EXCLUIDAS) };
  return (
    <div className="tablas-preguntas-pie">
      <Link
        to={DIRECCION_DATOS}
        title={resumen.modo === "instrumento" ? "Datos no declara secciones: el archivo usa las del formulario." : "Se eligen en la pestaña Datos."}
      >
        {textoDeSecciones(resumen, seccionesDeclaradas)}
      </Link>
      <Link to={haciaExcluidas}>{formatoConteoDe(excluidas, "variable excluida", "variables excluidas")}</Link>
    </div>
  );
}
