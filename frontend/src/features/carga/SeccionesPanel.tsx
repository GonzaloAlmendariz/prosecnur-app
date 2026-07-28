import { FolderClosed } from "../../vendor/lucide-react";
import type { Seccion } from "../../api/client";
import { EmptyState } from "../../components/States";
import { RepeatBadge } from "../../components/RepeatBadge";

// Lista de secciones del XLSForm con sus flags (repeat / condicional) y
// la condición `relevant` traducida a texto humano.
//
// Visualmente: cada sección es una fila con 4 columnas:
//   [prefix monospace pill]  [label + name mono]  [chips repeat/condicional]  [relevant expresión]
// Las filas alternan fondo surface/white para facilitar lectura.

function sustituir_refs(expr: string): string {
  // Los XLSForm usan `${variable}` para referirse a otras preguntas.
  // Lo simplificamos a `variable` para hacer la expresión más legible.
  return expr.replace(/\$\{([^}]+)\}/g, "$1");
}

export default function SeccionesPanel({ secciones }: { secciones: Seccion[] }) {
  if (!secciones || secciones.length === 0) {
    return (
      <EmptyState
        variant="inline"
        icon={<FolderClosed size={18} />}
        title="Sin secciones detectadas"
        hint="Verifica que tu XLSForm tenga grupos (begin_group / end_group)."
      />
    );
  }
  return (
    <div className="pulso-carga-section-list">
      {secciones.map((s) => {
        const cond = s.relevant ? sustituir_refs(s.relevant) : null;
        // Para grupos repetibles, la información útil no es la visibilidad sino qué
        // variable gobierna cuántas veces se repite (el `repeat_count`).
        const repeatVars = s.is_repeat ? (s.repeat_count_vars ?? []) : [];
        const repeatExpr = s.is_repeat && s.repeat_count ? sustituir_refs(s.repeat_count) : null;
        const showRepeatDriver = s.is_repeat && (repeatVars.length > 0 || !!repeatExpr);
        return (
          <div key={s.name} className="pulso-carga-section-row" title={`${s.label} · ${s.name}`}>
            <span className="pulso-carga-section-prefix">
              {s.prefix || "—"}
            </span>
            <div className="pulso-carga-section-copy">
              <span className="pulso-carga-section-label">{s.label}</span>
              <code className="pulso-carga-section-name">{s.name}</code>
            </div>
            <div className="pulso-carga-section-flags">
              {s.is_repeat && <RepeatBadge compact />}
              {s.is_conditional ? (
                <span className="pulso-carga-section-visibility is-conditional">
                  condicional
                </span>
              ) : s.is_repeat ? null : (
                <span className="pulso-carga-section-visibility">
                  siempre visible
                </span>
              )}
            </div>
            <code className="pulso-carga-section-condition">
              {cond ? (
                <>
                  <span className="pulso-carga-section-condition-prefix">si</span>
                  {cond}
                </>
              ) : showRepeatDriver ? (
                <>
                  <span className="pulso-carga-section-condition-prefix">
                    se repite según
                  </span>
                  {repeatVars.length > 0 ? repeatVars.join(", ") : repeatExpr}
                </>
              ) : (
                <span className="pulso-carga-section-condition-empty">—</span>
              )}
            </code>
          </div>
        );
      })}
    </div>
  );
}
