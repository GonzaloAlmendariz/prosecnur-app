// El aviso en línea de «Un color por opción» encendido sobre una lista sin colores (H2): dice por qué no se ve y enlaza
// Identidad › Colores de las respuestas con la dirección canónica (pestaña y pieza en el foco).

import { Link, useLocation } from "react-router-dom";
import type { GraficadorRef } from "../../../../api/graficos";
import { useSession } from "../../../../lib/SessionContext";
import { searchDePiezaIdentidad } from "../../estilo/direccionIdentidad";
import { paletaDeLaPregunta } from "../../estilo/modeloPaletasConNombre";
import { usePaletasRespuestas } from "../../estilo/usePaletasRespuestas";
import { useGraficosReportScope } from "../../reportScope";
import { preguntasDelGrafico } from "../modeloMaqueta";
import { varCalificada } from "../ordenCategorias";
import { AVISO_SIN_COLORES, sinColoresEnLaLista } from "./colorPorOpcion";
import "../datosGrafico.css";

export function AvisoColorPorOpcion({ valor }: { valor: GraficadorRef }) {
  const loc = useLocation();
  const scope = useGraficosReportScope(loc.search);
  const baseActiva = useSession().state?.active_base;
  const { listas, filas } = usePaletasRespuestas();
  if (!listas) return null;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const halladas = preguntasDelGrafico(args)
    .map((p) => paletaDeLaPregunta(filas, varCalificada(p, baseActiva, scope)) ?? paletaDeLaPregunta(filas, p))
    .flatMap((h) => (h ? [h.fila] : []));
  if (!sinColoresEnLaLista(halladas)) return null;
  return (
    <span className="pulso-f6-dato-ayuda is-aviso" role="note" data-qa="aviso-color-por-opcion">
      {AVISO_SIN_COLORES}{" "}
      <Link className="pulso-f6-enlace-ayuda" to={{ pathname: loc.pathname, search: searchDePiezaIdentidad(loc.search, "colores") }}>
        Identidad › Colores
      </Link>.
    </span>
  );
}
