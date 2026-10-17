// Pestaña «Datos» del Constructor: nombre de variable (Kobo), guía de select y datos crudos.
// Extraída de canvas/FocusedWorkspace.tsx — refactor puro, revamp 2026-10-16.

import { CheckCircle2, Database, Info, ListChecks } from "lucide-react";
import type { BuilderNode, BuilderStructure } from "../../types";
import type { CatalogInfo } from "../../inspector/ContextPanel";
import { stripMarkdown } from "../../helpers/markdown";
import { typeLabel } from "../../parsing/parseType";
import { InspectorBlock, InspectorField } from "../../inspector/InspectorPrimitives";
import { NameField } from "../../inspector/NameField";
import { PaperSettingsBlock } from "../PaperSettingsBlock";
import { offersPaperSettings } from "../paperSettings";
import { FocusFact } from "../constructor/compartido";

export function DataTab({
  node,
  structure,
  catalogInfo,
  catalogUsageCount,
  onFieldChange,
}: {
  node: BuilderNode;
  structure: BuilderStructure | null;
  catalogInfo?: CatalogInfo;
  catalogUsageCount: number;
  onFieldChange: (field: string, value: string) => void;
}) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  const baseType = typeof node.typeInfo.base === "string" ? node.typeInfo.base : "text";
  const listName = scalarText(node.typeInfo.listName);
  const nodeName = scalarText(node.name);
  const usageCount = Number.isFinite(Number(catalogUsageCount)) ? Number(catalogUsageCount) : 0;
  const isSelect = baseType === "select_one" || baseType === "select_multiple";
  const dataKindLabel = isSection
    ? node.kind === "repeat" ? "Repetición" : "Sección"
    : typeLabel(baseType);
  // El nombre interno (name) ya no vive aquí como fact read-only: sube al
  // editor destacado arriba del contrato. El contrato queda para el resto.
  const dataContractFacts = [
    {
      label: "Tipo guardado",
      value: dataKindLabel,
      code: false,
    },
    ...(isSelect
      ? [
          {
            label: "Lista",
            value: listName || "sin lista",
            code: Boolean(listName),
          },
          {
            label: "Uso de lista",
            value: catalogInfo ? `${usageCount} ${usageCount === 1 ? "pregunta" : "preguntas"}` : "Pendiente",
            code: false,
          },
        ]
      : []),
  ];
  const hasTechnicalOverrides = Boolean(
    node.read_only?.trim() || node.parameters?.trim() || node.paperOnly?.trim(),
  );
  const selectGuide = isSelect
    ? selectDataGuideFor(baseType, listName, catalogInfo, usageCount)
    : [];

  return (
    <div className="pulso-focus-tab-panel">
      {/* Lo más importante de Datos es el nombre interno de la columna: va
          primero y destacado, no enterrado como fact bajo el contrato. */}
      <InspectorBlock>
        <InspectorField
          label={isSection ? "Nombre de variable del bloque" : "Nombre de columna"}
          hint="El identificador interno: se usa en reglas, exportación y bases. Corto, único y sin tildes ni espacios."
        >
          {(campo) => (
            <>
              <NameField
                id={campo.id}
                ariaDescribedBy={campo.hintId}
                value={node.name}
                onChange={(next) => onFieldChange("name", next)}
                placeholder={isSection ? "ej. datos_hogar" : "ej. p1_edad"}
              />
              <KoboNameAssistant
                node={node}
                structure={structure}
                onApply={(next) => onFieldChange("name", next)}
              />
            </>
          )}
        </InspectorField>
      </InspectorBlock>

      <div className="pulso-focus-data-contract">
        <div className="pulso-focus-data-contract-head">
          <span className="pulso-focus-data-contract-icon">
            <Database size={15} />
          </span>
          <div>
            <strong>Cómo se guarda</strong>
            <p>
              Estos campos no cambian el texto que ve el encuestador; definen
              cómo se guarda la respuesta y cómo se conserva el XLSForm al exportar.
            </p>
          </div>
        </div>
        <div className="pulso-focus-data-contract-grid">
          {dataContractFacts.map((fact) => (
            <FocusFact
              key={fact.label}
              label={fact.label}
              value={fact.value}
              code={fact.code}
            />
          ))}
        </div>
        <div className="pulso-focus-data-principle">
          <Info size={13} />
          <span>
            Regla práctica: cambia el nombre cuando lo usarás en lógica,
            exportación o base de datos. Deja papel y parámetros en automático
            salvo que estés corrigiendo una plantilla importada.
          </span>
        </div>
        {selectGuide.length > 0 && (
          <div className="pulso-focus-select-data-guide" aria-label="Cómo se guardan las selecciones">
            <div className="pulso-focus-select-data-guide-head">
              <ListChecks size={14} />
              <strong>Cómo se guarda esta selección</strong>
            </div>
            <div className="pulso-focus-select-data-guide-grid">
              {selectGuide.map((item) => (
                <span key={item.title}>
                  <strong>{item.title}</strong>
                  <em>{item.detail}</em>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {offersPaperSettings(node) && (
        <PaperSettingsBlock key={node.rowIndex} node={node} onFieldChange={onFieldChange} />
      )}

      {hasTechnicalOverrides && (
        <InspectorBlock>
          <details className="pulso-focus-disclosure" open>
            <summary>Atributos avanzados importados</summary>
            {node.read_only && (
              <label className="pulso-inspector-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(node.read_only)}
                  onChange={(event) =>
                    onFieldChange("read_only", event.target.checked ? "yes" : "")
                  }
                />
                <span>
                  <strong>Solo lectura</strong>
                  <em>Se conserva porque vino configurado en el archivo importado.</em>
                </span>
              </label>
            )}
            {node.paperOnly && (
              <InspectorField
                label="Solo papel"
                hint="Marca importada para salida impresa. Déjala vacía si el elemento debe vivir también en el formulario digital."
              >
                {(campo) => (
                  <input
                    id={campo.id}
                    aria-describedby={campo.hintId}
                    type="text"
                    value={node.paperOnly}
                    onChange={(event) => onFieldChange("paper_only", event.target.value)}
                    spellCheck={false}
                  />
                )}
              </InspectorField>
            )}
            {node.parameters && (
              <InspectorField
                label="Parámetros XLSForm"
                hint="Atributos crudos importados. Se preservan al exportar."
              >
                {(campo) => (
                  <input
                    id={campo.id}
                    aria-describedby={campo.hintId}
                    type="text"
                    value={node.parameters}
                    onChange={(event) => onFieldChange("parameters", event.target.value)}
                    placeholder="Ej. randomize=true seed=42"
                    spellCheck={false}
                    style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
                  />
                )}
              </InspectorField>
            )}
          </details>
        </InspectorBlock>
      )}
    </div>
  );
}

export function selectDataGuideFor(
  baseType: string,
  listName: string,
  catalogInfo: CatalogInfo | undefined,
  usageCount: number,
): Array<{ title: string; detail: string }> {
  const isMulti = baseType === "select_multiple";
  const choicesCount = catalogInfo?.choicesCount ?? 0;
  const listDetail = listName
    ? choicesCount > 0
      ? `${choicesCount} ${choicesCount === 1 ? "opción" : "opciones"} en ${listName}.`
      : `Lista ${listName} preparada, aún sin opciones reales.`
    : "Sin lista vinculada todavía.";
  return [
    {
      title: isMulti ? "Guarda varias marcas" : "Guarda una marca",
      detail: isMulti
        ? "El formulario guarda los códigos elegidos en la misma columna, separados por espacios."
        : "El formulario guarda un solo código de opción en esta columna.",
    },
    {
      title: "Lista de opciones",
      detail: listDetail,
    },
    {
      title: usageCount > 1 ? "Lista reutilizada" : "Lista propia",
      detail: usageCount > 1
        ? `La comparten ${usageCount} preguntas; cambia códigos con cuidado.`
        : "Puedes ajustar opciones sin afectar otras preguntas.",
    },
  ];
}

export function scalarText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export const KOBO_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const KOBO_NAME_MAX_LENGTH = 42;
export const KOBO_NAME_STOPWORDS = new Set([
  "a",
  "al",
  "cual",
  "cuales",
  "cuando",
  "cuantos",
  "cuantas",
  "de",
  "del",
  "el",
  "en",
  "es",
  "esta",
  "este",
  "estos",
  "estas",
  "ha",
  "han",
  "indique",
  "ingrese",
  "la",
  "las",
  "lo",
  "los",
  "para",
  "por",
  "pregunte",
  "que",
  "seleccione",
  "si",
  "sobre",
  "su",
  "sus",
  "un",
  "una",
]);

export function KoboNameAssistant({
  node,
  structure,
  onApply,
}: {
  node: BuilderNode;
  structure: BuilderStructure | null;
  onApply: (next: string) => void;
}) {
  const currentName = (node.name ?? "").trim();
  const hasName = Boolean(currentName);
  const hasValidSyntax = hasName && KOBO_NAME_REGEX.test(currentName);
  const duplicateCount = hasName
    ? structure?.outline.filter((item) => item.name.trim() === currentName).length ?? 0
    : 0;
  const isDuplicate = duplicateCount > 1;
  const isReady = hasValidSyntax && !isDuplicate;
  const suggestions = buildKoboNameSuggestions(node, structure).filter((suggestion) => suggestion !== currentName);
  const isGenericName = hasName && /^(?:p|q|fila|pregunta)_?\d+$/i.test(currentName);
  const showSuggestions = suggestions.length > 0 && (!isReady || isGenericName);
  const statusCopy = isReady
    ? {
        title: "Listo para exportar",
        body: "Este nombre ya funciona para lógica, exportación y bases.",
      }
    : {
        title: hasName ? "Conviene ajustarlo" : "Falta un nombre interno",
        body: "Usa una versión corta, sin espacios ni tildes, que puedas reconocer en reglas y datos.",
      };
  const checks = [
    {
      key: "start",
      label: "Empieza con letra o _",
      ok: hasName && /^[A-Za-z_]/.test(currentName),
    },
    {
      key: "chars",
      label: "Sin espacios ni símbolos",
      ok: hasName && /^[A-Za-z_][A-Za-z0-9_]*$/.test(currentName),
    },
    {
      key: "unique",
      label: "Único en survey",
      ok: hasName && !isDuplicate,
    },
  ];

  return (
    <div className={`pulso-focus-name-assistant${isReady ? "" : " is-warning"}`}>
      <div className="pulso-focus-name-assistant-head">
        <span className="pulso-focus-name-assistant-icon" aria-hidden="true">
          {isReady ? <CheckCircle2 size={15} /> : <Database size={15} />}
        </span>
        <div>
          <strong>{statusCopy.title}</strong>
          <p>{statusCopy.body}</p>
        </div>
      </div>

      <div className="pulso-focus-name-checks" aria-label="Revisión rápida del nombre de la variable">
        {checks.map((check) => (
          <span key={check.key} className={check.ok ? "is-ok" : "is-pending"}>
            {check.ok ? <CheckCircle2 size={11} /> : <Info size={11} />}
            {check.label}
          </span>
        ))}
      </div>

      {showSuggestions && (
        <div className="pulso-focus-name-suggestions" aria-label="Sugerencias de nombre interno">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onApply(suggestion)}
              title={`Usar ${suggestion} como name`}
            >
              <code>{suggestion}</code>
              <span>Aplicar</span>
            </button>
          ))}
        </div>
      )}

      <p className="pulso-focus-name-tip">
        Si se repite, Prosecnur lo marca en Diagnóstico; corrígelo antes de usarlo en relevant,
        constraint, cálculo o choice_filter.
      </p>
    </div>
  );
}

