// Contenido de «Agregar campaña complementaria» (ADR 0101).
//
// El analista elige la encuesta, ve cuántas preguntas calzan con el
// instrumento y confirma la declaración entera con un clic. Lo usan dos
// puertas: el diálogo de la tarjeta (`CampanaComplementariaDialog`) y el aviso
// de la importación (`ImportSurveyMonkeyDialog`), que ya trae la encuesta
// elegida y por eso oculta el selector.
//
// Renderiza dos hermanos —cuerpo y pie— para que el contenedor decida quién es
// el dueño del scroll (C4): en el diálogo el cuerpo se desplaza y el pie queda
// fijo; dentro de la importación todo cae en el scroll del diálogo padre.

import { useEffect, useRef, useState } from "react";
import { Search } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import { splitErrorDetail } from "../../../components/errorPresentation";
import { apiXlsformEditorSmListSurveys, type SurveyMonkeyListItem } from "../../../api/multiIntegrado";
import {
  apiCampanaDeclarar,
  apiCampanaVistaPrevia,
  type CampanaDeclararResultado,
  type CampanaVistaPrevia,
} from "../../../api/xlsformCampanas";
import { leerVistaPrevia, motivoNoElegible } from "./campanaComplementariaModel";
import { CampanaVistaPreviaResumen } from "./CampanaVistaPreviaResumen";
import { leerIdEncuesta, smSurveyMatchesQuery, smSurveyTitle } from "./surveyMonkeySurveySearch";
import "../styles/xf-campana.css";

/** Encuestas del catálogo a la vista; el resto se alcanza afinando la búsqueda. */
const MAX_ENCUESTAS_VISIBLES = 8;

type EstadoCatalogo =
  | { estado: "sin_pedir" }
  | { estado: "cargando" }
  | { estado: "listo"; encuestas: SurveyMonkeyListItem[] }
  | { estado: "error"; mensaje: string };

type EstadoVista =
  | { estado: "vacia" }
  | { estado: "cargando"; surveyId: string }
  | { estado: "lista"; vista: CampanaVistaPrevia }
  | { estado: "error"; mensaje: string };

type EstadoDeclarar = { enCurso: boolean; error: string };

function mensajeDeError(e: unknown): string {
  const crudo = e instanceof Error ? e.message : String(e);
  return splitErrorDetail(crudo).message || "No se pudo completar la operación.";
}

export type CampanaComplementariaPanelProps = {
  formId: string;
  formName: string;
  encuestaPrincipal: string | null;
  campanasDeclaradas: readonly string[];
  /** Encuesta ya elegida (puerta de la importación): se compara al montar. */
  surveyIdInicial?: string;
  /** `false` oculta el selector: la encuesta viene dada. */
  elegirEncuesta: boolean;
  cancelarLabel?: string;
  onCancelar: () => void;
  onDeclarada: (resultado: CampanaDeclararResultado) => void;
};

