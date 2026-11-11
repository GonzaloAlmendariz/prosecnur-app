import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "../../vendor/lucide-react";
import { apiCodifPreguntasAbiertas, arquetipoOf, PreguntaAbierta } from "../../api/client";
import { LoadingBlock, ErrorBlock } from "../../components/States";
import { RespuestasCodificador } from "./RespuestasCodificador";
import { IntegerCodificador } from "./IntegerCodificador";
import { ModoSelectOneTabs } from "./AgruparCategoriasCodificador";
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
import { CabeceraDePregunta } from "./codificar/CabeceraDePregunta";
import { ListaDePreguntas } from "./codificar/ListaDePreguntas";
import { tipoDeFicha } from "./preguntas/modeloUnidades";
import "./codificar/codificar.css";
import "./codificar/lista.css";
import "./codificar/codigos.css";
import "./codificar/ventanas.css";

type Props = {
  onBackToOrganizar: () => void;
};

const TIPOS: Record<string, string> = {
  select_multiple: "Múltiple",
  select_one: "Opción única",
  integer: "Numérica",
  text: "Texto abierto",
};

/** Rótulo de la pregunta con su énfasis markdown del formulario (`*…*`) intacto. */
function questionLabel(p: PreguntaAbierta): string {
  const label = (p.parent_label ?? "").trim();
  if (label && label !== p.parent) return label;
  return p.parent;
}

export function CodificarWizard({ onBackToOrganizar }: Props) {
  const [data, setData] = useState<PreguntaAbierta[] | null>(null);
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

  if (error) {
    return (
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
    );
  }
  if (!data) return <LoadingBlock label="Cargando las preguntas para codificar" />;

  if (marcadas.length === 0) {
    if (aviso) return aviso;
    return (
      <>
        <span data-audit-ready="codificacion-codificar" hidden />
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
      </>
    );
  }

  return (
    <div className="pulso-cc-wizard">
      <ListaDePreguntas
        preguntas={marcadas}
        activa={activeParent}
        etiquetaDe={questionLabel}
        onElegir={setActiveParent}
        onVolver={onBackToOrganizar}
      />

      <main className="pulso-cc-principal">
        {aviso ?? (activePregunta ? (
          <CodificadorPane
            p={activePregunta}
            onPrev={gotoPrev}
            onNext={gotoNext}
            prevLabel={activeIdx > 0 ? sinEnfasis(questionLabel(marcadas[activeIdx - 1])) : ""}
            nextLabel={activeIdx < marcadas.length - 1 ? sinEnfasis(questionLabel(marcadas[activeIdx + 1])) : ""}
          />
        ) : (
          <EstadoVacio
            tamano="normal"
            icono={<ClipboardList size={18} />}
            titulo="Selecciona una pregunta"
            descripcion="Elige una pregunta del listado de la izquierda para empezar a codificar."
          />
        ))}
      </main>
    </div>
  );
}

/** Cómo se codifica la pregunta, con las palabras de la pestaña Preguntas. */
function rotuloDeTipo(p: PreguntaAbierta, arq: ReturnType<typeof arquetipoOf>): string {
  if (arq === "pareja-sm") return "Recodificación múltiple";
  const base = TIPOS[p.tipo] ?? TIPOS.text;
  if (p.modo_so === "hijo") return `${base}, texto aparte`;
  if (p.modo_so === "padre") return `${base}, pregunta original`;
  return base;
}

function CodificadorPane({ p, onPrev, onNext, prevLabel, nextLabel }: {
  p: PreguntaAbierta;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  const arq = arquetipoOf(p);

  // Todos los arquetipos que codifican valores discretos o texto abierto
  // usan el mismo RespuestasCodificador (agrupar respuestas \u2192 c\u00f3digo).
  // SM emparejada con text_col se codifica igual que SO-hijo (los textos
  // libres de quienes marcaron "Otros"); el bridge xlsx final genera las
  // nuevas columnas dummy. SO sin modo se trata como codificar valores
  // originales (modo padre impl\u00edcito) cuando el analista la marc\u00f3.
  const codificableInline =
    arq === "solitaria" ||
    arq === "adoptada" ||
    arq === "huerfana" ||
    arq === "auto" || // integer
    arq === "pareja-so" ||
    arq === "pareja-sm" || // SM con text_col
    arq === "config-so";

  return (
    <section className="pulso-cc-pane">
      <CabeceraDePregunta
        codigo={p.parent}
        tipo={arq === "pareja-sm" ? "multiple" : tipoDeFicha(p.tipo)}
        rotuloDeTipo={rotuloDeTipo(p, arq)}
        etiqueta={questionLabel(p)}
        seccion={textoPlano(p.section_label) || undefined}
        anterior={prevLabel}
        siguiente={nextLabel}
        onAnterior={onPrev}
        onSiguiente={onNext}
      />

      {codificableInline ? (
        arq === "auto"
          // Las mesas de numéricas y de agrupar categorías conservan su marco de una sola tarjeta.
          ? <Panel className="pulso-cc-otra-mesa"><IntegerCodificador key={p.parent} parent={p.parent} /></Panel>
          : arq === "pareja-so" || arq === "config-so"
            // Una select_one ofrece además agrupar sus categorías (ítem 1f).
            ? (
              <ModoSelectOneTabs
                key={p.parent}
                parent={p.parent}
                codificarRespuestas={<RespuestasCodificador parent={p.parent} />}
              />
            )
            : <RespuestasCodificador key={p.parent} parent={p.parent} />
      ) : (
        <Panel className="pulso-cc-otra-mesa" data-audit-ready="codificacion-codificar">
          <p className="pulso-cc-sin-mesa">
            Esta pregunta tiene <strong>{formatoConteo(p.n_respuestas)}</strong> respuestas
            ({<strong>{formatoConteo(p.n_unicas)}</strong>} únicas) en la columna <code>{p.col_efectiva}</code>.
            {arq === "no-aplica" ? " Esta pregunta está desactivada." : null}
          </p>
        </Panel>
      )}
    </section>
  );
}
