import { forwardRef, useRef, useState, type CSSProperties } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { MoreHorizontal, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { homeModuleVars, type ProsecnurModuleMeta } from "../../lib/modules";
import type { ModuleCardView, ModuleCardViz } from "./moduleCardModel";
import {
  MISSION_CONTROL_MENU_ITEMS,
  transitionMissionControlMenu,
  type MissionControlMenuEvent,
  type MissionControlMenuState,
} from "./missionControlMenu";

export type {
  ModuleCardFact,
  ModuleCardView,
  ModuleCardViz,
  ModuleProgressStep,
  ModuleStatusState,
} from "./moduleCardModel";

function PhaseView({
  done,
  total,
  labels,
  sub,
}: {
  done: number;
  total: number;
  labels: string[];
  sub: string;
}) {
  return (
    <span className="home-mc-viz is-phases">
      <span className="home-mc-phasebar">
        <span className="home-mc-phase-track">
          {Array.from({ length: total }).map((_, index) => (
            <span
              key={index}
              className={`home-mc-phase${index < done ? " is-done" : ""}${index === done ? " is-next" : ""}`}
              title={labels[index]}
            />
          ))}
        </span>
        <span className="home-mc-phase-labels">
          {labels.map((label, index) => (
            <span key={label} className={index < done ? "is-done" : ""}>
              {label}
            </span>
          ))}
        </span>
      </span>
      <span className="home-mc-stat">
        <strong>{done}/{total}</strong>
        <span className="home-mc-stat-label">fases</span>
      </span>
      <span className="home-mc-stat-sub">{sub}</span>
    </span>
  );
}

function ProgressView({
  viz,
  sub,
}: {
  viz: Extract<ModuleCardViz, { kind: "progress" }>;
  sub: string;
}) {
  const percent = viz.total > 0
    ? Math.min(100, Math.max(0, (viz.current / viz.total) * 100))
    : 0;
  return (
    <span className="home-mc-viz is-progress">
      <span className="home-mc-stat-sub">{sub}</span>
      <span className="home-mc-progress-row">
        <span
          className="home-mc-progress-track"
          role="progressbar"
          aria-label={viz.label}
          aria-valuemin={0}
          aria-valuemax={viz.total}
          aria-valuenow={Math.min(viz.current, viz.total)}
        >
          <span className="home-mc-progress-fill" style={{ width: `${percent}%` }} />
        </span>
        <span className="home-mc-progress-copy">
          <strong>{viz.display}</strong>
          <span>{viz.label}</span>
        </span>
      </span>
      {viz.steps && (
        <span className="home-mc-progress-steps" aria-hidden="true">
          {viz.steps.map((step) => (
            <span key={step.label} className={`is-${step.state}`}>{step.label}</span>
          ))}
        </span>
      )}
    </span>
  );
}

function StatView({
  value,
  label,
  sub,
  activityFirst,
}: {
  value: string;
  label: string;
  sub: string;
  activityFirst: boolean;
}) {
  const isWord = /[a-zá-úñ]/i.test(value);
  // Una sola lectura primaria: la cifra manda y la frase de estado es su
  // subtítulo. Antes competían dos bloques del mismo peso, precedidos por un
  // eyebrow "Ahora" que solo gastaba alto (regla 12 del sistema: nada de
  // títulos interiores cuando el contexto ya nombra el bloque).
  // `activityFirst` invierte el orden cuando la cifra no dice nada útil
  // ("Sin cálculo"), pero mantiene la misma estructura.
  return (
    <span className={`home-mc-viz${activityFirst ? " is-activity" : ""}`}>
      <span className={`home-mc-stat${isWord ? " is-text" : ""}`}>
        <strong>{value}</strong>
        <span className="home-mc-stat-label">{label}</span>
      </span>
      {sub && <span className="home-mc-stat-sub">{sub}</span>}
    </span>
  );
}

function DateView({ viz, sub }: { viz: Extract<ModuleCardViz, { kind: "date" }>; sub: string }) {
  return (
    <span className="home-mc-viz">
      <span className={`home-mc-daychip is-${viz.tone}`} aria-hidden="true">
        <span className="home-mc-daychip-month">{viz.month || "fecha"}</span>
        <span className="home-mc-daychip-day">{viz.day || "?"}</span>
      </span>
      <span className="home-mc-stat">
        <span className="home-mc-stat-label">{viz.label}</span>
        <span className="home-mc-date-title">{sub}</span>
        <span className={`home-mc-countdown is-${viz.tone}`}>{viz.countdown}</span>
      </span>
    </span>
  );
}

export const ModuleStatusCard = forwardRef<
  HTMLDivElement,
  {
    module: ProsecnurModuleMeta;
    view: ModuleCardView;
    index: number;
    onRequestRemove: (slug: string) => void;
  }
>(function ModuleStatusCard({ module, view, index, onRequestRemove }, ref) {
  const navigate = useNavigate();
  const Icon = module.icon;
  const kebabRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [menuState, setMenuState] = useState<MissionControlMenuState>({ kind: "closed" });
  const [showProgress, setShowProgress] = useState(false);

  function applyMenuEvent(event: MissionControlMenuEvent) {
    const transition = transitionMissionControlMenu(menuState, event);
    setMenuState(transition.state);
    if (transition.command?.type === "open") {
      navigate(view.action.route);
    } else if (transition.command?.type === "view-progress") {
      setShowProgress(true);
    } else if (transition.command?.type === "remove") {
      onRequestRemove(transition.command.slug);
    }
  }

  return (
    <div
      ref={ref}
      className={`home-mc-card is-${view.state}`}
      style={{ ...homeModuleVars(module), ["--i" as string]: index } as CSSProperties}
      title={view.summary || undefined}
    >
      <button
        type="button"
        className="home-mc-enter"
        onClick={() => navigate(view.action.route)}
        aria-label={`${view.action.label}: ${module.title}`}
      >
        <span className="home-mc-head">
          <span className="home-mc-head-id">
            <span className="home-mc-badge" aria-hidden="true"><Icon size={17} /></span>
            <span className="home-mc-head-text">
              <strong>{module.shortLabel}</strong>
              <span className="home-mc-tagline">{module.tagline}</span>
            </span>
          </span>
          {/* Solo se muestra lo excepcional. "Al día" y "En curso" son el caso
              normal de casi todas las tarjetas: repetidos ocho veces no dicen
              nada y compiten con el nombre del módulo. El estado normal ya se
              lee en la cifra y en la frase; el chip queda para lo que sí exige
              una decisión: una alerta, o un módulo sin empezar. */}
          {(view.alert || view.state === "pending") && (
            <span className="home-mc-signals">
              {view.alert ? (
                <span className="home-mc-alert" title={`${view.statusLabel}: ${view.alert}`}>
                  <TriangleAlert size={11} strokeWidth={2.6} aria-hidden="true" />
                  {view.alert}
                </span>
              ) : (
                <span className="home-mc-status is-pending">{view.statusLabel}</span>
              )}
            </span>
          )}
        </span>

        {view.viz.kind === "phases" && (
          <PhaseView
            done={view.viz.done}
            total={view.viz.total}
            labels={view.viz.labels}
            sub={view.sub}
          />
        )}
        {view.viz.kind === "progress" && <ProgressView viz={view.viz} sub={view.sub} />}
        {view.viz.kind === "stat" && (
          <StatView
            value={view.viz.value}
            label={view.viz.label}
            sub={view.sub}
            activityFirst={view.emphasis === "activity"}
          />
        )}
        {view.viz.kind === "date" && <DateView viz={view.viz} sub={view.sub} />}

        {/* Línea de metadatos, no tres mini-stats. Los facts de módulos
            distintos no son comparables entre sí (nadie compara "universo" de
            Monitoreo con "catálogos" de Formularios), así que alinearlos en
            columnas con cifras grandes era ruido: es material de contexto y va
            como pie discreto, al estilo del pie de Finder. El CTA se fue
            porque la tarjeta entera ya es el botón. */}
        {view.facts.length > 0 && (
          <span className="home-mc-foot" aria-label={`Datos de ${module.shortLabel}`}>
            {view.facts.slice(0, 4).map((fact, index) => (
              <span className="home-mc-fact" key={fact.label}>
                {index > 0 && <span className="home-mc-fact-dot" aria-hidden="true">·</span>}
                <strong>{fact.value}</strong>
                <span>{fact.label}</span>
              </span>
            ))}
          </span>
        )}
      </button>

      <Popover.Root
        open={menuState.kind === "menu"}
        onOpenChange={(open) => {
          if (open) {
            setShowProgress(false);
            setMenuState(
              transitionMissionControlMenu(menuState, {
                type: "open",
                slug: module.slug,
              }).state,
            );
          } else if (menuState.kind === "menu") {
            setMenuState(transitionMissionControlMenu(menuState, { type: "escape" }).state);
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            ref={kebabRef}
            type="button"
            className="home-mc-kebab"
            aria-label={`Opciones de ${module.shortLabel}`}
            title="Opciones"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="home-mc-menu-popover"
            align="end"
            sideOffset={6}
            collisionPadding={12}
          >
            <div className="home-mc-menu-actions" role="menu" aria-label={`Opciones de ${module.shortLabel}`}>
              {MISSION_CONTROL_MENU_ITEMS.map((item) => (
                <button
                  type="button"
                  role="menuitem"
                  className={item.section === "destructive" ? "is-destructive" : undefined}
                  aria-expanded={item.action === "view-progress" ? showProgress : undefined}
                  onClick={() => applyMenuEvent({ type: "select", action: item.action })}
                  key={item.action}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {showProgress && (
              <div className="home-mc-menu-progress" aria-live="polite">
                <span>Avance</span>
                <strong>{view.sub}</strong>
                <small>{view.statusLabel}</small>
                {view.facts.length > 0 && (
                  <dl>
                    {view.facts.slice(0, 4).map((fact) => (
                      <div key={fact.label}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Dialog.Root
        open={menuState.kind === "confirm-remove"}
        onOpenChange={(open) => {
          if (!open && menuState.kind === "confirm-remove") {
            setMenuState(transitionMissionControlMenu(menuState, { type: "escape" }).state);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="home-confirm-backdrop" />
          <Dialog.Content
            className="home-confirm"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              cancelRef.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              if (!kebabRef.current?.isConnected) return;
              event.preventDefault();
              kebabRef.current.focus();
            }}
          >
            <Dialog.Title asChild>
              <strong>¿Quitar {module.shortLabel} del proyecto?</strong>
            </Dialog.Title>
            <Dialog.Description asChild>
              <p>
                El módulo dejará de aparecer en este proyecto. Puedes volver a agregarlo cuando
                quieras; su información no se borra.
              </p>
            </Dialog.Description>
            <div className="home-confirm-actions">
              <Dialog.Close asChild>
                <button ref={cancelRef} type="button" className="plan-button">
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="home-confirm-remove"
                onClick={() => applyMenuEvent({ type: "confirm-remove" })}
              >
                Quitar del proyecto
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
});