export function buildKoboNameSuggestions(node: BuilderNode, structure: BuilderStructure | null): string[] {
  const takenNames = new Set(
    (structure?.outline ?? [])
      .filter((item) => item.rowIndex !== node.rowIndex)
      .map((item) => item.name.trim())
      .filter(Boolean),
  );
  const fallback = fallbackKoboNameForNode(node);
  const base = makeKoboName(node.label || node.hint || node.name, fallback);
  const compact = makeKoboName(wordsForKoboName(node.label).slice(0, 4).join("_"), fallback);
  const expanded = makeKoboName([node.label, node.hint].filter(Boolean).join(" "), fallback);
  const prefix = koboNamePrefixForNode(node);
  const candidates = [
    base,
    compact,
    expanded,
    prefix ? withKoboPrefix(base, prefix) : base,
    node.kind === "section" ? withKoboPrefix(base, "grupo") : null,
    node.kind === "repeat" ? withKoboPrefix(base, "rep") : null,
    node.kind === "calculate" ? `${base}_calc` : null,
    node.kind === "note" ? withKoboPrefix(base, "nota") : null,
  ];

  const unique = new Set<string>();
  candidates.forEach((candidate) => {
    if (!candidate) return;
    const available = makeAvailableKoboName(candidate, takenNames);
    if (available && KOBO_NAME_REGEX.test(available)) unique.add(available);
  });
  return [...unique].slice(0, 4);
}

