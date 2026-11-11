// Columna central de Cruces, "Así sale en el archivo": la tabla cruzada de la
// pregunta elegida tal como la devuelve la vista previa del motor, con todas
// las variables de cruce lado a lado como en el archivo. Cada estado ocupa el
// mismo contenedor: leyendo (con su marca de readiness en falso), lectura
// fallida (con el caso de una base sin preparar), archivo sin tablas (sin
// variables a cruzar, con su acción), pregunta sin tabla, y la tabla de una
// lectura anterior, atenuada, mientras llega la nueva o mientras un cambio
// espera a guardarse. En la cabecera, el conmutador de cifras.

import { useEffect, useMemo, type ReactNode } from "react";

import type { CrucesPreview, CrucesPreviewTabla, VariableInstrumento } from "../../../api/analitica";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { formatoConteo } from "../../../lib/formatoNumero";
import { GitBranch, Table2 } from "../../../vendor/lucide-react";
import type { ResumenSecciones } from "../estructuraDeSecciones";
import { AvisoDeGuardado } from "../tablas/AvisoDeGuardado";
import { ConmutadorDeCifras } from "../tablas/ConmutadorDeCifras";
import { FalloDeVistaPrevia } from "../tablas/FalloDeVistaPrevia";
import { PanelDeZona } from "../tablas/PanelDeZona";
import { PieDeLaHoja, type LineaDelPie } from "../tablas/PieDeLaHoja";
import { useVistaDeTablas } from "../tablas/vistaDeTablasStore";
import { avisosDeCruces, causaDelVacio, esLaTablaDe, sinTablaDeLaElegida } from "./crucesModelo";
import { ElegirVariableACruzar } from "./ElegirVariableACruzar";
import { HojaDeCruces } from "./HojaDeCruces";
import type { VistaPreviaDeCruces as Vista } from "./useVistaPreviaDeCruces";

import "./cruces.css";

/** La tabla de la pregunta que se ve: la de la hoja o la pedida aparte; `null` si no llegó o no tiene. */
export function tablaCruzadaQueSeVe(
  hoja: readonly CrucesPreviewTabla[] | undefined,
  aparte: readonly CrucesPreviewTabla[] | undefined,
  elegida: string | null,
): CrucesPreviewTabla | null {
  if (!elegida) return null;
  return hoja?.find((t) => esLaTablaDe(t, elegida)) ?? aparte?.find((t) => esLaTablaDe(t, elegida)) ?? null;
}

