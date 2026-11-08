// Las paletas con nombre como muestras (ítem 8 de la oleada del inspector, 2026-11-08): en vez de un desplegable con
// nombres, cada paleta pinta sus colores sobre las respuestas de ESTA pregunta y dice a cuántas preguntas alcanza.
// Pasar el cursor (o el foco) por una muestra la anuncia a la tarjeta (`onVista`), que la pinta en la barra de arriba sin
// escribir en el plan; el clic la elige, un solo paso deshacible.
//
// Teclado: un solo punto de tabulación (la elegida, o la primera); las flechas, Inicio y Fin mueven el foco y la vista
// previa; Enter o Espacio eligen. Elegir con cada flecha reescribiría los colores de varias preguntas por pulsación.

import { useRef, type KeyboardEvent } from "react";
import type { FilaPaleta } from "../../estilo/modeloPaletasConNombre";
import { ALCANCE_AJENA, alcanceDeLaPaleta, coloresConPaleta, muestrasEnOrden } from "./vistaPaleta";

type Props = {
  /** Las respuestas de esta pregunta y los colores que tienen hoy. */
  opciones: readonly string[];
  propios: Readonly<Record<string, string>>;
  paletas: readonly FilaPaleta[];
  /** La clave de la paleta que la pregunta usa hoy, o `null`. */
  enUso: string | null;
  /** Cuántas preguntas cambian al elegir otra (las de las mismas respuestas). */
  preguntas: number;
  onVista: (clave: string | null) => void;
  onElegir: (clave: string) => void;
};

export function MuestrasPaleta({ opciones, propios, paletas, enUso, preguntas, onVista, onElegir }: Props) {
  const grupo = useRef<HTMLDivElement>(null);
  // R6-3: las que nombran estas respuestas primero; las que no, al final y marcadas.
  const conClave = muestrasEnOrden(opciones, paletas.filter((p): p is FilaPaleta & { clave: string } => !!p.clave));
  const foco = Math.max(0, conClave.findIndex((m) => m.paleta.clave === enUso));

  const onTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const radios = [...(grupo.current?.querySelectorAll<HTMLButtonElement>("[role=radio]") ?? [])];
    const i = radios.findIndex((r) => r === document.activeElement);
    const paso = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    const extremo = e.key === "Home" ? 0 : e.key === "End" ? radios.length - 1 : null;
    if ((!paso && extremo === null) || !radios.length) return;
    e.preventDefault();
    radios[extremo ?? (Math.max(0, i) + paso + radios.length) % radios.length]?.focus();
  };

  return (
    <div ref={grupo} className="pulso-pg-muestras" role="radiogroup" aria-label="Usar la paleta" onKeyDown={onTecla}
      onMouseLeave={() => onVista(null)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onVista(null); }}
      data-qa-geometry-group="graficos/f6-paleta-muestras" data-qa-geometry-contract="intrinsic">
      {conClave.map(({ paleta: p, ajena }, i) => {
        const elegida = p.clave === enUso;
        const colores = coloresConPaleta(opciones, propios, p);
        const alcance = ajena && !elegida ? ALCANCE_AJENA : alcanceDeLaPaleta(elegida, preguntas);
        return (
          <button key={p.id} type="button" role="radio" aria-checked={elegida} tabIndex={i === foco ? 0 : -1}
            className={`pulso-pg-muestra${elegida ? " is-elegida" : ""}${ajena ? " is-ajena" : ""}`}
            aria-label={`${p.nombre}. ${ajena && !elegida ? "No nombra estas respuestas" : alcance}`}
            data-qa-geometry-member="paleta"
            onMouseEnter={() => onVista(p.clave)} onFocus={() => onVista(p.clave)}
            onClick={() => { if (!elegida) onElegir(p.clave); }}>
            <span className="pulso-pg-muestra-tira" aria-hidden="true">
              {opciones.map((o) => (
                <span key={o} className={colores[o] ? undefined : "is-vacio"} style={colores[o] ? { background: colores[o] } : undefined} />
              ))}
            </span>
            <span className="pulso-pg-muestra-nombre">{p.nombre}</span>
            <span className="pulso-pg-muestra-alcance" aria-hidden="true">{alcance}</span>
          </button>
        );
      })}
    </div>
  );
}
