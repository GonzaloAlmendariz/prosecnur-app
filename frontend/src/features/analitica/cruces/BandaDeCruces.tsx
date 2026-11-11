// Banda de Cruces: qué entra al archivo y con qué pesos. Cada cifra se dice una
// vez aquí y no vuelve a aparecer en los paneles. Las tablas, las variables de
// cruce y los pesos salen de la vista previa del motor; las secciones y las
// excluidas, de la config. Las que se deciden en otra pestaña llevan a ella.

import { Link, useLocation } from "react-router-dom";

import type { CrucesPreview } from "../../../api/analitica";
import { formatoConteo } from "../../../lib/formatoNumero";
import { serializarDireccion } from "../../../lib/navegacion/direccion";
import { searchConPanel } from "../../../lib/navegacion/paneles";
import { CifrasPestana, type CifraPestana } from "../CifrasPestana";
import { DIRECCION_DATOS } from "../direccionesAnalitica";
import type { ResumenSecciones } from "../estructuraDeSecciones";
import { PANEL_VARIABLES_EXCLUIDAS } from "../panelesAnalitica";
import { cifraDeSecciones } from "../tablas/cifrasDeFrecuencias";
import type { Lectura } from "../tablas/useLecturaPorBase";
import { rotuloDeFuente } from "../tablas/vistaPreviaModelo";
import { cifraDePesosDeCruces, cifraDeTablasDeCruces, cifraDeVariablesDeCruce, rotuloDeTablasDeCruces } from "./crucesModelo";

const DIRECCION_PONDERACION = serializarDireccion({
  modulo: "procesamiento",
  seccion: "analitica",
  pestana: "ponderacion",
});

export function BandaDeCruces({ vistaPrevia, resumen, seccionesDeclaradas, excluidas }: {
  vistaPrevia: Lectura<CrucesPreview>;
  resumen: ResumenSecciones;
  seccionesDeclaradas: number;
  excluidas: number;
}) {
  const location = useLocation();
  const tablas = cifraDeTablasDeCruces(vistaPrevia);
  const variables = cifraDeVariablesDeCruce(vistaPrevia);
  const pesos = cifraDePesosDeCruces(vistaPrevia);
  const secciones = cifraDeSecciones(resumen, seccionesDeclaradas);
  const fuente = vistaPrevia.fase === "error" ? null : rotuloDeFuente(vistaPrevia.datos?.fuente ?? null);
  const haciaExcluidas = { pathname: location.pathname, search: searchConPanel(location.search, PANEL_VARIABLES_EXCLUIDAS) };
  // Sin variables de cruce no hay tablas que contar: el vacío de la vista previa lo dice.
  const sinCruces = vistaPrevia.datos !== null && vistaPrevia.fase !== "error" && vistaPrevia.datos.cruces.length === 0;
  const cifras: CifraPestana[] = [
    ...(sinCruces ? [] : [{ etiqueta: rotuloDeTablasDeCruces(vistaPrevia), valor: tablas.valor, tono: tablas.tono, titulo: tablas.titulo }]),
    { etiqueta: "Variables de cruce", valor: variables.valor, tono: variables.tono },
    { etiqueta: "Secciones", valor: <Link to={DIRECCION_DATOS}>{secciones.valor}</Link>, titulo: secciones.titulo },
    { etiqueta: "Variables excluidas", valor: <Link to={haciaExcluidas}>{formatoConteo(excluidas)}</Link> },
    {
      etiqueta: "Pesos",
      valor: <Link to={DIRECCION_PONDERACION}>{pesos.valor}</Link>,
      tono: pesos.tono,
      titulo: pesos.titulo,
    },
  ];
  if (fuente) cifras.push({ etiqueta: "Datos", valor: fuente });
  return <CifrasPestana ariaLabel="Cifras del archivo de cruces" cifras={cifras} />;
}
