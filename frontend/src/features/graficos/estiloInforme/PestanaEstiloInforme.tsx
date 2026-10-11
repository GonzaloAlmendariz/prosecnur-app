// Pestaña «Estilo del informe» de Procesamiento › Gráficos (A10 W-E; decisiones 28–29). Dirección:
// `/graficos?pestana=estilo-informe`. Trae a Láminas lo que sólo vivía en el «Estilo global» del editor anterior: texto
// de la base (C48), cálculos (C50), paletas (C51), línea visual (C52) y la parte del Word que se decide (C49 reducida).
// Los íconos (C53) son otra rebanada.
//
// Escribe en `usePlanStore` (un paso deshacible por cambio) y lo guarda el autosave de siempre: en la base activa o, con
// `scope=consolidado`, en el borrador del informe compartido. Habilitada en los dos alcances (`disponibilidadInforme`).
//
// Un solo dueño de desplazamiento (C4, No Scroll Jail): el cuerpo.

import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { resolveWordPresetsDefaults } from "../../../api/graficosConfigDefaults";
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
  bloquesFijados,
  conArg,
  conDecimales,
  conDecimalesEnTodas,
  conMetodo,
  conMetodoEnTodas,
  conOcultarEtiqueta,
  defaultDeArg,
  filasCalculos,
  lineaVisualAplicada,
  listasConColor,
  notaRedondeo,
  ocultarEtiquetaSiTitulo,
  sinArgs,
  sinCalculos,
  textoBase,
  type MapaPresets,
} from "./modeloEstiloInforme";
import { SeccionCalculos, type AccionesCalculos } from "./SeccionCalculos";
import { SeccionLineaVisual } from "./SeccionLineaVisual";
import { SeccionPaletas } from "./SeccionPaletas";
import { SeccionTextoBase } from "./SeccionTextoBase";
import { SeccionWordRecetario } from "./SeccionWordRecetario";
// Los sellos «Del recetario»/«Propio» y «Modificado» son los de «Estilo del cliente»: se reusa su hoja, no se copian.
import "../estilo/estilo.css";
import "./estiloInforme.css";

export default function PestanaEstiloInforme() {
  const location = useLocation();
  const scope = useGraficosReportScope(location.search);
  const disponibilidad = disponibilidadInforme(scope);

  const { presets: catalogo, presetsByName, loading: cargandoCatalogo, error: errorCatalogo } = usePresetsMetadata();
  const { presets: defaults, loading: cargandoDefaults } = usePresetsDefaults();
  const presets = usePlanStore((s) => s.presets);
  const setPresets = usePlanStore((s) => s.setPresets);
  const wPresets = usePlanStore((s) => s.wPresets);
  const setWPresets = usePlanStore((s) => s.setWPresets);
  const configDefaults = usePlanStore((s) => s.configDefaults);
  const paletas = usePlanStore((s) => s.paletas);
  const scopeRules = usePlanStore((s) => s.scopeRules);

  const metaBase = presetsByName[PRESET_BASE];
  const referenciaWord = useMemo(() => resolveWordPresetsDefaults(configDefaults), [configDefaults]);
  const texto = textoBase(presets, defaults, metaBase);
  const nota = notaRedondeo(presets, defaults, metaBase);
  const filas = useMemo(() => filasCalculos(catalogo, presets, defaults), [catalogo, presets, defaults]);
  const bloques = useMemo(() => bloquesFijados(catalogo, wPresets, referenciaWord), [catalogo, wPresets, referenciaWord]);
  const opcionWord = ocultarEtiquetaSiTitulo(wPresets, referenciaWord);

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
    ? "Cargando el catálogo del recetario…"
    : errorCatalogo
      ? `No se pudo leer el catálogo del recetario: ${errorCatalogo}`
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
        <h2 className="pulso-f6-informe-titulo">Estilo del informe</h2>
        <p className="pulso-f6-informe-ayuda" role="note">{disponibilidad.ambito}</p>
      </header>
      <div className="pulso-f6-informe-cuerpo" data-qa-scroll-owner="estilo-informe">
        <div
          className="pulso-f6-informe-secciones"
          data-qa-geometry-group="graficos/f6-estilo-informe-secciones"
          data-qa-geometry-contract="intrinsic"
        >
          <SeccionTextoBase
            texto={texto}
            onCambiar={(arg, valor) => cambiarPresets((p) => conArg(p, PRESET_BASE, arg, valor, defaultBase(arg)))}
            onVolver={(arg) => cambiarPresets((p) => sinArgs(p, PRESET_BASE, [arg]))}
            onVolverTodo={() => cambiarPresets((p) => sinArgs(p, PRESET_BASE, [ARG_FORMATO, ARG_SUFIJO]))}
          />
          <SeccionCalculos filas={filas} nota={nota} acciones={acciones} estado={estadoCalculos} />
          <SeccionLineaVisual aplicada={lineaVisualAplicada(scopeRules)} />
          <SeccionPaletas listasConColor={listasConColor(paletas)} />
          <SeccionWordRecetario
            opcion={opcionWord}
            bloques={bloques}
            motivoNoEditable={disponibilidad.motivoWord}
            onOpcion={(activa) => setWPresets(conOcultarEtiqueta(usePlanStore.getState().wPresets, referenciaWord, activa))}
            estado={estadoCatalogo}
          />
        </div>
      </div>
    </div>
  );
}
