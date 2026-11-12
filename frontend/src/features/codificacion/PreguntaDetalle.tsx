import { useEffect, useState } from "react";
import { rotuloSinMarcador, sinMarcadores } from "./sugerenciasModulo";
import { NavLink, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { apiCodifPreguntasAbiertas, arquetipoOf, PreguntaAbierta } from "../../api/client";
import { Panel } from "../../components/Panel";
import { PageFrame } from "../../components/PageFrame";
import { LoadingBlock, ErrorBlock } from "../../components/States";
import { RespuestasCodificador } from "./RespuestasCodificador";
import { marcoSencillo } from "./codificar/marcoSencillo";
import { IntegerCodificador } from "./IntegerCodificador";
import { AgruparCategoriasCodificador, ModoSelectOneTabs } from "./AgruparCategoriasCodificador";
import { textoPlano } from "../../lib/textoPlano";
import { sinEnfasis } from "../../lib/enfasisTexto";
import { TextoConEnfasis } from "../../lib/TextoConEnfasis";
import { formatoConteo } from "../../lib/formatoNumero";

const TIPO_STYLE: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  select_multiple: { bg: "var(--tipo-sm-bg)", fg: "var(--tipo-sm-fg)", border: "var(--tipo-sm-border)", label: "Múltiple" },
  select_one: { bg: "var(--tipo-so-bg)", fg: "var(--tipo-so-fg)", border: "var(--tipo-so-border)", label: "Opción única" },
  integer: { bg: "var(--tipo-int-bg)", fg: "var(--tipo-int-fg)", border: "var(--tipo-int-border)", label: "Numérica" },
  text: { bg: "var(--tipo-text-bg)", fg: "var(--tipo-text-fg)", border: "var(--tipo-text-border)", label: "Texto abierto" },
};

