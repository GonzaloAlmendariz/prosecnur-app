// =============================================================================
// inspector/logic/TextRuleSuite.tsx — reglas de texto en lenguaje humano
// =============================================================================
// UI del catálogo `textRules.ts`: galería de recetas por categoría, frase con
// parámetros inline ("Debe tener exactamente [ 8 ] dígitos") y probador en
// vivo (compileForJs). Dos variantes:
//   · block — bloque completo (empty state / constraint = 1 receta).
//   · row   — fila compacta dentro de un AND mixto (título + editar/quitar);
//             el probador aparece solo al editar.
// El apply usa el mismo canal que los presets: expresión + mensaje sugerido.
// =============================================================================

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Asterisk,
  Check,
  CircleOff,
  Code2,
  ContactRound,
  Hash,
  Mail,
  Pencil,
  Phone,
  Ruler,
  Sigma,
  Type,
  Wand2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  buildTextRuleConstraint,
  compileForJs,
  TEXT_RULE_CATEGORIES,
  TEXT_RULE_RECIPES,
  textRuleById,
  textRuleParamsValid,
} from "./textRules";
import type { TextRuleParams, TextRuleRecipe } from "./textRules";
import "../../styles/xf-text-rules.css";

const RECIPE_ICONS: Record<string, LucideIcon> = {
  "exactamente-n-digitos": Hash,
  "entre-n-y-m-caracteres": Ruler,
  "solo-numeros": Sigma,
  "solo-letras": Type,
  "sin-numeros": CircleOff,
  "empieza-con": ArrowRight,
  "termina-con": ArrowLeft,
  "correo-electronico": Mail,
  "codigo-sin-espacios": Code2,
  "codigo-alfanumerico-n": Asterisk,
  "dni-peru": ContactRound,
  "celular-peru": Phone,
};

function recipeIcon(id: string): LucideIcon {
  return RECIPE_ICONS[id] ?? Wand2;
}

function isDniEquivalent(recipe: TextRuleRecipe, params: TextRuleParams): boolean {
  return recipe.id === "exactamente-n-digitos" && Number(params.n) === 8;
}

export type TextRuleSuiteProps = {
  /** Estado reconocido (modo edición reversible) o null (elegir desde cero). */
  active: { recipe: TextRuleRecipe; params: TextRuleParams } | null;
  /** Mismo canal que los presets: expresión constraint + mensaje sugerido. */
  onApply: (constraintExpr: string, message: string) => void;
  onClear: () => void;
  variant?: "block" | "row";
};