export function VistaPreviaDeCruces({ vista, elegida, cruzables, resumen, etiquetaDe, etiquetaDeBase, onSoltarFoco, onAgregarCruce, selector }: {
  vista: Vista;
  /** La pregunta que se ve: la de la dirección o, sin ella, la primera de la hoja. */
  elegida: string | null;
  /** Variables que se pueden agregar como variable de cruce desde el vacío. */
  cruzables: VariableInstrumento[];
  resumen: ResumenSecciones;
  /** La pregunta de una variable, por su nombre. */
  etiquetaDe: (variable: string) => string;
  /** El nombre que ve el usuario de una base, por su identificador. */
  etiquetaDeBase: (base: string) => string;
  /** La pregunta de la dirección perdió su tabla por un ajuste: se suelta el foco. */
  onSoltarFoco: () => void;
  onAgregarCruce: (variable: string) => void;
  /** A lo angosto, la lista "Preguntas" se recoge en este selector, en la cabecera de la tabla. */
  selector?: ReactNode;
}) {
  const cifras = useVistaDeTablas((s) => s.cifras.cruces);
  const { hoja } = vista;
  const preview: CrucesPreview | null = hoja.datos;
  const aparteDatos = vista.elegida?.datos ?? null;
  const tabla = tablaCruzadaQueSeVe(preview?.tablas, aparteDatos?.tablas, elegida);

  useEffect(() => {
    if (vista.focoPerdido) onSoltarFoco();
  }, [vista.focoPerdido, onSoltarFoco]);

  const fallo = hoja.fase === "error" ? hoja : null;
  const leyendo = !fallo && preview === null;
  const vacia = !fallo && preview !== null && preview.tablas.length === 0;
  const vacio = vacia && preview ? causaDelVacio(preview, resumen) : null;
  // La pregunta pedida aparte que no tiene tabla: por qué. Un foco que la perdió por un ajuste se suelta sin aviso.
  const sinTabla = elegida && !tabla && aparteDatos && !vista.focoPerdido ? sinTablaDeLaElegida(aparteDatos, elegida, etiquetaDe) : null;
  const leyendoLaElegida = !fallo && !leyendo && !vacia && !tabla && !sinTabla && vista.elegida?.fase === "leyendo";

  // El pie: los avisos con su causa y, con varias bases, de cuál es la vista previa.
  const lineas = useMemo<LineaDelPie[]>(() => {
    if (!preview || fallo) return [];
    const avisos = avisosDeCruces(preview, etiquetaDe).map((a) => ({ clave: a.clave, alerta: true, texto: a.texto }));
    const bases = !vista.releyendo && preview.base.n_bases > 1
      ? [{
        clave: "bases",
        alerta: false,
        texto: `Vista previa de la base "${etiquetaDeBase(preview.base.nombre)}". Al generar sale un archivo por cada una de las ${formatoConteo(preview.base.n_bases)} bases.`,
      }]
      : [];
    return [...avisos, ...bases];
  }, [preview, fallo, etiquetaDe, etiquetaDeBase, vista.releyendo]);
  const conPie = Boolean(vista.errorGuardado || lineas.length > 0);

  return (
    <PanelDeZona
      zona="tabla"
      titulo="Así sale en el archivo"
      icono={<Table2 size={16} aria-hidden="true" />}
      ocupado={vista.releyendo}
      acciones={(
        <>
          {selector}
          {tabla ? <ConmutadorDeCifras pestana="cruces" ponderado={preview?.ponderado ?? false} /> : null}
        </>
      )}
      pie={conPie ? (
        <>
          {vista.errorGuardado ? <AvisoDeGuardado /> : null}
          {lineas.length > 0 ? <PieDeLaHoja recorte={null} lineas={lineas} /> : null}
        </>
      ) : undefined}
    >
      <div className="tablas-vista cruces-vista" data-qa-geometry-group="analitica/cruces-tablas" data-qa-geometry-contract="intrinsic">
        {fallo ? <FalloDeVistaPrevia fallo={fallo} /> : null}
        {leyendo || leyendoLaElegida ? (
          <CargaDeBloque label={leyendo ? "Leyendo las tablas cruzadas del archivo" : "Leyendo la tabla de la pregunta"} />
        ) : null}
        {vacio ? (
          <EstadoVacio
            tamano="normal"
            icono={vacio.agregarVariable ? <GitBranch size={20} /> : <Table2 size={20} />}
            titulo={vacio.titulo}
            descripcion={vacio.descripcion}
            accion={vacio.agregarVariable && cruzables.length > 0 ? (
              <div className="cruces-vacio-accion">
                <ElegirVariableACruzar variables={cruzables} rotulo="Elegir variable a cruzar" onElegir={onAgregarCruce} />
              </div>
            ) : undefined}
          />
        ) : null}
        {sinTabla ? <EstadoVacio tamano="normal" icono={<Table2 size={20} />} titulo="Sin tabla cruzada" descripcion={sinTabla} /> : null}
        {tabla && preview ? (
          <HojaDeCruces
            tabla={tabla}
            ponderado={preview.ponderado}
            cifras={cifras}
            releyendo={vista.releyendo}
            maxLetras={preview.significancia_regla?.max_letras ?? undefined}
          />
        ) : null}
      </div>
    </PanelDeZona>
  );
}
