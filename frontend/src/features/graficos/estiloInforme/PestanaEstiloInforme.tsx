// Pestaña «Reglas» (antes «Estilo del informe») de Procesamiento › Gráficos (A10 W-E; decisiones 28–29). Dirección:
// `/graficos?pestana=reglas` (`estilo-informe` se lee como alias). Trae a Láminas lo que sólo vivía en el «Estilo global» del editor anterior: texto
// de la base (C48), cálculos (C50), paletas (C51), línea visual (C52) y la parte del Word que se decide (C49 reducida).
// Los íconos (C53) son otra rebanada.
//
// Escribe en `usePlanStore` (un paso deshacible por cambio) y lo guarda el autosave de siempre: en la base activa o, con
// `scope=consolidado`, en el borrador del informe compartido. Habilitada en los dos alcances (`disponibilidadInforme`).
//
// Un solo dueño de desplazamiento (C4, No Scroll Jail): el cuerpo.

import { useOptionalSession } from "../../../lib/SessionContext";
import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useGraficosReportScope } from "../reportScope";
import { usePlanStore } from "../store";
import { usePresetsMetadata } from "../usePresetsMetadata";
import { usePresetsDefaults } from "../usePresetsDefaults";
import { disponibilidadInforme } from "./disponibilidadInforme";
import {
  ARG_FORMATO,
  ARG_NOTA,
  ARG_SUFIJO,
  PRESET_BASE,
  conArg,
  conDecimales,
  conDecimalesEnTodas,
  conMetodo,
  conMetodoEnTodas,
  defaultDeArg,
  filasCalculos,
  notaRedondeo,
  sinArgs,
  sinCalculos,
  textoBase,
  type MapaPresets,
} from "./modeloEstiloInforme";
import { SeccionCalculos, type AccionesCalculos } from "./SeccionCalculos";
import { SeccionTextoBase } from "./SeccionTextoBase";
import { SeccionCasos } from "./SeccionCasos";
import { useEffect } from "react";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { NivelesReglas } from "./NivelesReglas";
import { excepcionesDelPlan, nombresPropiosDeBase } from "./excepcionesPlan";
import { parseBaseLabels } from "../laminas/datosBase/nombresPorBaseModel";
import { GRAFICOS_CON_CASOS, opcionCasos } from "../laminas/CasosGrafico";
import { tituloQueSale } from "../laminas/tituloQueSale";
import { ARG_NOTA_MODO, ARG_NOTA_TEXTO, conModoNota, conTextoNota, leerNota } from "./notaRedondeo";
import { conCasosJunto, leerCasosJunto } from "./casosJunto";
import { ARG_SUFIJO_POR_BASE, conSufijoDeBase, leerSufijosPorBase } from "./sufijoPorBase";
import { useVariables } from "../useVariables";
// Los sellos «Del recetario»/«Propio» y «Modificado» son los de «Estilo del cliente»: se reusa su hoja, no se copian.
import "../estilo/estilo.css";
import "./estiloInforme.css";

// R1 del rediseño (2026-10-15): una sola página con las reglas apiladas (antes subpestañas Base y notas · Cálculos ·
// Casos). El `foco` de un enlace viejo (`calculos`, `casos`, `base`) lleva a su regla. La línea visual vive en Identidad (D3).
const REGLA_DE_FOCO: Readonly<Record<string, string>> = { calculos: "redondeo", redondeo: "redondeo", casos: "casos", base: "base" };

