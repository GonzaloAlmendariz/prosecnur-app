import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { sinMarcadores } from "./sugerenciasModulo";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, List } from "../../vendor/lucide-react";
import { apiCodifPreguntasAbiertas, arquetipoOf, PreguntaAbierta } from "../../api/client";
import { LoadingBlock, ErrorBlock } from "../../components/States";
import { RespuestasCodificador } from "./RespuestasCodificador";
import { IntegerCodificador } from "./IntegerCodificador";
import { AgruparCategoriasCodificador } from "./AgruparCategoriasCodificador";
import { textoPlano } from "../../lib/textoPlano";
import { sinEnfasis } from "../../lib/enfasisTexto";
import { conNivel } from "../../lib/navegacion/direccion";
import { useDireccion } from "../../lib/navegacion/useDireccion";
import { formatoConteo } from "../../lib/formatoNumero";
import { EstadoVacio } from "../../components/EstadoVacio";
import { PulsoButton } from "../../components/PulsoButton";
import { apiCodifMarcar } from "../../api/codificacion";
import { resolverFocoCodificar } from "./focoCodificar";
import { FocoSinIncluirAviso } from "./FocoSinIncluirAviso";
import { Panel } from "../../components/Panel";
import { MesaDePestana } from "../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../components/procesamiento/PanelDeMesa";
import type { EstadoDePestana } from "../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../components/procesamiento/CifrasDePestana";
import type { TipoDePregunta } from "../../components/procesamiento/FichaPregunta";
import type { Grupo } from "../../api/codificacion";
import { CabeceraDeCodificacion } from "./CabeceraDeCodificacion";
import { CabeceraDePregunta } from "./codificar/CabeceraDePregunta";
import { ListaDePreguntas } from "./codificar/ListaDePreguntas";
import type { MarcoDeCodificar, PartesDeMesa } from "./codificar/marcoDeCodificar";
import { ModoDeLaPregunta, useModoDeLaPregunta } from "./codificar/ModoDeLaPregunta";
import { tipoResultanteActivo } from "./codificar/tipoResultante";
import { useAvances, useCargarAvances } from "./avanceStore";
import { estadoDeAvance, porcentajeDeAvance, type AvanceDeCodificacion } from "./avanceDeCodificacion";
import "./codificar/codificar.css";
import "./codificar/lista.css";
import "./codificar/codigos.css";
import "./codificar/ventanas.css";

type Props = {
  onBackToOrganizar: () => void;
  /** El nombre de la base activa cuando la banda no lo muestra. */
  baseActual?: ReactNode;
};

/**
 * El estado de la pestaña con los nombres del prototipo ("Codificada", "En curso", "Por iniciar"), del avance
 * de cada pregunta incluida leído de sus respuestas (`avanceDeCodificacion`). Una pregunta sin avance leído
 * todavía usa el estado del motor.
 */
export function estadoDeCodificar(
  marcadas: readonly PreguntaAbierta[],
  avances: Readonly<Record<string, { avance: AvanceDeCodificacion } | undefined>> = {},
): EstadoDePestana | null {
  if (marcadas.length === 0) return null;
  const estados = marcadas.map((p) => {
    const a = avances[p.parent]?.avance;
    if (a) return estadoDeAvance(a);
    return p.status === "completo" ? "codificada" : p.status === "en-curso" ? "en-curso" : "por-iniciar";
  });
  if (estados.every((e) => e === "codificada")) return { tono: "listo", texto: "Codificada" };
  if (estados.some((e) => e !== "por-iniciar")) return { tono: "parcial", texto: "En curso" };
  return { tono: "neutro", texto: "Por iniciar" };
}

/** Rótulo de la pregunta con su énfasis markdown del formulario (`*…*`) intacto. */
function questionLabel(p: PreguntaAbierta): string {
  const label = sinMarcadores((p.parent_label ?? "").trim());
  if (label && label !== p.parent) return label;
  return p.parent;
}