export function TextRuleSuite({ active, onApply, onClear, variant = "block" }: TextRuleSuiteProps) {
  const [draft, setDraft] = useState<{ recipeId: string; params: TextRuleParams } | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [sample, setSample] = useState("");

  const draftRecipe = draft ? textRuleById(draft.recipeId) ?? null : null;
  const current = draft && draftRecipe ? { recipe: draftRecipe, params: draft.params } : active;

  const valid = current ? textRuleParamsValid(current.recipe, current.params) : false;
  const compiled = current && valid ? compileForJs(current.recipe.buildRegex(current.params)) : null;
  const verdict = compiled && sample !== "" ? compiled.test(sample) : null;

  const rootClass = variant === "row" ? "pulso-xftr is-row" : "pulso-xftr";

  const pickRecipe = (recipe: TextRuleRecipe) => {
    setDraft({ recipeId: recipe.id, params: { ...recipe.defaults } });
    setGalleryOpen(false);
  };
  const startEdit = () => {
    if (active) setDraft({ recipeId: active.recipe.id, params: { ...active.params } });
  };
  const cancelDraft = () => {
    setDraft(null);
    setGalleryOpen(false);
  };
  const applyDraft = () => {
    if (!draft || !draftRecipe) return;
    if (!textRuleParamsValid(draftRecipe, draft.params)) return;
    onApply(
      buildTextRuleConstraint(draftRecipe, draft.params),
      draftRecipe.buildMessage(draft.params),
    );
    setDraft(null);
    setGalleryOpen(false);
  };
  const setParam = (key: string, value: string) => {
    setDraft((prev) => (prev ? { ...prev, params: { ...prev.params, [key]: value } } : prev));
  };

  const tester = current ? (
    <div className="pulso-xftr-tester">
      <div className="pulso-xftr-tester-row">
        <input
          type="text"
          value={sample}
          onChange={(event) => setSample(event.target.value)}
          placeholder="Escribe un ejemplo…"
          aria-label="Probar un ejemplo contra la regla"
          disabled={!compiled}
        />
        {verdict !== null && (
          <span
            className={verdict ? "pulso-xftr-verdict is-ok" : "pulso-xftr-verdict is-bad"}
            role="status"
          >
            {verdict ? <Check size={11} aria-hidden="true" /> : <X size={11} aria-hidden="true" />}
            {verdict ? "Cumple" : "No cumple"}
          </span>
        )}
      </div>
      <div className="pulso-xftr-samples">
        {current.recipe.examples.ok.slice(0, 2).map((example) => (
          <button
            type="button"
            key={example}
            className="pulso-xftr-sample"
            onClick={() => setSample(example)}
            title="Usar este ejemplo en el probador"
          >
            {example}
          </button>
        ))}
        <small className="pulso-xftr-note">La validación final corre en el dispositivo.</small>
      </div>
    </div>
  ) : null;

  // ── Modo edición: frase con parámetros inline + probador ─────────────────
  if (draft && draftRecipe) {
    const Icon = recipeIcon(draftRecipe.id);
    return (
      <div className={rootClass}>
        <div className="pulso-xftr-editor">
          <div className="pulso-xftr-phrase">
            <span className="pulso-xftr-phrase-icon" aria-hidden="true">
              <Icon size={13} />
            </span>
            {draftRecipe.phrase.map((part, index) => {
              if (typeof part === "string") {
                return <span key={index}>{part}</span>;
              }
              const spec = draftRecipe.params.find((s) => s.key === part.param);
              const value = String(draft.params[part.param] ?? "");
              return (
                <input
                  key={index}
                  type="text"
                  className="pulso-xftr-param"
                  inputMode={spec?.kind === "int" ? "numeric" : undefined}
                  value={value}
                  size={Math.max(
                    spec?.kind === "int" ? 2 : 6,
                    value.length || (spec?.placeholder?.length ?? 4),
                  )}
                  placeholder={spec?.placeholder}
                  aria-label={spec?.label ?? part.param}
                  onChange={(event) => setParam(part.param, event.target.value)}
                />
              );
            })}
          </div>
          {isDniEquivalent(draftRecipe, draft.params) && (
            <small className="pulso-xftr-equiv">Equivale a un DNI peruano.</small>
          )}
          {tester}
          <div className="pulso-xftr-actions">
            <button
              type="button"
              className="pulso-xftr-apply"
              onClick={applyDraft}
              disabled={!valid}
            >
              <Check size={12} aria-hidden="true" /> Aplicar regla
            </button>
            {variant === "block" && (
              <button
                type="button"
                className="pulso-xftr-ghost"
                onClick={() => {
                  setDraft(null);
                  setGalleryOpen(true);
                }}
              >
                <Wand2 size={12} aria-hidden="true" /> Cambiar
              </button>
            )}
            <button type="button" className="pulso-xftr-ghost" onClick={cancelDraft}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Galería agrupada por categoría ────────────────────────────────────────
  if (galleryOpen) {
    return (
      <div className={rootClass}>
        <div className="pulso-xftr-gallery">
          {TEXT_RULE_CATEGORIES.map((category) => {
            const recipes = TEXT_RULE_RECIPES.filter((r) => r.category === category.id);
            if (recipes.length === 0) return null;
            return (
              <section className="pulso-xftr-cat" key={category.id}>
                <span className="pulso-xftr-cat-label">{category.label}</span>
                <div className="pulso-xftr-chips">
                  {recipes.map((recipe) => {
                    const Icon = recipeIcon(recipe.id);
                    return (
                      <button
                        type="button"
                        key={recipe.id}
                        className="pulso-xftr-chip"
                        onClick={() => pickRecipe(recipe)}
                        title={recipe.buildMessage(recipe.defaults)}
                      >
                        <Icon size={13} aria-hidden="true" />
                        <span>{recipe.title()}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <button type="button" className="pulso-xftr-ghost" onClick={cancelDraft}>
            <X size={12} aria-hidden="true" /> Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ── Regla reconocida: resumen humano reversible ───────────────────────────
  if (active) {
    const Icon = recipeIcon(active.recipe.id);
    return (
      <div className={rootClass}>
        <div className="pulso-xftr-summary">
          <span className="pulso-xftr-summary-icon" aria-hidden="true">
            <Icon size={13} />
          </span>
          <span className="pulso-xftr-summary-title">
            {active.recipe.title(active.params)}
            {isDniEquivalent(active.recipe, active.params) && (
              <small className="pulso-xftr-equiv"> · equivale a DNI</small>
            )}
          </span>
          <span className="pulso-xftr-summary-actions">
            {active.recipe.params.length > 0 && (
              <button type="button" className="pulso-xftr-ghost" onClick={startEdit}>
                <Pencil size={12} aria-hidden="true" /> Editar
              </button>
            )}
            {variant === "block" && (
              <button
                type="button"
                className="pulso-xftr-ghost"
                onClick={() => setGalleryOpen(true)}
              >
                <Wand2 size={12} aria-hidden="true" /> Cambiar
              </button>
            )}
            <button type="button" className="pulso-xftr-ghost" onClick={onClear}>
              <X size={12} aria-hidden="true" /> Quitar
            </button>
          </span>
        </div>
        {variant === "block" && tester}
      </div>
    );
  }

  // ── Sin regla: CTA que abre la galería ────────────────────────────────────
  return (
    <div className={rootClass}>
      <button type="button" className="pulso-xftr-cta" onClick={() => setGalleryOpen(true)}>
        <Wand2 size={13} aria-hidden="true" /> Elegir una regla de formato
      </button>
    </div>
  );
}