export function CampanaComplementariaPanel({
  formId,
  formName,
  encuestaPrincipal,
  campanasDeclaradas,
  surveyIdInicial,
  elegirEncuesta,
  cancelarLabel = "Cancelar",
  onCancelar,
  onDeclarada,
}: CampanaComplementariaPanelProps) {
  const [entrada, setEntrada] = useState(surveyIdInicial ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [catalogo, setCatalogo] = useState<EstadoCatalogo>({ estado: "sin_pedir" });
  const [vista, setVista] = useState<EstadoVista>(
    surveyIdInicial ? { estado: "cargando", surveyId: surveyIdInicial } : { estado: "vacia" },
  );
  const [declarar, setDeclarar] = useState<EstadoDeclarar>({ enCurso: false, error: "" });
  // Encuesta ya elegida: el selector se pliega a un resumen con «Cambiar» para
  // que la coincidencia quede justo debajo, sin desplazarse.
  const [elegida, setElegida] = useState<string | null>(null);
  // Sólo la última comparación pedida puede pintar: elegir otra encuesta
  // mientras la anterior responde no debe dejar la vista de la vieja.
  const pedidoRef = useRef(0);
  // El control que se pulsó desaparece al plegar o desplegar el selector: el
  // foco pasa al control que lo reemplaza para no perderse en el documento.
  const cambiarRef = useRef<HTMLButtonElement | null>(null);
  const entradaRef = useRef<HTMLInputElement | null>(null);

  async function comparar(surveyId: string) {
    const pedido = ++pedidoRef.current;
    setDeclarar({ enCurso: false, error: "" });
    const noElegible = motivoNoElegible(surveyId, encuestaPrincipal, campanasDeclaradas);
    if (noElegible) {
      setVista({ estado: "error", mensaje: `${noElegible} de «${formName}».` });
      return;
    }
    setElegida(surveyId);
    setVista({ estado: "cargando", surveyId });
    try {
      const resultado = await apiCampanaVistaPrevia(formId, surveyId);
      if (pedido === pedidoRef.current) setVista({ estado: "lista", vista: resultado });
    } catch (e) {
      if (pedido === pedidoRef.current) setVista({ estado: "error", mensaje: mensajeDeError(e) });
    }
  }

  useEffect(() => {
    if (surveyIdInicial) void comparar(surveyIdInicial);
    // Sólo al montar: la puerta de la importación ya trae la encuesta.
  }, []);

  function compararEntrada() {
    const leido = leerIdEncuesta(entrada);
    if (!leido.ok) {
      setVista({
        estado: "error",
        mensaje: leido.motivo === "vacio"
          ? "Escribe el ID de SurveyMonkey de la encuesta o elige una de tu lista."
          : "Ese enlace no trae el ID de la encuesta. Abre la encuesta en SurveyMonkey y copia el enlace desde allí.",
      });
      return;
    }
    setEntrada(leido.id);
    void comparar(leido.id);
    requestAnimationFrame(() => cambiarRef.current?.focus());
  }

  async function buscarEncuestas() {
    setCatalogo({ estado: "cargando" });
    try {
      const resultado = await apiXlsformEditorSmListSurveys(500, 6);
      setCatalogo({ estado: "listo", encuestas: resultado.surveys });
    } catch (e) {
      setCatalogo({ estado: "error", mensaje: mensajeDeError(e) });
    }
  }

  async function confirmar() {
    if (vista.estado !== "lista") return;
    setDeclarar({ enCurso: true, error: "" });
    try {
      const resultado = await apiCampanaDeclarar(formId, vista.vista.survey_id);
      onDeclarada(resultado);
    } catch (e) {
      setDeclarar({ enCurso: false, error: mensajeDeError(e) });
    }
  }

  const lectura = vista.estado === "lista" ? leerVistaPrevia(vista.vista) : null;
  const encuestaElegida = elegida && catalogo.estado === "listo"
    ? catalogo.encuestas.find((item) => item.id === elegida)
    : undefined;
  const tituloElegida = encuestaElegida
    ? smSurveyTitle(encuestaElegida)
    : vista.estado === "lista" && vista.vista.survey_id === elegida ? vista.vista.titulo : "";
  const coincidentes = catalogo.estado === "listo"
    ? catalogo.encuestas.filter((item) => smSurveyMatchesQuery(item, busqueda))
    : [];
  const visibles = coincidentes.slice(0, MAX_ENCUESTAS_VISIBLES);
  const ocultas = coincidentes.length - visibles.length;

  return (
    <>
      <div
        className="pulso-xf-campana-cuerpo"
        data-qa-geometry-group="xlsform-campana-complementaria"
        data-qa-geometry-contract="intrinsic"
      >
        <p className="pulso-xf-campana-regla">
          Una campaña complementaria es otra encuesta de SurveyMonkey que aplica este mismo
          instrumento, por ejemplo un envío por correo. No crea un formulario nuevo: sus respuestas
          se leerán con las preguntas de «{formName}».
        </p>

        {elegirEncuesta ? (
          <section className="pulso-xf-campana-seccion" aria-labelledby="pulso-xf-campana-elegir" data-qa-geometry-member>
            <h3 id="pulso-xf-campana-elegir" className="pulso-xf-campana-subtitulo">Encuesta de la campaña</h3>
            {elegida ? (
              <div className="pulso-xf-campana-elegida">
                <span className="pulso-xf-campana-elegida-texto">
                  <strong>{tituloElegida || "Encuesta de SurveyMonkey"}</strong>
                  <small>ID {elegida}</small>
                </span>
                <PulsoButton
                  variant="secondary"
                  size="sm"
                  ref={cambiarRef}
                  onClick={() => {
                    setElegida(null);
                    requestAnimationFrame(() => entradaRef.current?.focus());
                  }}
                  aria-label="Cambiar la encuesta de la campaña"
                >
                  Cambiar
                </PulsoButton>
              </div>
            ) : (
              <>
                <div className="pulso-xf-campana-entrada">
                  <label className="pulso-xf-campana-campo">
                    <span>ID o enlace de SurveyMonkey</span>
                    <input
                      ref={entradaRef}
                      value={entrada}
                      placeholder="423593924"
                      onChange={(event) => setEntrada(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          compararEntrada();
                        }
                      }}
                    />
                  </label>
                  <PulsoButton variant="secondary" size="sm" onClick={compararEntrada} disabled={vista.estado === "cargando"}>
                    Comparar preguntas
                  </PulsoButton>
                  <PulsoButton
                    variant="ghost"
                    size="sm"
                    onClick={() => { void buscarEncuestas(); }}
                    disabled={catalogo.estado === "cargando"}
                  >
                    <Search size={14} aria-hidden="true" /> Buscar mis encuestas
                  </PulsoButton>
                </div>

                {catalogo.estado === "cargando" ? (
                  <p className="pulso-xf-campana-nota" role="status">Consultando tus encuestas en SurveyMonkey…</p>
                ) : null}
                {catalogo.estado === "error" ? (
                  <p className="pulso-xf-campana-error" role="alert">{catalogo.mensaje}</p>
                ) : null}
                {catalogo.estado === "listo" ? (
                  <div className="pulso-xf-campana-catalogo">
                    <label className="pulso-xf-campana-campo">
                      <span>Buscar por título o ID</span>
                      <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} />
                    </label>
                    {visibles.length === 0 ? (
                      <p className="pulso-xf-campana-nota">
                        {catalogo.encuestas.length === 0
                          ? "No encontramos encuestas modificadas en los últimos seis meses."
                          : "Ninguna encuesta coincide con la búsqueda."}
                      </p>
                    ) : (
                      <ul className="pulso-xf-campana-lista" aria-label="Tus encuestas de SurveyMonkey">
                        {visibles.map((item) => {
                          const motivo = motivoNoElegible(item.id, encuestaPrincipal, campanasDeclaradas);
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                className="pulso-xf-campana-encuesta"
                                disabled={Boolean(motivo)}
                                aria-pressed={vista.estado === "lista" && vista.vista.survey_id === item.id}
                                onClick={() => {
                                  setEntrada(item.id);
                                  void comparar(item.id);
                                  requestAnimationFrame(() => cambiarRef.current?.focus());
                                }}
                              >
                                <span className="pulso-xf-campana-encuesta-titulo">{smSurveyTitle(item)}</span>
                                <span className="pulso-xf-campana-encuesta-id">
                                  {motivo ? `${motivo} · ` : ""}ID {item.id}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {ocultas > 0 ? (
                      <p className="pulso-xf-campana-nota">
                        Hay {ocultas} {ocultas === 1 ? "encuesta más" : "encuestas más"}. Afina la búsqueda para verlas.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        <section
          className="pulso-xf-campana-seccion"
          aria-labelledby="pulso-xf-campana-vista"
          aria-live="polite"
          data-qa-geometry-member
        >
          <h3 id="pulso-xf-campana-vista" className="pulso-xf-campana-subtitulo">Coincidencia con el instrumento</h3>
          {vista.estado === "vacia" ? (
            <p className="pulso-xf-campana-nota">
              Elige una encuesta para ver cuántas de sus preguntas calzan con este formulario.
            </p>
          ) : null}
          {vista.estado === "cargando" ? (
            <p className="pulso-xf-campana-nota" role="status">
              Comparando las preguntas de la encuesta {vista.surveyId}…
            </p>
          ) : null}
          {vista.estado === "error" ? (
            <p className="pulso-xf-campana-error" role="alert">{vista.mensaje}</p>
          ) : null}
          {vista.estado === "lista" ? <CampanaVistaPreviaResumen vista={vista.vista} /> : null}
        </section>

        {declarar.error ? (
          <p className="pulso-xf-campana-error" role="alert">{declarar.error}</p>
        ) : null}
      </div>

      <footer className="pulso-xf-campana-pie">
        <PulsoButton variant="secondary" onClick={onCancelar} disabled={declarar.enCurso}>
          {cancelarLabel}
        </PulsoButton>
        <PulsoButton
          variant="primary"
          onClick={() => { void confirmar(); }}
          disabled={!lectura?.puedeDeclarar || declarar.enCurso}
        >
          {declarar.enCurso ? "Agregando…" : "Agregar campaña"}
        </PulsoButton>
      </footer>
    </>
  );
}