export function CodificarWizard({ onBackToOrganizar, baseActual }: Props) {
  const [data, setData] = useState<PreguntaAbierta[] | null>(null);
  // Dónde estaba la lista de preguntas: sobrevive a que la mesa se vuelva a montar con otra pregunta.
  const posicionLista = useRef(0);
  const [error, setError] = useState<string>("");
  const location = useLocation();
  const navigate = useNavigate();
  // La pregunta elegida es el `foco` de la dirección: la vista se puede enlazar
  // y el QA la abre con `?foco=<pregunta>`. Sin foco (o con uno que no está
  // marcado) se muestra la primera, sin escribir nada en la URL.
  const foco = useDireccion()?.foco ?? null;
  const setActiveParent = useCallback(
    (parent: string) =>
      navigate(
        { pathname: location.pathname, search: conNivel(location.search, "foco", parent) },
        { replace: true },
      ),
    [location.pathname, location.search, navigate],
  );

  const cargar = useCallback(async () => {
    try {
      const r = await apiCodifPreguntasAbiertas();
      setData(r.preguntas);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  // TXT-10/16: incluir la pregunta del foco cuando no está en "Preguntas para codificar". Es la misma acción del
  // interruptor de Preparar y sólo corre con el clic del analista.
  const [inclusion, setInclusion] = useState<{ incluyendo: boolean; error: string }>({ incluyendo: false, error: "" });
  const incluirFoco = useCallback(async (parent: string) => {
    setInclusion({ incluyendo: true, error: "" });
    try {
      await apiCodifMarcar(parent, true);
      await cargar();
      // El foco puede haber venido por la columna de texto: la dirección queda en la pregunta.
      setActiveParent(parent);
      setInclusion({ incluyendo: false, error: "" });
    } catch (e) {
      setInclusion({ incluyendo: false, error: `No se pudo incluir "${parent}" en codificación: ${(e as Error).message}` });
    }
  }, [cargar, setActiveParent]);

  const marcadas = useMemo(() => {
    if (!data) return [];
    return data
      .filter((p) => p.marcada)
      .sort((a, b) => (a.q_order ?? 999999) - (b.q_order ?? 999999));
  }, [data]);

  const resolucion = resolverFocoCodificar(data ?? [], marcadas, foco);
  const activeParent = resolucion.tipo === "activa" ? resolucion.parent : null;
  const aviso = resolucion.tipo === "sin-incluir" || resolucion.tipo === "no-existe"
    ? (
      <FocoSinIncluirAviso
        resolucion={resolucion}
        incluyendo={inclusion.incluyendo}
        error={inclusion.error}
        onIncluir={() => { if (resolucion.tipo === "sin-incluir") void incluirFoco(resolucion.pregunta.parent); }}
        onVolver={onBackToOrganizar}
      />
    )
    : null;

  const activeIdx = activeParent ? marcadas.findIndex((p) => p.parent === activeParent) : -1;
  const activePregunta = activeIdx >= 0 ? marcadas[activeIdx] : null;

  function gotoPrev() {
    if (activeIdx > 0) setActiveParent(marcadas[activeIdx - 1].parent);
  }
  function gotoNext() {
    if (activeIdx >= 0 && activeIdx < marcadas.length - 1) setActiveParent(marcadas[activeIdx + 1].parent);
  }

  // El avance de cada pregunta, el mismo que ven Preguntas y Aplicar (avanceStore.ts).
  useCargarAvances(data);
  const avances = useAvances((s) => s.porPregunta);
  const codificadas = marcadas.filter((p) => {
    const a = avances[p.parent]?.avance;
    return a ? estadoDeAvance(a) === "codificada" : p.status === "completo";
  }).length;
  const cifraPreguntas: CifraDePestana = {
    clave: "preguntas",
    valor: formatoConteo(codificadas),
    base: formatoConteo(marcadas.length),
    rotulo: "preguntas codificadas",
    titulo: "Preguntas marcadas para codificar con todas sus respuestas con código",
    rango: 1,
  };

  /** La cabecera y la mesa de tres columnas; la pregunta en curso pone sus cifras y sus dos columnas. */
  const marco: MarcoDeCodificar = ({ cifras = [], acciones, pendientes, columnas }: PartesDeMesa) => (
    <MesaDePestana
      grupo="codificacion/codificar"
      columnas={3}
      cabecera={(
        <CabeceraDeCodificacion
          pestana="codificar"
          estado={estadoDeCodificar(marcadas, avances)}
          cifras={marcadas.length ? [cifraPreguntas, ...cifras] : cifras}
          pendientes={pendientes}
          acciones={acciones || baseActual ? <>{acciones}{baseActual}</> : undefined}
        />
      )}
    >
      <PanelDeMesa zona="preguntas" titulo="Preguntas" icono={<List size={15} />} conteo={marcadas.length} etiquetaCuerpo="Preguntas para codificar">
        {data && marcadas.length === 0 ? (
          <EstadoVacio
            tamano="normal"
            className="pulso-cc-vacio-lista"
            icono={<List size={18} />}
            titulo="Sin preguntas marcadas"
            descripcion="Aquí aparecen las que marques en Preguntas."
          />
        ) : data ? (
          <ListaDePreguntas preguntas={marcadas} activa={activeParent} etiquetaDe={questionLabel} onElegir={setActiveParent} avanceDe={(q) => {
            const a = avances[q.parent]?.avance;
            return a && a.casos > 0 ? { porcentaje: porcentajeDeAvance(a), codificadas: a.casosConCodigo, total: a.casos } : null;
          }} posicion={posicionLista} />
        ) : null}
      </PanelDeMesa>
      {columnas}
    </MesaDePestana>
  );

  if (error) {
    return marco({
      columnas: (
        <Panel noPadding className="pulso-cc-ancho">
          <ErrorBlock
            label="No se pudieron cargar las preguntas para codificar"
            detail={error}
            queda="Los códigos guardados siguen como estaban"
            acciones={
              <PulsoButton variant="secondary" size="sm" onClick={() => { setError(""); void cargar(); }}>
                Reintentar
              </PulsoButton>
            }
          />
        </Panel>
      ),
    });
  }
  if (!data) {
    return marco({ columnas: <Panel noPadding className="pulso-cc-ancho"><LoadingBlock label="Cargando las preguntas para codificar" /></Panel> });
  }

  if (marcadas.length === 0) {
    if (aviso) return marco({ columnas: <div className="pulso-cc-ancho">{aviso}</div> });
    return marco({
      columnas: (
        <Panel noPadding className="pulso-cc-ancho" data-audit-ready="codificacion-codificar">
          <EstadoVacio
            tamano="normal"
            icono={<ClipboardList size={18} />}
            titulo="No hay preguntas marcadas para codificar"
            descripcion='Márcalas en Preguntas, o empareja las de opción con su "Otros, especifique".'
            accion={
              <PulsoButton variant="secondary" size="sm" onClick={onBackToOrganizar}>
                <ArrowLeft size={13} aria-hidden="true" /> Volver a Preguntas
              </PulsoButton>
            }
          />
        </Panel>
      ),
    });
  }

  if (aviso) return marco({ columnas: <div className="pulso-cc-ancho">{aviso}</div> });
  if (!activePregunta) {
    return marco({
      columnas: (
        <Panel noPadding className="pulso-cc-ancho">
          <EstadoVacio
            tamano="normal"
            icono={<ClipboardList size={18} />}
            titulo="Sin pregunta elegida"
            descripcion="Elige una pregunta de la lista para codificarla."
          />
        </Panel>
      ),
    });
  }
  return (
    <CodificadorPane
      p={activePregunta}
      marco={marco}
      onPrev={gotoPrev}
      onNext={gotoNext}
      prevLabel={activeIdx > 0 ? sinEnfasis(questionLabel(marcadas[activeIdx - 1])) : ""}
      nextLabel={activeIdx < marcadas.length - 1 ? sinEnfasis(questionLabel(marcadas[activeIdx + 1])) : ""}
    />
  );
}

/** El tipo de la columna que se codifica: el texto de un "Otro" o de una abierta, una numérica o las categorías de una única. */
function tipoDeOrigen(arq: ReturnType<typeof arquetipoOf>): TipoDePregunta {
  if (arq === "auto") return "numerica";
  if (arq === "config-so") return "unica";
  return "texto";
}

function CodificadorPane({ p, marco, onPrev, onNext, prevLabel, nextLabel }: {
  p: PreguntaAbierta;
  marco: MarcoDeCodificar;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  const arq = arquetipoOf(p);
  const conModo = arq === "pareja-so" || arq === "config-so";
  const { modo, elegir } = useModoDeLaPregunta();

  // La pregunta sobre la lista: su columna, el tipo que sale (de sus códigos) y, en una de opción única,
  // si se codifican sus respuestas o se agrupan sus categorías.
  const cabeceraDePregunta = (grupos: readonly Grupo[]) => (
    <div className="pulso-cc-pregunta-zona">
      <CabeceraDePregunta
        codigo={p.col_efectiva || p.parent}
        tipoOrigen={tipoDeOrigen(arq)}
        resultante={tipoResultanteActivo(p, arq, grupos)}
        etiqueta={questionLabel(p)}
        seccion={textoPlano(p.section_label) || undefined}
        anterior={prevLabel}
        siguiente={nextLabel}
        onAnterior={onPrev}
        onSiguiente={onNext}
      />
      {conModo ? <ModoDeLaPregunta modo={modo} onElegir={elegir} /> : null}
    </div>
  );

  // Todos los arquetipos que codifican valores discretos o texto abierto usan el mismo
  // RespuestasCodificador (agrupar respuestas en códigos). Una múltiple emparejada con su texto se
  // codifica igual que un "Otro" de única; la numérica y agrupar categorías tienen su propia mesa, que
  // ocupa las dos columnas.
  const codificableInline =
    arq === "solitaria" ||
    arq === "adoptada" ||
    arq === "huerfana" ||
    arq === "auto" ||
    arq === "pareja-so" ||
    arq === "pareja-sm" ||
    arq === "config-so";

  const ancha = (contenido: ReactNode, conReadiness = false) =>
    marco({
      columnas: conReadiness ? (
        // Sin mesa propia, la vista termina aquí y publica su marca.
        <Panel noPadding className="pulso-cc-ancho" data-audit-ready="codificacion-codificar">
          {cabeceraDePregunta([])}
          <div className="pulso-cc-otra-mesa">{contenido}</div>
        </Panel>
      ) : (
        <Panel noPadding className="pulso-cc-ancho">
          {cabeceraDePregunta([])}
          <div className="pulso-cc-otra-mesa">{contenido}</div>
        </Panel>
      ),
    });

  if (!codificableInline) {
    return ancha(
      <p className="pulso-cc-sin-mesa">
        Esta pregunta tiene <strong>{formatoConteo(p.n_respuestas)}</strong> respuestas
        ({<strong>{formatoConteo(p.n_unicas)}</strong>} únicas) en la columna <code>{p.col_efectiva}</code>.
        {arq === "no-aplica" ? " Esta pregunta está desactivada." : null}
      </p>,
      true,
    );
  }
  if (arq === "auto") return ancha(<IntegerCodificador key={p.parent} parent={p.parent} />);
  if (conModo && modo === "agrupar") return ancha(<AgruparCategoriasCodificador key={p.parent} parent={p.parent} />);
  return <RespuestasCodificador key={p.parent} parent={p.parent} marco={marco} cabeceraDePregunta={cabeceraDePregunta} />;
}
