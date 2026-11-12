import { useCallback, useId, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileSpreadsheet, LayoutList, Network } from "../../../../vendor/lucide-react";
import type { EstudioBase, Pregunta, Seccion } from "../../../../api/client";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import type { CifraDePestana } from "../../../../components/procesamiento/CifrasDePestana";
import { MesaDePestana } from "../../../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../../components/PulsoButton";
import { conNivel } from "../../../../lib/navegacion/direccion";
import { useDireccion } from "../../../../lib/navegacion/useDireccion";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { LogicCanvas } from "../../../xlsformEditor/canvas-graph/LogicCanvas";
import { buildReadOnlyLogicInputs } from "../../PreguntasPanel";
import { CabeceraDeMesaDeCarga } from "../revision/CabeceraDeMesaDeCarga";
import { SelectorDeBaseCarga } from "../SelectorDeBaseCarga";
import {
  TODAS_LAS_SECCIONES,
  buscar,
  cifrasDeFormulario,
  conteoPorFiltro,
  cumpleFiltro,
  preguntaElegida,
  preguntasDeSeccion,
  type FiltroDePreguntas,
} from "./formularioModel";
import { InspectorDePregunta } from "./InspectorDePregunta";
import { ListaDeSecciones } from "./ListaDeSecciones";
import { TablaDePreguntas } from "./TablaDePreguntas";
import "../revision/marcoDeMesa.css";
import "./formulario.css";

type Vista = { seccion: string | null; filtro: FiltroDePreguntas; busqueda: string };

/**
 * Carga › Formulario con la forma del prototipo "carga-formulario": la
 * cabecera con las cifras del formulario y el mapa de lógica; a la izquierda
 * las secciones, en el centro sus preguntas y a la derecha la pregunta
 * elegida. Una sola composición para una y varias bases: con varias, el
 * selector de base va en la cabecera.
 */
export function MesaDeFormulario({
  estructura,
  varias,
  bases,
  baseDelEsquema,
  onCambiarBaseDelEsquema,
}: {
  estructura: { secciones: Seccion[]; preguntas: Pregunta[] } | null;
  varias: boolean;
  bases: Record<string, EstudioBase> | null;
  baseDelEsquema: string;
  onCambiarBaseDelEsquema: (nombre: string) => void;
}) {
  const idTabla = useId();
  const [vista, setVista] = useState<Vista>({ seccion: null, filtro: "todas", busqueda: "" });
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const foco = useDireccion()?.foco ?? null;
  const location = useLocation();
  const navigate = useNavigate();
  const elegirPregunta = useCallback((nombre: string) => {
    navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", nombre) }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const secciones = estructura?.secciones ?? [];
  const preguntas = estructura?.preguntas ?? [];
  // Sin elección, la sección de la pregunta de la dirección; si no, la primera.
  const seccion = vista.seccion
    ?? preguntas.find((p) => p.name === foco)?.seccion
    ?? secciones[0]?.name
    ?? TODAS_LAS_SECCIONES;
  const deLaSeccion = useMemo(() => buscar(preguntasDeSeccion(preguntas, seccion), vista.busqueda), [preguntas, seccion, vista.busqueda]);
  const conteo = conteoPorFiltro(deLaSeccion);
  const visibles = deLaSeccion.filter((p) => cumpleFiltro(p, vista.filtro));
  const elegida = preguntaElegida(visibles, foco);
  const logica = useMemo(() => buildReadOnlyLogicInputs(preguntas, secciones), [preguntas, secciones]);
  const nombreSeccion = seccion === TODAS_LAS_SECCIONES
    ? "Todas las secciones"
    : secciones.find((s) => s.name === seccion)?.label || seccion;

  const c = estructura ? cifrasDeFormulario(estructura) : null;
  const cifras: CifraDePestana[] = c
    ? [
        { clave: "preguntas", valor: formatoConteo(c.preguntas), rotulo: c.preguntas === 1 ? "pregunta" : "preguntas", rango: 1 },
        { clave: "secciones", valor: formatoConteo(c.secciones), rotulo: c.secciones === 1 ? "sección" : "secciones" },
        { clave: "condicion", valor: formatoConteo(c.conCondicion), base: formatoConteo(c.preguntas), rotulo: "con condición" },
        ...(c.calculadas > 0 ? [{ clave: "calculadas", valor: formatoConteo(c.calculadas), rotulo: c.calculadas === 1 ? "cálculo" : "cálculos", rango: 3 as const }] : []),
      ]
    : [];
  const nombresDeBases = bases ? Object.keys(bases) : [];
  const cabecera = (
    <CabeceraDeMesaDeCarga
      pestana="formulario"
      titulo="Formulario"
      cifras={cifras}
      pendientes='"Revisión 3, publicada el 28 oct": la estructura que lee la pestaña no trae la revisión publicada. "Abrir en Formularios": sin decidir qué formulario del editor abre una base cargada'
      acciones={estructura || (varias && nombresDeBases.length > 1) ? (
        <>
          {varias ? <SelectorDeBaseCarga bases={nombresDeBases} elegida={baseDelEsquema} onCambiar={onCambiarBaseDelEsquema} /> : null}
          {estructura ? (
            <PulsoButton variant="secondary" size="md" onClick={() => setMapaAbierto(true)}>
              <Network size={14} aria-hidden="true" />
              Mapa de lógica
            </PulsoButton>
          ) : null}
        </>
      ) : undefined}
    />
  );

  return (
    <div className="pulso-carga-mesa-kit pulso-formulario" data-carga-surface="structure">
      <MesaDePestana grupo="carga/formulario" columnas={3} cabecera={cabecera}>
        <PanelDeMesa zona="secciones" titulo="Secciones" conteo={estructura ? secciones.length : undefined}>
          {estructura ? (
            <ListaDeSecciones
              secciones={secciones}
              preguntas={preguntas}
              elegida={seccion}
              onElegir={(s) => setVista({ ...vista, seccion: s })}
              idTabla={idTabla}
            />
          ) : (
            <EstadoVacio tamano="compacto" icono={<LayoutList size={15} />} titulo="Sin secciones" />
          )}
        </PanelDeMesa>
        <PanelDeMesa
          zona="preguntas"
          titulo={estructura ? nombreSeccion : "Preguntas"}
          conteo={estructura ? deLaSeccion.length : undefined}
          etiquetaCuerpo="Preguntas de la sección"
        >
          {estructura ? (
            <TablaDePreguntas
              id={idTabla}
              preguntas={visibles}
              todas={preguntas}
              conteo={conteo}
              filtro={vista.filtro}
              onFiltro={(filtro) => setVista({ ...vista, filtro })}
              busqueda={vista.busqueda}
              onBuscar={(busqueda) => setVista({ ...vista, busqueda })}
              elegida={elegida?.name ?? null}
              onElegir={elegirPregunta}
            />
          ) : (
            <EstadoVacio
              tamano="normal"
              icono={<FileSpreadsheet size={18} />}
              titulo="Esta base no tiene formulario"
              descripcion="Se carga en Bases."
            />
          )}
        </PanelDeMesa>
        <InspectorDePregunta pregunta={estructura ? elegida : null} todas={preguntas} />
      </MesaDePestana>
      {estructura ? (
        <LogicCanvas
          open={mapaAbierto}
          onClose={() => setMapaAbierto(false)}
          structure={logica.structure}
          catalogs={logica.catalogs}
          readOnly
          title="Mapa de lógica del instrumento"
          backLabel="Volver al formulario"
        />
      ) : null}
    </div>
  );
}
