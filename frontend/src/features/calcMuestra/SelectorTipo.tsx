/**
 * Selector «Elige el tipo de muestra».
 *
 * Salió de `CalcMuestraPage.tsx` (congelada a crecimiento). Tiene dos niveles:
 * «Muestra general» —sirve para cualquier estudio— y, aparte, las plantillas
 * especializadas, que son flujos preconfigurados para casos recurrentes. Las
 * plantillas se rotulan por el método estadístico que resuelven, no por el
 * estudio o el cliente que las originó.
 */
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  FileText,
  Grid3X3,
  Home,
  MapPinned,
  Route,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import type { ActiveDesk } from "./sharedCore";
import { VistaPreviaTipo } from "./VistaPreviaTipo";

type Orientacion = {
  prompt: string;
  answer: string;
  detail: string;
  icon?: typeof Users;
};

type TarjetaTipo = {
  id: ActiveDesk;
  title: string;
  eyebrow: string;
  copy: string;
  action: string;
  details: string[];
  guidance: Orientacion[];
  icon: typeof Users;
};

/** El tipo que sirve para cualquier estudio: el punto de partida por defecto. */
const TIPO_GENERAL: TarjetaTipo = {
  id: "marco_disponible",
  title: "Muestra general",
  eyebrow: "Para cualquier estudio",
  copy: "Para cualquier población con marco muestral (el listado o conteo de las unidades que pueden ser elegidas): personas, hogares, instituciones, servicios o atenciones. Eliges el diseño y obtienes el tamaño de muestra y su reparto por grupo.",
  action: "Empezar con muestra general",
  details: ["Marco muestral", "Estratos", "Conglomerados", "Cuotas"],
  guidance: [
    { prompt: "¿A quién se mide?", answer: "Tu población objetivo", detail: "Personas, hogares, instituciones, servicios o atenciones.", icon: Users },
    { prompt: "¿Cómo se organiza?", answer: "Marco total, estratos o cuotas", detail: "Parte del listado o de los conteos que ya tienes.", icon: SlidersHorizontal },
    { prompt: "¿Qué se entrega?", answer: "Tamaño y reparto de la muestra", detail: "Resultados listos para el informe y la selección.", icon: FileText },
  ],
  icon: SlidersHorizontal,
};

/** Flujos preconfigurados para casos recurrentes; comparten el motor de cálculo. */
const PLANTILLAS: TarjetaTipo[] = [
  {
    id: "opinion_universitaria",
    title: "Conglomerados en aulas",
    eyebrow: "Plantilla · instituciones educativas",
    copy: "Para estudios donde se encuesta a grupos completos (cursos-horario, secciones) de una institución educativa, a partir de la matrícula por facultad y sexo.",
    action: "Empezar con esta plantilla",
    details: ["Matrícula", "Cuotas por facultad", "Aulas", "Seguimiento"],
    guidance: [
      { prompt: "¿A quién representa?", answer: "Estudiantes matriculados", detail: "La base se ordena por facultad, sexo y aulas disponibles.", icon: Users },
      { prompt: "¿Qué se calcula?", answer: "Tamaño y cuotas por grupo", detail: "Define metas por institución y facultad antes de elegir las aulas.", icon: SlidersHorizontal },
      { prompt: "¿Qué queda listo?", answer: "Aulas titulares y de reemplazo", detail: "El plan queda registrado para el seguimiento en campo.", icon: FileText },
    ],
    icon: Grid3X3,
  },
  {
    id: "acreditacion",
    title: "Metas por grupo de informantes",
    eyebrow: "Plantilla · cuotas por grupo",
    copy: "Para procesos que piden un mínimo de respuestas por grupo (estudiantes, docentes, egresados, empleadores), programa o canal, como las acreditaciones institucionales.",
    action: "Empezar con esta plantilla",
    details: ["Grupos", "Programas", "Canales de contacto", "Diferencia con la meta"],
    guidance: [
      { prompt: "¿Quiénes deben responder?", answer: "Cada grupo de informantes", detail: "Evita dejar fuera a grupos relevantes.", icon: Users },
      { prompt: "¿Cómo se define la meta?", answer: "Mínimo por grupo y canal", detail: "Fija las respuestas esperadas por grupo, programa y canal.", icon: SlidersHorizontal },
      { prompt: "¿Qué sustenta?", answer: "Cobertura por grupo", detail: "Muestra cuánto falta para llegar a cada meta y con qué criterio.", icon: FileText },
    ],
    icon: ClipboardList,
  },
  {
    id: "territorial_handoff",
    title: "Muestreo de áreas y viviendas",
    eyebrow: "Plantilla · Hojas de ruta",
    copy: "Para estudios donde el diseño depende de zonas, manzanas y viviendas, con viviendas de reserva y recorrido de campo.",
    action: "Ir a Hojas de ruta",
    details: ["Zonas", "Manzanas", "Viviendas", "Reserva"],
    guidance: [
      { prompt: "¿Dónde se trabaja?", answer: "Zonas y viviendas", detail: "Convierte el territorio en visitas concretas para campo.", icon: Home },
      { prompt: "¿Cómo se recorre?", answer: "Rutas y viviendas de reserva", detail: "Controla manzanas, viviendas elegidas y sustitutos.", icon: Route },
      { prompt: "¿Qué se verifica?", answer: "Cobertura del territorio", detail: "Deja evidencia cartográfica y de dispersión.", icon: FileText },
    ],
    icon: MapPinned,
  },
];

