// Banda de Frecuencias: qué entra al archivo y con qué base. Cada cifra se dice
// una vez aquí y no vuelve a aparecer en los paneles. Las tablas, los pesos y
// la base salen de la vista previa del motor; las secciones y las excluidas,
// de la config. Las que se deciden en otra pestaña llevan a ella.

import { Link, useLocation } from "react-router-dom";

import type { FrecuenciasPreview } from "../../../api/analitica";
import { formatoConteo } from "../../../lib/formatoNumero";
import { serializarDireccion } from "../../../lib/navegacion/direccion";
import { searchConPanel } from "../../../lib/navegacion/paneles";
import { CifrasPestana, type CifraPestana } from "../CifrasPestana";
import { DIRECCION_DATOS } from "../direccionesAnalitica";
import type { ResumenSecciones } from "../estructuraDeSecciones";
import { PANEL_VARIABLES_EXCLUIDAS } from "../panelesAnalitica";
import { cifraDePesos, cifraDeSecciones, cifraDeTablas, rotuloDeTablas } from "./cifrasDeFrecuencias";
import type { Lectura } from "./useLecturaPorBase";
import { rotuloDeFuente } from "./vistaPreviaModelo";

const DIRECCION_PONDERACION = serializarDireccion({
  modulo: "procesamiento",
  seccion: "analitica",
  pestana: "ponderacion",
});

export function BandaDeFrecuencias({ vistaPrevia, resumen, seccionesDeclaradas, excluidas }: {
  vistaPrevia: Lectura<FrecuenciasPreview>;
  resumen: ResumenSecciones;
  seccionesDeclaradas: number;
  excluidas: number;
}) {
  const location = useLocation();
  const tablas = cifraDeTablas(vistaPrevia);
  const pesos = cifraDePesos(vistaPrevia);
  const secciones = cifraDeSecciones(resumen, seccionesDeclaradas);
  const fuente = vistaPrevia.fase === "error" ? null : rotuloDeFuente(vistaPrevia.datos?.fuente ?? null);
  const haciaExcluidas = { pathname: location.pathname, search: searchConPanel(location.search, PANEL_VARIABLES_EXCLUIDAS) };
  const cifras: CifraPestana[] = [
    { etiqueta: rotuloDeTablas(vistaPrevia), valor: tablas.valor, tono: tablas.tono, titulo: tablas.titulo },
    { etiqueta: "Secciones", valor: <Link to={DIRECCION_DATOS}>{secciones.valor}</Link>, titulo: secciones.titulo },
    { etiqueta: "Excluidas", valor: <Link to={haciaExcluidas}>{formatoConteo(excluidas)}</Link> },
    {
      etiqueta: "Pesos",
      valor: <Link to={DIRECCION_PONDERACION}>{pesos.valor}</Link>,
      tono: pesos.tono,
      titulo: pesos.titulo,
    },
  ];
  if (fuente) cifras.push({ etiqueta: "Datos", valor: fuente });
  return <CifrasPestana ariaLabel="Cifras del archivo de frecuencias" cifras={cifras} />;
}
