// Panel «Comparar fuentes» (ADR 0102). Direccionable:
// `?panel=comparar-fuentes&foco=<baseA>~<baseB>`. Las dos bases se eligen
// arriba, fuera del scroll; elegir otra reescribe el foco, así el enlace
// siempre reproduce la comparación que se ve.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";
import { apiCargaCompararFuentes } from "../../../api/cargaArmonizacion";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { GitCompareArrows } from "../../../vendor/lucide-react";
import {
  PANEL_COMPARAR_FUENTES,
  cambiarLado,
  comparablesCon,
  gruposComparables,
  mensajeErrorComparar,
  parEfectivo,
  searchConComparacion,
  searchSinPanelYFoco,
  type BaseLigada,
  type ParBases,
} from "./compararFuentesModel";
import { CompararFuentesVista, type CargaComparacion } from "./CompararFuentesVista";
import { PanelLateralFuentes } from "./PanelLateralFuentes";
import "./compararFuentes.css";

export function readinessComparacion(carga: CargaComparacion, par: ParBases | null): string {
  if (!par) return "vacio:sin-par";
  if (carga.tipo === "cargando") return "false";
  if (carga.tipo === "error") return "vacio:error";
  return carga.datos.variables.length ? "true" : "vacio:sin-variables";
}

type Props = { bases: readonly BaseLigada[] };

function Selector({ par, bases, onCambio }: { par: ParBases; bases: readonly BaseLigada[]; onCambio: (par: ParBases) => void }) {
  const candidatasA = useMemo(() => [...gruposComparables(bases).values()].flat(), [bases]);
  const candidatasB = comparablesCon(par.a, bases);
  return (
    <div className="pulso-cf-selector" role="group" aria-label="Fuentes que se comparan">
      <label>
        <span className="pulso-cf-selector-a">Fuente A</span>
        <select
          value={par.a}
          onChange={(e) => { const nuevo = cambiarLado(par, "a", e.target.value, bases); if (nuevo) onCambio(nuevo); }}
        >
          {candidatasA.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span className="pulso-cf-selector-icono" aria-hidden="true"><GitCompareArrows size={16} /></span>
      <label>
        <span className="pulso-cf-selector-b">Fuente B</span>
        <select value={par.b} onChange={(e) => onCambio(cambiarLado(par, "b", e.target.value, bases) ?? par)}>
          {candidatasB.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </div>
  );
}

function PanelConDireccion({ bases }: Props) {
  const panel = usePanelDireccionable(PANEL_COMPARAR_FUENTES);
  const procesamiento = useSeccion("procesamiento");
  const location = useLocation();
  const navigate = useNavigate();
  const par = panel.abierto ? parEfectivo(procesamiento.foco, bases) : null;
  const baseA = par?.a ?? null;
  const baseB = par?.b ?? null;
  const [carga, setCarga] = useState<CargaComparacion>({ tipo: "cargando" });

  useEffect(() => {
    if (!baseA || !baseB) return;
    let vigente = true;
    setCarga({ tipo: "cargando" });
    apiCargaCompararFuentes(baseA, baseB)
      .then((datos) => { if (vigente) setCarga({ tipo: "listo", datos }); })
      .catch((e: unknown) => { if (vigente) setCarga({ tipo: "error", mensaje: mensajeErrorComparar(e) }); });
    return () => { vigente = false; };
  }, [baseA, baseB]);

  const escribir = useCallback(
    (search: string) => navigate({ pathname: location.pathname, search }, { replace: true }),
    [location.pathname, navigate],
  );
  const cerrar = useCallback(() => escribir(searchSinPanelYFoco(location.search)), [escribir, location.search]);

  return (
    <PanelLateralFuentes
      panel={panel}
      antetitulo="Carga › Bases del estudio"
      titulo="Comparar fuentes"
      descripcion="Dos bases del mismo formulario, variable por variable: qué distribuciones coinciden, cuáles difieren y qué categorías trae solo una."
      barra={par ? <Selector par={par} bases={bases} onCambio={(nuevo) => escribir(searchConComparacion(location.search, nuevo))} /> : null}
      auditReady={readinessComparacion(carga, par)}
      // La tarjeta abre con su base como A; si no hay botón de esa tarjeta, vuelve a «Comparar fuentes».
      claveDisparador={baseA ? `comparar:${baseA}` : "comparar"}
      ancho="ancho"
      onCerrar={cerrar}
    >
      {par ? (
        <CompararFuentesVista carga={carga} />
      ) : (
        // C5: vacío legítimo. Hace falta un segundo formulario cargado de la misma revisión.
        <div className="pulso-plf-estado" role="status" data-qa-geometry-capacity="owned">
          <strong>No hay dos fuentes que comparar</strong>
          <p>
            Se comparan bases ligadas a la misma revisión de un formulario publicado; por ejemplo, las respuestas de
            SurveyMonkey y el .sav limpiado del mismo cuestionario. Agrega la segunda base desde «Formulario publicado».
          </p>
        </div>
      )}
    </PanelLateralFuentes>
  );
}

/** Fuera de un router (renders estáticos) no hay dirección que lo abra. */
export function CompararFuentesPanel(props: Props) {
  return useInRouterContext() ? <PanelConDireccion {...props} /> : null;
}
