import { useEffect, useId, useState } from "react";
import { Check, KeyRound, ListChecks, Sparkles, User } from "lucide-react";
import { apiV2RolesSugerencias } from "../../../api/client";
import type { InstrumentoOperationalConfig, RolesSugerencias } from "../types";

// =============================================================================
// RolesDeclarados — qué es un caso, quién lo recolectó y cuál cuenta
// =============================================================================
// Las verificaciones de Validación no pueden nombrar variables de un proyecto:
// preguntan por el rol y el estudio declara cuál es su columna. El problema es
// que declarar entre 190 columnas a ciegas es hostil, así que la app perfila la
// base y propone candidatas con la evidencia que las sostiene.
//
// Proponer no es decidir. Cada sugerencia se adopta con un clic explícito y
// dice qué efecto tendría — sobre todo el criterio de validez, que cambia el N
// del estudio y donde una variable de ruta se disfraza fácil de criterio.

type Props = {
  value: InstrumentoOperationalConfig;
  onChange: (next: InstrumentoOperationalConfig) => void;
  baseNombre?: string | null;
  disabled?: boolean;
};

export default function RolesDeclarados({ value, onChange, baseNombre, disabled }: Props) {
  const [sug, setSug] = useState<RolesSugerencias | null>(null);
  const [cargando, setCargando] = useState(true);
  const id = useId();

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    // Las sugerencias son una ayuda, no un requisito: si fallan, el analista
    // sigue pudiendo declarar los roles a mano.
    apiV2RolesSugerencias(baseNombre)
      .then((r) => { if (vivo) setSug(r); })
      .catch(() => { if (vivo) setSug(null); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [baseNombre]);

  const identidad = value.identity;
  const validez = value.caso_valido;

  function setIdentidad(patch: Partial<InstrumentoOperationalConfig["identity"]>) {
    onChange({ ...value, identity: { ...identidad, ...patch } });
  }
  function setValidez(patch: Partial<InstrumentoOperationalConfig["caso_valido"]>) {
    onChange({ ...value, caso_valido: { ...validez, ...patch } });
  }

  return (
    <section className="pulso-roles" data-audit-ready="validacion-roles">
      <header className="pulso-roles-head">
        <KeyRound size={15} aria-hidden="true" focusable="false" />
        <div>
          <h3 id={`${id}-titulo`}>Qué es un caso en este estudio</h3>
          <p>
            Las verificaciones preguntan por el rol, no por el nombre de la
            columna. Decláralos una vez y sirven para todo el proyecto.
          </p>
        </div>
      </header>

      {/* --- Identidad del caso ------------------------------------------- */}
      <RolBloque
        icono={<KeyRound size={13} aria-hidden="true" focusable="false" />}
        titulo="Identidad del caso"
        ayuda="Qué variables identifican a la persona encuestada. Se usan para detectar casos repetidos."
        activo={identidad.enabled}
        onToggle={(enabled) => setIdentidad({ enabled })}
        disabled={disabled}
        resumen={identidad.variables.length
          ? identidad.variables.join(" + ")
          : "sin declarar"}
      >
        {!cargando && sug?.identidad.llaves.length ? (
          <Sugerencias
            titulo="Candidatas por perfil"
            items={sug.identidad.llaves.map((k) => ({
              clave: k.variable,
              etiqueta: k.variable,
              porque: k.porque,
              yaEsta: identidad.variables.includes(k.variable),
            }))}
            onUsar={(clave) =>
              setIdentidad({
                enabled: true,
                variables: [...new Set([...identidad.variables, clave])],
              })
            }
            disabled={disabled}
          />
        ) : null}
      </RolBloque>

      {/* --- Agente -------------------------------------------------------- */}
      <RolBloque
        icono={<User size={13} aria-hidden="true" focusable="false" />}
        titulo="Quién recolectó"
        ayuda="La variable del encuestador. Con ella se detectan variantes del mismo nombre, que ensucian todo lo que se reporta por agente."
        activo={identidad.enabled && identidad.agent_variable.length > 0}
        onToggle={(enabled) => setIdentidad({ agent_variable: enabled ? identidad.agent_variable : "" })}
        disabled={disabled}
        resumen={identidad.agent_variable || "sin declarar"}
        sinToggle
      >
        {!cargando && sug?.identidad.agentes.length ? (
          <Sugerencias
            titulo="Candidatas por perfil"
            items={sug.identidad.agentes.map((a) => ({
              clave: a.variable,
              etiqueta: `${a.variable} · ${a.distintos} valores`,
              porque: a.porque,
              yaEsta: identidad.agent_variable === a.variable,
            }))}
            onUsar={(clave) => setIdentidad({ enabled: true, agent_variable: clave })}
            disabled={disabled}
          />
        ) : null}
      </RolBloque>

      {/* --- Criterio de validez ------------------------------------------- */}
      <RolBloque
        icono={<ListChecks size={13} aria-hidden="true" focusable="false" />}
        titulo="Qué caso cuenta"
        ayuda="Las condiciones que hacen que un caso entre al análisis. Hoy suelen vivir repetidas dentro de cada pregunta del formulario; declararlas hace que el N sea defendible."
        activo={validez.enabled}
        onToggle={(enabled) => setValidez({ enabled })}
        disabled={disabled}
        resumen={validez.condiciones.length
          ? validez.condiciones
              .map((c) => `${c.variable} ${c.operador} ${c.valores.join(", ")}`)
              .join(" · ")
          : "sin declarar — cuenta toda la base"}
      >
        {!cargando && sug?.caso_valido.length ? (
          <Sugerencias
            titulo="Lo que el formulario ya venía exigiendo"
            items={sug.caso_valido.map((c) => ({
              clave: c.variable,
              etiqueta: `${c.variable} ${c.operador} «${c.valores.join(", ")}»`,
              porque: c.porque,
              // El efecto es lo que distingue un criterio de validez de una
              // ruta del estudio, y por eso va en el rótulo, no escondido.
              aviso: c.n_casos_excluiria > 0
                ? `Sacaría ${c.n_casos_excluiria} caso${c.n_casos_excluiria === 1 ? "" : "s"} del análisis`
                : "No saca ningún caso",
              tono: c.probable_rama ? ("warn" as const) : ("ok" as const),
              yaEsta: validez.condiciones.some((x) => x.variable === c.variable),
            }))}
            onUsar={(clave) => {
              const c = sug.caso_valido.find((x) => x.variable === clave);
              if (!c) return;
              setValidez({
                enabled: true,
                condiciones: [
                  ...validez.condiciones.filter((x) => x.variable !== c.variable),
                  { variable: c.variable, operador: c.operador, valores: c.valores },
                ],
              });
            }}
            onQuitar={(clave) =>
              setValidez({
                condiciones: validez.condiciones.filter((x) => x.variable !== clave),
              })
            }
            disabled={disabled}
          />
        ) : null}
      </RolBloque>
    </section>
  );
}

function RolBloque({
  icono, titulo, ayuda, activo, onToggle, resumen, children, disabled, sinToggle,
}: {
  icono: React.ReactNode;
  titulo: string;
  ayuda: string;
  activo: boolean;
  onToggle: (v: boolean) => void;
  resumen: string;
  children?: React.ReactNode;
  disabled?: boolean;
  sinToggle?: boolean;
}) {
  return (
    <article className={`pulso-rol-bloque${activo ? " is-activo" : ""}`}>
      <div className="pulso-rol-bloque-head">
        <span className="pulso-rol-bloque-icono">{icono}</span>
        <div className="pulso-rol-bloque-copy">
          <strong>{titulo}</strong>
          <small>{ayuda}</small>
          <span className="pulso-rol-bloque-resumen">{resumen}</span>
        </div>
        {!sinToggle && (
          <label className="pulso-rol-bloque-toggle">
            <input
              type="checkbox"
              checked={activo}
              disabled={disabled}
              onChange={(e) => onToggle(e.target.checked)}
            />
            <span>{activo ? "Declarado" : "Sin declarar"}</span>
          </label>
        )}
      </div>
      {children}
    </article>
  );
}

function Sugerencias({
  titulo, items, onUsar, onQuitar, disabled,
}: {
  titulo: string;
  items: Array<{
    clave: string;
    etiqueta: string;
    porque: string;
    aviso?: string;
    tono?: "ok" | "warn";
    yaEsta: boolean;
  }>;
  onUsar: (clave: string) => void;
  onQuitar?: (clave: string) => void;
  disabled?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div className="pulso-rol-sugerencias">
      <p className="pulso-rol-sugerencias-titulo">
        <Sparkles size={11} aria-hidden="true" focusable="false" /> {titulo}
      </p>
      <ul>
        {items.map((it) => (
          <li key={it.clave} className={it.tono === "warn" ? "is-aviso" : undefined}>
            <div>
              <code>{it.etiqueta}</code>
              {it.aviso && <span className="pulso-rol-sugerencia-aviso">{it.aviso}</span>}
              <p>{it.porque}</p>
            </div>
            {it.yaEsta && onQuitar ? (
              <button type="button" className="pulso-vv2-pill" disabled={disabled}
                      onClick={() => onQuitar(it.clave)}
                      aria-label={`Quitar ${it.etiqueta}`}>
                Quitar
              </button>
            ) : (
              <button type="button" className="pulso-secondary" disabled={disabled || it.yaEsta}
                      onClick={() => onUsar(it.clave)}
                      aria-label={`Usar ${it.etiqueta}`}>
                <Check size={11} aria-hidden="true" focusable="false" />{" "}
                {it.yaEsta ? "Ya está" : "Usar"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