export function withKoboPrefix(value: string, prefix: string): string {
  if (!value || value === prefix || value.startsWith(`${prefix}_`)) return value;
  return limitKoboName(`${prefix}_${value}`);
}

export function makeAvailableKoboName(value: string, takenNames: Set<string>): string {
  const base = makeKoboName(value, "pregunta");
  if (!takenNames.has(base)) return base;
  for (let index = 2; index <= 9; index += 1) {
    const candidate = limitKoboName(`${base}_${index}`);
    if (!takenNames.has(candidate)) return candidate;
  }
  return base;
}

export function makeKoboName(value: string, fallback: string): string {
  const words = wordsForKoboName(value);
  const raw = words.length > 0 ? words.join("_") : fallback;
  const normalized = raw.replace(/_+/g, "_").replace(/^_+|_+$/g, "") || fallback;
  const prefixed = /^[0-9]/.test(normalized) ? `p_${normalized}` : normalized;
  return limitKoboName(/^[a-z_]/.test(prefixed) ? prefixed : `p_${prefixed}`);
}

export function wordsForKoboName(value: string): string[] {
  return stripMarkdown(value.replace(/_/g, " "))
    .toLowerCase()
    .replace(/ñ/g, "n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((word) => !KOBO_NAME_STOPWORDS.has(word));
}

export function limitKoboName(value: string): string {
  return value
    .slice(0, KOBO_NAME_MAX_LENGTH)
    .replace(/_+$/g, "")
    .replace(/^([0-9])/, "p_$1");
}

export function fallbackKoboNameForNode(node: BuilderNode): string {
  if (node.kind === "section") return "grupo";
  if (node.kind === "repeat") return "repeticion";
  if (node.kind === "note") return "nota";
  if (node.kind === "calculate") return "calculo";
  if (node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple") return "seleccion";
  return makeKoboName(typeLabel(node.typeInfo.base), "pregunta");
}

export function koboNamePrefixForNode(node: BuilderNode): string | null {
  if (node.kind === "section") return "g";
  if (node.kind === "repeat") return "rep";
  if (node.kind === "note") return "nota";
  if (node.kind === "calculate") return "calc";
  switch (node.typeInfo.base) {
    case "integer":
    case "decimal":
    case "range":
      return "num";
    case "select_one":
      return "sel";
    case "select_multiple":
      return "multi";
    case "geopoint":
    case "geotrace":
    case "geoshape":
      return "gps";
    case "image":
    case "audio":
    case "video":
    case "file":
    case "barcode":
      return node.typeInfo.base;
    default:
      return null;
  }
}
