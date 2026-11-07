// La cápsula ▲A de la lámina en la UI (propuesta de significancia §4.3): fondo `banda_clara`, triángulo y letras en
// `azul`; la frágil, con contorno punteado en el azul medio. El triángulo es un trazo, no el carácter ▲ (la fuente no lo
// garantiza). El nombre accesible dice lo que significa, no el glifo.

import "../../../../app/tokens-datos.css";
import "./diferencias.css";

type Props = {
  letras: string;
  fragil?: boolean;
  /** ▼ en «frente al resto» cuando el grupo queda por debajo. */
  menor?: boolean;
  /** Sin nombre propio: el texto de al lado ya lo dice. */
  decorativa?: boolean;
};

export function nombreCapsula(letras: string, fragil = false, menor = false): string {
  const quien = letras.trim() && letras !== "resto" ? `el grupo ${letras.split("").join(", ")}` : "el resto";
  return `${fragil ? "Diferencia frágil: " : ""}${menor ? "menor" : "mayor"} que ${quien}`;
}

export function Capsula({ letras, fragil = false, menor = false, decorativa = false }: Props) {
  return (
    <span
      className={`pulso-sig-capsula${fragil ? " is-fragil" : ""}`}
      {...(decorativa ? { "aria-hidden": true } : { role: "img", "aria-label": nombreCapsula(letras, fragil, menor) })}
    >
      <svg className="pulso-sig-capsula-tri" viewBox="0 0 10 9" aria-hidden="true" focusable="false">
        <path d={menor ? "M0 0h10L5 9z" : "M5 0l5 9H0z"} />
      </svg>
      {letras && letras !== "resto" ? <span className="pulso-sig-capsula-letras">{letras}</span> : null}
    </span>
  );
}
