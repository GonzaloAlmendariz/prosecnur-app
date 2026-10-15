// «Cómo se lee» al lado de cada regla (R8 del rediseño, 2026-10-15): lo que la regla produce en una lámina. La del
// redondeo es una lámina de ejemplo con sus barras, la suma de cada una y la nota cuando va; las demás, una línea grande
// y su explicación. Los cálculos viven en `modeloLecturaRegla.ts`.

import { cifra, type EjemploRedondeo, type Lectura } from "./modeloLecturaRegla";

export function LecturaRegla({ lectura, regla }: { lectura: Lectura; regla: string }) {
  return (
    <aside className="pulso-f6-lectura" aria-label={`Cómo se lee: ${regla}`}>
      <span className="pulso-f6-lectura-lab" aria-hidden="true">Cómo se lee</span>
      <output className="pulso-f6-lectura-grande">{lectura.grande}</output>
      <small>{lectura.detalle}</small>
    </aside>
  );
}

export function LecturaRedondeo({ ejemplo, decimales }: { ejemplo: EjemploRedondeo; decimales: number }) {
  return (
    <aside className="pulso-f6-lectura is-ejemplo" aria-label="Cómo se lee: redondeo y decimales">
      <span className="pulso-f6-lectura-lab" aria-hidden="true">Cómo se lee</span>
      <figure className="pulso-f6-lectura-lamina">
        <figcaption>Servicios de tutoría</figcaption>
        {ejemplo.filas.map((f) => (
          <div key={f.publico} className="pulso-f6-lectura-fila">
            <span>{f.publico}</span>
            <span className="pulso-f6-lectura-barra">
              {f.valores.map((v, i) => <i key={i} className={`is-s${i}`} style={{ flexBasis: `${v}%` }}>{cifra(v, decimales)}</i>)}
            </span>
            <span className={`pulso-f6-lectura-suma${f.cierra ? "" : " is-mal"}`}>{cifra(f.suma, decimales)} %</span>
          </div>
        ))}
        <p className="pulso-f6-lectura-pie">Base: 52 docentes, 172 estudiantes y 178 egresados.{ejemplo.lleva ? ` ${ejemplo.nota}` : ""}</p>
      </figure>
      <small>{ejemplo.motivo}</small>
    </aside>
  );
}
