import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ListChecks, Plus } from "../../../../vendor/lucide-react";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../../components/States";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { searchDePestana, usePestanaValidacion } from "../../pestanaDireccionable";
import { FOCO_NUEVA, searchConPanelRegla } from "../../reglas/panel/usePanelRegla";
import { REGLAS_A_LA_VISTA, reglasDeLaPregunta } from "./modeloReglasDeLaPregunta";
import type { LecturaDelCatalogoDeExplorar } from "./useCatalogoDeExplorar";

/**
 * "Reglas sobre esta pregunta" (prototipo `validacion-explorar`): las reglas
 * del catálogo que leen la pregunta, con su estado y "Abrir", que lleva a su
 * ficha en Reglas; al pie, "Nueva regla sobre esta pregunta" abre el panel de
 * regla con la pregunta puesta.
 */
export default function ReglasDeLaPregunta({ variable, lectura }: { variable: string; lectura: LecturaDelCatalogoDeExplorar }) {
  const { irAPestana } = usePestanaValidacion();
  const location = useLocation();
  const navigate = useNavigate();
  const [todas, setTodas] = useState(false);
  const reglas = useMemo(
    () => (lectura.estado === "listo" ? reglasDeLaPregunta(lectura.catalogo, variable) : []),
    [lectura, variable],
  );
  const visibles = todas ? reglas : reglas.slice(0, REGLAS_A_LA_VISTA);

  const nuevaRegla = () =>
    navigate({
      pathname: location.pathname,
      search: searchConPanelRegla(searchDePestana(location.search, "reglas"), FOCO_NUEVA, { pregunta: variable }),
    });

  return (
    <section className="vx-tarjeta vx-reglas-pregunta" aria-labelledby="vx-reglas-pregunta-titulo">
      <div className="vx-reglas-pregunta-cab">
        <h4 id="vx-reglas-pregunta-titulo">Reglas sobre esta pregunta</h4>
        {lectura.estado === "listo" && <span className="pulso-panel-de-mesa-conteo">{formatoConteo(reglas.length)}</span>}
      </div>
      <div className="vx-reglas-pregunta-cuerpo" data-qa-geometry-capacity="owned">
        {lectura.estado === "cargando" ? (
          <LoadingBlock variant="inline" minHeight={40} label="Leyendo las reglas" />
        ) : lectura.estado === "error" ? (
          <ErrorBlock label="No se pudieron leer las reglas de la base" detail={lectura.mensaje} />
        ) : reglas.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<ListChecks size={18} />}
            title="Ninguna regla lee esta pregunta"
            hint={lectura.catalogo.plan_construido ? undefined : "El formulario todavía no se leyó en Reglas."}
          />
        ) : (
          <ul className="vx-reglas-lista" aria-label="Reglas que leen la pregunta" data-qa-geometry-group="validacion/explorar-reglas-pregunta" data-qa-geometry-contract="intrinsic">
            {visibles.map((r) => (
              <li key={r.id} data-tono={r.tono}>
                <span className="vx-reglas-punto" aria-hidden />
                <div>
                  <b>{r.nombre}</b>
                  <span>{r.estado}</span>
                </div>
                <PulsoButton
                  variant="link"
                  size="sm"
                  aria-label={`Abrir la regla ${r.nombre}`}
                  onClick={() => irAPestana("reglas", undefined, { familia: r.familia, foco: r.id })}
                >
                  Abrir
                </PulsoButton>
              </li>
            ))}
          </ul>
        )}
        {reglas.length > REGLAS_A_LA_VISTA && (
          <button type="button" className="vx-ver-mas" aria-expanded={todas} onClick={() => setTodas((t) => !t)}>
            {todas ? "Ver menos" : `Ver las ${formatoConteo(reglas.length)} reglas`}
          </button>
        )}
      </div>
      <div className="vx-reglas-pregunta-pie">
        <PulsoButton variant="secondary" size="md" onClick={nuevaRegla}>
          <Plus size={14} aria-hidden />
          Nueva regla sobre esta pregunta
        </PulsoButton>
      </div>
    </section>
  );
}
