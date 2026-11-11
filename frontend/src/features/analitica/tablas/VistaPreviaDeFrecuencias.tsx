// Columna central de Frecuencias, "Así sale en el archivo": la tabla de la
// pregunta elegida tal como la devuelve la vista previa del motor, con los
// pesos ya aplicados. Cada estado ocupa el mismo contenedor: leyendo (con su
// marca de readiness en falso, para que el QA no mida una carga), lectura
// fallida (con el caso de una base sin preparar), archivo sin tablas, pregunta
// sin tabla, y la tabla de una lectura anterior, atenuada, mientras llega la
// nueva o mientras un cambio espera a guardarse.

import { useEffect, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import type { FrecuenciasPreview, FrecuenciasPreviewTabla } from "../../../api/analitica";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { Table2 } from "../../../vendor/lucide-react";
import { DIRECCION_DATOS } from "../direccionesAnalitica";
import { AvisoDeGuardado } from "./AvisoDeGuardado";
import { ConmutadorDeCifras } from "./ConmutadorDeCifras";
import { FalloDeVistaPrevia } from "./FalloDeVistaPrevia";
import { HojaDeFrecuencias } from "./HojaDeFrecuencias";
import { PanelDeZona } from "./PanelDeZona";
import { PieDeVistaPrevia } from "./PieDeVistaPrevia";
import type { VistaPreviaDeFrecuencias as Vista } from "./useVistaPreviaDeFrecuencias";
import { useVistaDeTablas } from "./vistaDeTablasStore";
import { causaSinTabla, esLaVariable, tienePie } from "./vistaPreviaModelo";

/** La tabla de la pregunta que se ve: la de la hoja o la pedida aparte; `null` si no llegó o no tiene. */
export function tablaQueSeVe(
  hoja: readonly FrecuenciasPreviewTabla[] | undefined,
  aparte: readonly FrecuenciasPreviewTabla[] | undefined,
  elegida: string | null,
): FrecuenciasPreviewTabla | null {
  if (!elegida) return null;
  return hoja?.find((t) => esLaVariable(t, elegida)) ?? aparte?.find((t) => esLaVariable(t, elegida)) ?? null;
}

export function VistaPreviaDeFrecuencias({ vista, elegida, etiquetaDe, causaDelVacio, onSoltarFoco, selector, etiquetaDeBase }: {
  vista: Vista;
  /** La pregunta que se ve: la de la dirección o, sin ella, la primera de la hoja. */
  elegida: string | null;
  /** La pregunta de una variable, por su nombre. */
  etiquetaDe: (variable: string) => string;
  /** Por qué el archivo no tendría tablas. */
  causaDelVacio: (preview: FrecuenciasPreview) => string;
  /** La pregunta de la dirección perdió su tabla por un ajuste: se suelta el foco. */
  onSoltarFoco: () => void;
  /** A lo angosto, la lista "Preguntas" se recoge en este selector, en la cabecera de la tabla. */
  selector?: ReactNode;
  /** El nombre que ve el usuario de una base, por su identificador. */
  etiquetaDeBase?: (base: string) => string;
}) {
  const navegar = useNavigate();
  const cifras = useVistaDeTablas((s) => s.cifras.frecuencias);
  const { hoja } = vista;
  const preview = hoja.datos;
  const aparteDatos = vista.elegida?.datos ?? null;
  const tabla = tablaQueSeVe(preview?.tablas, aparteDatos?.tablas, elegida);

  // La pregunta pedida aparte que no tiene tabla: por qué. Un foco que la perdió por un ajuste se suelta sin aviso.
  // Si el servicio no la trae ni dice por qué, no se inventa un motivo: va como desconocida.
  const sinTablaDeLaElegida = elegida && !tabla && aparteDatos && vista.elegida?.fase === "lista" && !vista.focoPerdido
    ? { motivo: aparteDatos.sin_tabla.find((s) => s.variable === elegida)?.motivo ?? null }
    : null;
  const sinTabla = useMemo(() => preview?.sin_tabla ?? [], [preview]);

  useEffect(() => {
    if (vista.focoPerdido) onSoltarFoco();
  }, [vista.focoPerdido, onSoltarFoco]);

  const fallo = hoja.fase === "error" ? hoja : null;
  const leyendo = !fallo && preview === null;
  const vacia = !fallo && preview !== null && preview.tablas.length === 0;
  const leyendoLaElegida = !fallo && !leyendo && !vacia && !tabla && !sinTablaDeLaElegida && (vista.elegida?.fase === "leyendo");
  const conPie = vista.errorGuardado || (preview && !fallo && tienePie(preview, sinTabla, vista.releyendo));

  return (
    <PanelDeZona
      zona="tabla"
      titulo="Así sale en el archivo"
      icono={<Table2 size={16} aria-hidden="true" />}
      ocupado={vista.releyendo}
      acciones={(
        <>
          {selector}
          {tabla && tabla.tipo !== "numerica" ? <ConmutadorDeCifras pestana="frecuencias" ponderado={preview?.ponderado ?? false} /> : null}
        </>
      )}
      pie={conPie ? (
        <>
          {vista.errorGuardado ? <AvisoDeGuardado /> : null}
          {preview && !fallo && tienePie(preview, sinTabla, vista.releyendo) ? (
            <PieDeVistaPrevia preview={preview} sinTabla={sinTabla} releyendo={vista.releyendo} etiquetaDeBase={etiquetaDeBase} />
          ) : null}
        </>
      ) : undefined}
    >
      <div className="tablas-vista" data-qa-geometry-group="analitica/frecuencias-tablas" data-qa-geometry-contract="intrinsic">
        {fallo ? <FalloDeVistaPrevia fallo={fallo} /> : null}
        {leyendo || leyendoLaElegida ? <CargaDeBloque label={leyendo ? "Leyendo las tablas del archivo" : "Leyendo la tabla de la pregunta"} /> : null}
        {vacia && preview ? (
          <EstadoVacio
            tamano="normal"
            icono={<Table2 size={20} />}
            titulo="Sin tablas en el archivo"
            descripcion={causaDelVacio(preview)}
            accion={<PulsoButton variant="secondary" nav onClick={() => navegar(DIRECCION_DATOS)}>Ir a Datos</PulsoButton>}
          />
        ) : null}
        {sinTablaDeLaElegida && elegida ? (
          <EstadoVacio
            tamano="normal"
            icono={<Table2 size={20} />}
            titulo="Sin tabla en el archivo"
            descripcion={sinTablaDeLaElegida.motivo
              ? `"${etiquetaDe(elegida)}" ${causaSinTabla(sinTablaDeLaElegida.motivo)}`
              : `La vista previa no trajo la tabla de "${etiquetaDe(elegida)}".`}
          />
        ) : null}
        {tabla && preview ? (
          <HojaDeFrecuencias tabla={tabla} ponderado={preview.ponderado} cifras={cifras} releyendo={vista.releyendo} />
        ) : null}
      </div>
    </PanelDeZona>
  );
}
