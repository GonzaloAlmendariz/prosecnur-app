// Tamaño de letra del cliente (K13; decisión 15: por proyecto, con el default del perfil del catálogo). Un paso general
// con nombre —Estándar, Grande (+2 pt), Muy grande (+4 pt)— y «Afinar por elemento» con los mismos pasos por rol. Cada
// rol muestra cómo queda en el Word: «20 pt = 18 + 2», a partir del catálogo de `/estilo/opciones`.

import { ESTILO_PASOS, ESTILO_ROLES, type EstiloOpciones, type EstiloPaso, type EstiloRol } from "../../../api/graficosEstilo";
import { RotateCcw } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import { ETIQUETA_PASO, ETIQUETA_ROL, tamanosRol, type Procedencia } from "./modeloEstilo";
import { MarcaModificado, SelloProcedencia } from "./SelloProcedencia";

const HEREDA = "";

export function SeccionLetra({
  paso,
  procedenciaPaso,
  pasoRol,
  rolPropio,
  procedenciaRol,
  modificada,
  opciones,
  onPaso,
  onSinPaso,
  onRol,
  onSinRol,
  onSinLetra,
}: {
  paso: EstiloPaso;
  procedenciaPaso: Procedencia;
  /** Paso efectivo de cada rol (propio, del perfil o el general). */
  pasoRol: (rol: EstiloRol) => EstiloPaso;
  /** Paso elegido para el rol, si tiene uno guardado. */
  rolPropio: (rol: EstiloRol) => EstiloPaso | undefined;
  procedenciaRol: (rol: EstiloRol) => Procedencia;
  modificada: boolean;
  opciones: EstiloOpciones | null;
  onPaso: (paso: EstiloPaso) => void;
  onSinPaso: () => void;
  onRol: (rol: EstiloRol, paso: EstiloPaso) => void;
  onSinRol: (rol: EstiloRol) => void;
  onSinLetra: () => void;
}) {
  const pasos = opciones?.pasos ?? [];
  const desplazamiento = (p: EstiloPaso) => pasos.find((x) => x.id === p)?.desplazamientoPt;

  return (
    <section className="pulso-f6-estilo-seccion" aria-labelledby="f6-estilo-letra-titulo" data-qa-geometry-member>
      <header className="pulso-f6-estilo-seccion-cabecera">
        <h3 id="f6-estilo-letra-titulo">Tamaño de letra</h3>
        <MarcaModificado visible={modificada} />
        {modificada ? (
          <PulsoButton variant="ghost" size="sm" onClick={onSinLetra} aria-label="Volver al tamaño de letra por defecto">
            <RotateCcw size={14} aria-hidden="true" />
            Restablecer
          </PulsoButton>
        ) : null}
      </header>
      <p className="pulso-f6-estilo-ayuda">
        Para un cliente que pide letras más grandes en todos sus informes. Aplica a toda la jerarquía, en el PPT y en el Word;
        las cifras de los gráficos nunca bajan de 8 pt.
      </p>

      <fieldset className="pulso-f6-estilo-opciones is-pasos" data-qa-geometry-group="graficos/f6-estilo-pasos" data-qa-geometry-contract="equal">
        <legend className="pulso-f6-estilo-leyenda">
          General <SelloProcedencia procedencia={procedenciaPaso} />
        </legend>
        {ESTILO_PASOS.map((id) => {
          const d = desplazamiento(id);
          return (
            <label key={id} className={`pulso-f6-estilo-opcion${paso === id ? " is-activa" : ""}`} data-qa-geometry-member>
              <input type="radio" name="f6-estilo-paso" value={id} checked={paso === id} onChange={() => onPaso(id)} />
              <span className="pulso-f6-estilo-opcion-texto">
                <strong>{ETIQUETA_PASO[id]}</strong>
                <span>{d === undefined ? " " : d === 0 ? "Por defecto" : `+${d} pt`}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {procedenciaPaso === "propio" ? (
        <PulsoButton variant="ghost" size="sm" className="pulso-f6-estilo-volver" onClick={onSinPaso}>
          <RotateCcw size={14} aria-hidden="true" />
          Tamaño general por defecto
        </PulsoButton>
      ) : null}

      <h4 className="pulso-f6-estilo-subtitulo">Afinar por elemento</h4>
      <ul className="pulso-f6-estilo-roles" data-qa-geometry-group="graficos/f6-estilo-roles" data-qa-geometry-contract="equal">
        {ESTILO_ROLES.map((rol) => {
          const efectivo = pasoRol(rol);
          const elegido = rolPropio(rol);
          const procedencia = procedenciaRol(rol);
          const tamanos = tamanosRol(opciones?.roles.find((r) => r.id === rol), efectivo, pasos);
          const idSelect = `f6-estilo-rol-${rol}`;
          return (
            <li key={rol} className="pulso-f6-estilo-rol" data-qa-geometry-member>
              <div className="pulso-f6-estilo-rol-cabecera">
                <label htmlFor={idSelect}>{ETIQUETA_ROL[rol]}</label>
                <SelloProcedencia procedencia={procedencia} />
              </div>
              <select
                id={idSelect}
                value={elegido ?? HEREDA}
                onChange={(event) => {
                  const elegidoAhora = ESTILO_PASOS.find((p) => p === event.target.value);
                  if (elegidoAhora) onRol(rol, elegidoAhora);
                  else onSinRol(rol);
                }}
              >
                <option value={HEREDA}>Como el general ({ETIQUETA_PASO[paso]})</option>
                {ESTILO_PASOS.map((id) => <option key={id} value={id}>{ETIQUETA_PASO[id]}</option>)}
              </select>
              <p className="pulso-f6-estilo-rol-tamanos" aria-label={`Tamaños en el Word de ${ETIQUETA_ROL[rol].toLowerCase()}`}>
                {tamanos.length > 0
                  ? tamanos.map((t) => (
                      // Muestra a su tamaño real (1 pt = 4/3 px), para comparar Estándar, Grande y Muy grande a ojo.
                      <span key={t.token} className="pulso-f6-estilo-muestra-letra">
                        <span className="pulso-f6-estilo-muestra-texto" style={{ fontSize: `${Math.round(t.final * 4 / 3 * 10) / 10}px` }}>{t.etiqueta}</span>
                        <small>{t.texto}</small>
                      </span>
                    ))
                  : <span className="pulso-f6-estilo-tenue">{opciones ? "Sin tamaños declarados en el Word." : "Cargando los tamaños…"}</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