/** Todos los tipos, con «Muestra general» primero. */
export const TIPOS_DE_ESTUDIO: TarjetaTipo[] = [TIPO_GENERAL, ...PLANTILLAS];

const PREGUNTAS_INICIALES: Orientacion[] = [
  {
    prompt: "¿Qué población quieres medir?",
    answer: "Una con marco muestral",
    detail: "El marco es el listado o conteo de las unidades que pueden ser elegidas.",
    icon: Users,
  },
  {
    prompt: "¿Cómo se elige la muestra?",
    answer: "Un diseño por proyecto",
    detail: "Aleatorio simple, estratificado, por conglomerados, sistemático o por cuotas. Cambiar de tipo reinicia el cálculo.",
    icon: SlidersHorizontal,
  },
  {
    prompt: "¿Qué obtienes?",
    answer: "Tamaño y reparto de la muestra",
    detail: "Número de casos, distribución por grupo y plan de selección.",
    icon: FileText,
  },
];

function PreguntasIniciales() {
  return (
    <div className="cmv2-pathway-primer" aria-label="Preguntas para escoger el tipo de muestra" data-qa-geometry-group="calc-muestra/caminos-preguntas" data-qa-geometry-contract="equal">
      {PREGUNTAS_INICIALES.map((item) => {
        const Icon = item.icon ?? CircleHelp;
        return (
          <article key={item.prompt} data-qa-geometry-member>
            <span><Icon size={14} /></span>
            <div>
              <small>{item.prompt}</small>
              <strong>{item.answer}</strong>
              <p>{item.detail}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function SelectorTipo({
  currentDesk,
  hasExistingStudy,
  pendingReset,
  onSelect,
  onCancelReset,
  onConfirmReset,
  perdidas = [],
}: {
  currentDesk: ActiveDesk;
  hasExistingStudy: boolean;
  pendingReset: ActiveDesk | null;
  onSelect: (mode: ActiveDesk) => void;
  onCancelReset: () => void;
  onConfirmReset: () => void;
  /** Lo que el estudio actual perdería al cambiar de tipo (modeloVistaPreviaTipo). */
  perdidas?: readonly string[];
}) {
  const currentCard = TIPOS_DE_ESTUDIO.find((card) => card.id === currentDesk);
  const pendingCard = TIPOS_DE_ESTUDIO.find((card) => card.id === pendingReset);
  const currentTitle = currentCard?.title ?? (currentDesk === "legacy" ? "sesión anterior" : "el cálculo actual");

  function renderCard(card: TarjetaTipo, principal: boolean) {
    const Icon = card.icon;
    const isCurrent = hasExistingStudy && card.id === currentDesk;
    const actionLabel = isCurrent
      ? "Seguir trabajando"
      : hasExistingStudy
        ? "Ver qué trae este tipo"
        : card.action;
    return (
      <button
        key={card.id}
        type="button"
        className={`cmv2-frame-card cmv2-frame-card--${card.id} ${card.id === "territorial_handoff" ? "is-handoff" : ""} ${principal ? "is-principal" : ""} ${isCurrent ? "is-current" : ""} ${card.id === pendingReset ? "is-previewing" : ""}`}
        onClick={() => onSelect(card.id)}
        aria-pressed={isCurrent} data-qa-geometry-member
      >
        <span className="cmv2-card-icon"><Icon size={20} /></span>
        <small>{isCurrent ? "Tipo actual" : card.eyebrow}</small>
        <strong>{card.title}</strong>
        <p>{card.copy}</p>
        <div className="cmv2-path-tags" aria-label={`Alcance ${card.title}`}>
          {card.details.map((detail) => <span key={detail}>{detail}</span>)}
        </div>
        <div className="cmv2-card-answers" aria-label={`Orientación para ${card.title}`} data-qa-geometry-group="calc-muestra/caminos-orientacion" data-qa-geometry-contract="intrinsic">
          {card.guidance.map((item) => {
            const HelpIcon = item.icon ?? CircleHelp;
            return (
              <em key={item.prompt} data-qa-geometry-member>
                <i><HelpIcon size={12} /></i>
                <b>{item.prompt}</b>
                <span>{item.answer}</span>
                <small>{item.detail}</small>
              </em>
            );
          })}
        </div>
        <span className="cmv2-card-action">
          {actionLabel}
          <ArrowRight size={14} />
        </span>
      </button>
    );
  }

  return (
    <section className="cmv2-selector cmv2-route-hub" aria-label="Tipos de estudio muestral">
      <div className="cmv2-selector-head cmv2-route-hub-head">
        <div>
          <span className="cmv2-eyebrow">Tipo de estudio</span>
          <h2>Elige el tipo de muestra</h2>
          <p>Empieza con «Muestra general», que sirve para cualquier estudio. Las plantillas especializadas añaden pasos propios para casos recurrentes. Cada proyecto usa un solo tipo.</p>
        </div>
        <div className="cmv2-route-hub-status" aria-label="Estado del proyecto">
          <span><Route size={13} /> 1 tipo por proyecto</span>
        </div>
      </div>

      <PreguntasIniciales />

      {hasExistingStudy && (
        <div className="cmv2-route-warning" role="note">
          <CheckCircle2 size={15} />
          <span>
            <strong>Este proyecto ya usa: {currentTitle}.</strong>
            Puedes mirar qué trae cada tipo sin perder nada. Cambiar a otro sí reinicia el cálculo y te pedirá confirmarlo.
          </span>
        </div>
      )}

      {pendingCard && (
        <VistaPreviaTipo
          destino={pendingCard.id}
          destinoTitulo={pendingCard.title}
          destinoCopy={pendingCard.copy}
          actualTitulo={currentTitle}
          perdidas={perdidas}
          onVolver={() => onSelect(currentDesk)}
          onConfirmar={onConfirmReset}
        />
      )}

      <div className="cmv2-frame-grid cmv2-frame-grid--routes cmv2-frame-grid--principal" data-qa-geometry-group="calc-muestra/tipo-general" data-qa-geometry-contract="equal">
        {renderCard(TIPO_GENERAL, true)}
      </div>

      <div className="cmv2-plantillas-head">
        <h3>Plantillas especializadas</h3>
        <p>Flujos preconfigurados para casos recurrentes. Usan el mismo motor de cálculo que la muestra general, con pasos propios.</p>
      </div>
      <div className="cmv2-frame-grid cmv2-frame-grid--routes cmv2-frame-grid--plantillas" data-qa-geometry-group="calc-muestra/plantillas" data-qa-geometry-contract="equal">
        {PLANTILLAS.map((card) => renderCard(card, false))}
      </div>
    </section>
  );
}