export default function PestanaEstiloInforme() {
  const { foco } = useSeccion("procesamiento");
  const location = useLocation();
  const scope = useGraficosReportScope(location.search);
  const sesion = useOptionalSession();
  const disponibilidad = disponibilidadInforme(scope, sesion?.state?.estudio_processing_mode === "independent_siblings");

  const { presets: catalogo, presetsByName, loading: cargandoCatalogo, error: errorCatalogo } = usePresetsMetadata();
  const { presets: defaults, loading: cargandoDefaults } = usePresetsDefaults();
  const presets = usePlanStore((s) => s.presets);
  const setPresets = usePlanStore((s) => s.setPresets);
  const { sources: fuentes, multi, variables: variablesPlan } = useVariables();
  const bases = multi ? fuentes.map((f) => f.name) : [];

  const metaBase = presetsByName[PRESET_BASE];
  const texto = textoBase(presets, defaults, metaBase);
  const nota = notaRedondeo(presets, defaults, metaBase);
  const filas = useMemo(() => filasCalculos(catalogo, presets, defaults), [catalogo, presets, defaults]);

  // Se lee el estado vivo al escribir: dos cambios seguidos no se pisan con un cierre viejo.
  const cambiarPresets = useCallback((f: (p: MapaPresets) => MapaPresets) => {
    const actual = usePlanStore.getState().presets;
    const siguiente = f(actual);
    if (siguiente !== actual) setPresets(siguiente);
  }, [setPresets]);

  const defaultBase = useCallback(
    (arg: string) => defaultDeArg(defaults, metaBase, PRESET_BASE, arg),
    [defaults, metaBase],
  );

  const acciones: AccionesCalculos = {
    onMetodo: (fila, metodo) => cambiarPresets((p) => conMetodo(p, fila, metodo)),
    onDecimales: (fila, dec) => cambiarPresets((p) => conDecimales(p, fila, dec)),
    onVolverFila: (fila) => cambiarPresets((p) => sinCalculos(p, fila)),
    onMetodoEnTodas: (metodo) => cambiarPresets((p) => conMetodoEnTodas(p, filas, metodo)),
    onDecimalesEnTodas: (dec) => cambiarPresets((p) => conDecimalesEnTodas(p, filas, dec)),
    onNota: (activa) => cambiarPresets((p) => conArg(p, PRESET_BASE, ARG_NOTA, activa, nota.porDefecto)),
    onModoNota: (modo) => cambiarPresets((p) => conModoNota(p, modo)),
    onTextoNota: (texto) => cambiarPresets((p) => conTextoNota(p, texto)),
    onVolverTodo: () => cambiarPresets((p) => filas.reduce(sinCalculos, sinArgs(p, PRESET_BASE, [ARG_NOTA, ARG_NOTA_MODO, ARG_NOTA_TEXTO]))),
  };

  const slidesPlan = usePlanStore((s) => s.plan.slides);
  // R5: los gráficos con casos propios («Siempre» / «Nunca» en su tarjeta) se listan bajo la regla.
  const excepcionesCasos = useMemo(() => excepcionesDelPlan(slidesPlan,
    (graficador, args) => (GRAFICOS_CON_CASOS.has(graficador) ? ({ siempre: "Siempre", nunca: "Nunca", informe: null } as const)[opcionCasos(args)] : null),
    (s) => tituloQueSale(s, variablesPlan, "Lámina")), [slidesPlan, variablesPlan]);
  // R6: los gráficos que nombran a sus públicos con otra palabra («Nombre de cada público» en su tarjeta).
  const excepcionesBase = useMemo(() => excepcionesDelPlan(slidesPlan, (_g, args) => nombresPropiosDeBase(args, parseBaseLabels),
    (s) => tituloQueSale(s, variablesPlan, "Lámina")), [slidesPlan, variablesPlan]);
  const cargando = cargandoCatalogo || cargandoDefaults;
  // Un enlace con `foco` lleva a su regla una vez montada (sin robar el foco del teclado).
  useEffect(() => {
    const id = foco ? REGLA_DE_FOCO[foco] : undefined;
    if (!id || cargando) return;
    document.getElementById(`regla-${id}`)?.scrollIntoView({ block: "start" });
  }, [foco, cargando]);
  const estadoCatalogo = cargandoCatalogo
    ? "Cargando…"
    : errorCatalogo
      ? `No se pudo leer el estilo por defecto: ${errorCatalogo}`
      : undefined;
  const estadoCalculos = estadoCatalogo ?? (filas.length === 0 ? "Ningún tipo de gráfico del catálogo rotula porcentajes." : undefined);

  return (
    <div
      className="pulso-f6-informe"
      data-audit-ready={cargando ? "false" : "graficos-estilo-informe"}
      data-qa-surface="graficos/f6-estilo-informe"
      data-scope={scope}
    >
      <header className="pulso-f6-informe-barra">
        <h2 className="pulso-f6-informe-titulo">Reglas del informe</h2>
        <p className="pulso-f6-informe-ayuda" role="note">{disponibilidad.ambito}</p>
      </header>
      <div className="pulso-f6-informe-cuerpo" data-qa-scroll-owner="estilo-informe">
        <div
          className="pulso-f6-informe-secciones"
          data-qa-geometry-group="graficos/f6-estilo-informe-secciones"
          data-qa-geometry-contract="intrinsic"
        >
          <NivelesReglas />
          <div id="regla-redondeo" className="pulso-f6-regla" data-qa-geometry-member>
            <SeccionCalculos filas={filas} nota={{ ...nota, ...leerNota(presets, nota.activa) }} acciones={acciones} estado={estadoCalculos} />
          </div>
          <div id="regla-casos" className="pulso-f6-regla" data-qa-geometry-member>
            <SeccionCasos casos={leerCasosJunto(presets)} onCambiar={(c) => cambiarPresets((p) => conCasosJunto(p, c))} excepciones={excepcionesCasos} />
          </div>
          <div id="regla-base" className="pulso-f6-regla" data-qa-geometry-member>
          <SeccionTextoBase
            texto={texto}
            onCambiar={(arg, valor) => cambiarPresets((p) => conArg(p, PRESET_BASE, arg, valor, defaultBase(arg)))}
            onVolver={(arg) => cambiarPresets((p) => sinArgs(p, PRESET_BASE, [arg]))}
            onVolverTodo={() => cambiarPresets((p) => sinArgs(p, PRESET_BASE, [ARG_FORMATO, ARG_SUFIJO, ARG_SUFIJO_POR_BASE]))}
            bases={bases}
            sufijosPorBase={leerSufijosPorBase(presets)}
            onSufijoDeBase={(base, palabra) => cambiarPresets((p) => conSufijoDeBase(p, base, palabra))}
            excepciones={excepcionesBase}
          />
          </div>
        </div>
      </div>
    </div>
  );
}