export default function PreguntaDetalle() {
  const { parent } = useParams<{ parent: string }>();
  const [pregunta, setPregunta] = useState<PreguntaAbierta | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!parent) return;
    (async () => {
      try {
        const r = await apiCodifPreguntasAbiertas();
        const found = r.preguntas.find((p) => p.parent === parent);
        if (!found) setError(`No se encontró la pregunta '${parent}'.`);
        else setPregunta(found);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [parent]);

  if (error) return <ErrorBlock label="No se pudo cargar la pregunta" detail={error} />;
  if (!pregunta) return <LoadingBlock label="Cargando la pregunta" />;

  const arq = arquetipoOf(pregunta);
  const ts = TIPO_STYLE[pregunta.tipo] ?? TIPO_STYLE.text;

  // Todos los arquetipos que codifican valores discretos o texto abierto
  // usan el mismo RespuestasCodificador. Quedan afuera SM (columnar) y
  // SO sin modo decidido.
  const codificableInline =
    arq === "solitaria" ||
    arq === "adoptada" ||
    arq === "huerfana" ||
    arq === "auto" || // integer
    (arq === "pareja-so" && (pregunta.modo_so === "hijo" || pregunta.modo_so === "padre"));

  return (
    // Sin PageFrame el `main` del shell no desplaza (es viewport) y un
    // codificador alto quedaba atrapado. El cuerpo del marco es el dueño del scroll.
    <PageFrame
      title={sinMarcadores(sinEnfasis(pregunta.parent_label)) || pregunta.parent}
      headerMode="sr-only"
      layout="document"
      scrollOwner="body"
      bodyMode="scroll"
      density="compact"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <NavLink
          to="/codificacion"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--pulso-type-body-size)", color: "var(--pulso-text-soft)", textDecoration: "none" }}
        >
          <ArrowLeft size={14} /> Volver al listado
        </NavLink>
      </div>

      {/* Header — mismo patrón que CodificarWizard > CodificadorPane. */}
      <header style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <span
          aria-hidden="true"
          title={ts.label}
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: ts.bg, color: ts.fg,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: "var(--pulso-type-caption-size)", fontWeight: 700,
            border: `1px solid ${ts.border ?? "transparent"}`,
          }}
        >
          {ts.label.slice(0, 2).toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "var(--pulso-type-title-size)", lineHeight: 1.3, fontWeight: 700 }}>
              <TextoConEnfasis texto={sinMarcadores(pregunta.parent_label)} />
            </h2>
            <code
              title={`ID del formulario: ${pregunta.parent}`}
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "var(--pulso-type-caption-size)", fontWeight: 600,
                color: ts.fg, background: ts.bg,
                padding: "2px 8px", borderRadius: 4,
              }}
            >
              {pregunta.parent}
            </code>
            <span
              style={{
                padding: "2px 8px", borderRadius: 999,
                background: ts.bg, color: ts.fg,
                fontSize: "var(--pulso-type-micro-size)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3,
              }}
            >
              {ts.label}
              {pregunta.modo_so === "hijo" && " (hijo)"}
              {pregunta.modo_so === "padre" && " (padre)"}
            </span>
          </div>
          {rotuloSinMarcador(textoPlano(pregunta.section_label)) && (
            <div style={{ fontSize: "var(--pulso-type-caption-size)", color: "var(--pulso-text-soft)", marginTop: 4 }}>
              {rotuloSinMarcador(textoPlano(pregunta.section_label))}
            </div>
          )}
        </div>
      </header>

      {codificableInline ? (
        <Panel
          eyebrow="Codificador"
          title={arq === "pareja-so" ? "Codifica respuestas o agrupa categorías" : "Agrupa respuestas y asigna códigos"}
          hint={arq === "pareja-so"
            ? `"Codificar respuestas" asigna códigos a los textos de la columna ${pregunta.col_efectiva}. "Agrupar categorías" junta categorías de ${pregunta.parent} en una variable nueva.`
            : `Marca las respuestas que pertenecen a un mismo concepto, agrúpalas y asígnales un código + etiqueta. Las respuestas con texto idéntico (tras normalizar acentos y mayúsculas) ya están agrupadas automáticamente. La columna que leemos es ${pregunta.col_efectiva}.`}
        >
          {arq === "auto"
            ? <IntegerCodificador parent={pregunta.parent} />
            : arq === "pareja-so"
              ? (
                <ModoSelectOneTabs
                  parent={pregunta.parent}
                  codificarRespuestas={<RespuestasCodificador parent={pregunta.parent} marco={marcoSencillo} cabeceraDePregunta={() => null} />}
                />
              )
              : <RespuestasCodificador parent={pregunta.parent} marco={marcoSencillo} cabeceraDePregunta={() => null} />}
        </Panel>
      ) : arq === "config-so" || arq === "pareja-so" ? (
        // Una select_one sin modo decidido igual puede agrupar sus categorías (ítem 1f).
        <Panel eyebrow="Agrupar categorías" title="Junta categorías en una variable nueva">
          <AgruparCategoriasCodificador parent={pregunta.parent} />
        </Panel>
      ) : (
        // Esta ruta vieja no codifica esta clase de pregunta: lo dice y lleva a la pestaña que sí lo hace.
        <Panel title={arq === "no-aplica" ? "Pregunta desactivada" : "Esta pregunta se codifica en Codificar"}>
          <p className="pulso-cc-sin-mesa">
            {arq === "no-aplica"
              ? "No entra a codificación. Se incluye desde la pestaña Preguntas."
              : `Tiene ${formatoConteo(pregunta.n_respuestas)} respuestas en la columna ${pregunta.col_efectiva}.`}
          </p>
          {arq === "no-aplica" ? null : (
            <NavLink className="pulso-button pulso-button--primary pulso-button--sm" to={`/codificacion?pestana=codificar&foco=${encodeURIComponent(pregunta.parent)}`}>
              Abrir en Codificar
            </NavLink>
          )}
        </Panel>
      )}
    </PageFrame>
  );
}
