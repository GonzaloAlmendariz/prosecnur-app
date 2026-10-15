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
import { Subpestanas, useSubpestana, type Subpestana } from "../subpestanas/Subpestanas";
import { conCasosJunto, leerCasosJunto } from "./casosJunto";
import { ARG_SUFIJO_POR_BASE, conSufijoDeBase, leerSufijosPorBase } from "./sufijoPorBase";
import { useVariables } from "../useVariables";
// Los sellos «Del recetario»/«Propio» y «Modificado» son los de «Estilo del cliente»: se reusa su hoja, no se copian.
import "../estilo/estilo.css";
import "./estiloInforme.css";

// D3 (ID2, 2026-10-14): la línea visual se mudó a Identidad.
type SubInforme = "base" | "calculos" | "casos";
const SUB_INFORME: readonly Subpestana<SubInforme>[] = [
  { key: "base", label: "Base y notas" },
  { key: "calculos", label: "Cálculos" },
  { key: "casos", label: "Casos" },
];

export default function PestanaEstiloInforme() {
  const [sub, setSub] = useSubpestana(SUB_INFORME);
  const location = useLocation();
  const scope = useGraficosReportScope(location.search);
  const sesion = useOptionalSession();
  const disponibilidad = disponibilidadInforme(scope, sesion?.state?.estudio_processing_mode === "independent_siblings");

  const { presets: catalogo, presetsByName, loading: cargandoCatalogo, error: errorCatalogo } = usePresetsMetadata();
  const { presets: defaults, loading: cargandoDefaults } = usePresetsDefaults();
  const presets = usePlanStore((s) => s.presets);
  const setPresets = usePlanStore((s) => s.setPresets);
  const { sources: fuentes, multi } = useVariables();
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
    onVolverTodo: () => cambiarPresets((p) => filas.reduce(sinCalculos, sinArgs(p, PRESET_BASE, [ARG_NOTA]))),
  };

  const cargando = cargandoCatalogo || cargandoDefaults;
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
        <h2 className="pulso-f6-informe-titulo">Reglas</h2>
        <p className="pulso-f6-informe-ayuda" role="note">{disponibilidad.ambito}</p>
        <Subpestanas opciones={SUB_INFORME} actual={sub} onCambiar={setSub} etiqueta="Reglas" />
      </header>
      <div className="pulso-f6-informe-cuerpo" data-qa-scroll-owner="estilo-informe">
        <div
          className="pulso-f6-informe-secciones"
          data-qa-geometry-group="graficos/f6-estilo-informe-secciones"
          data-qa-geometry-contract="intrinsic"
        >
          {sub === "base" && (
          <SeccionTextoBase
            texto={texto}
            onCambiar={(arg, valor) => cambiarPresets((p) => conArg(p, PRESET_BASE, arg, valor, defaultBase(arg)))}
            onVolver={(arg) => cambiarPresets((p) => sinArgs(p, PRESET_BASE, [arg]))}
            onVolverTodo={() => cambiarPresets((p) => sinArgs(p, PRESET_BASE, [ARG_FORMATO, ARG_SUFIJO, ARG_SUFIJO_POR_BASE]))}
            bases={bases}
            sufijosPorBase={leerSufijosPorBase(presets)}
            onSufijoDeBase={(base, palabra) => cambiarPresets((p) => conSufijoDeBase(p, base, palabra))}
          />
          )}
          {sub === "calculos" && <SeccionCalculos filas={filas} nota={nota} acciones={acciones} estado={estadoCalculos} />}
          {sub === "casos" && <SeccionCasos casos={leerCasosJunto(presets)} onCambiar={(c) => cambiarPresets((p) => conCasosJunto(p, c))} />}
        </div>
      </div>
    </div>
  );
}
