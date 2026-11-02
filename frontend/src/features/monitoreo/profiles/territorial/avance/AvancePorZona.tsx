import { Info } from "lucide-react";

import { fmt } from "../rotulos";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { ejesDeLaMatriz, type AvancePorZona as Modelo, type Zona } from "./porZonaModelo";
import "./faltante.css";
import "./porZona.css";

function Matriz({ zona }: { zona: Zona }) {
  const { sexos, rangos } = ejesDeLaMatriz(zona);
  const celda = (sexo: string, rango: string) => zona.celdas.find((c) => c.sexo === sexo && c.rangoEdad === rango);
  return (
    <table className="mon-pz-matriz" aria-label={`Cuota por celda de ${zona.nombre}`}>
      <thead>
        <tr>
          <th scope="col">Sexo</th>
          {rangos.map((r) => <th key={r} scope="col" className="is-celda">{r}</th>)}
        </tr>
      </thead>
      <tbody>
        {sexos.map((s) => (
          <tr key={s}>
            <th scope="row">{s}</th>
            {rangos.map((r) => {
              const c = celda(s, r);
              if (!c) return <td key={r} className="is-celda">—</td>;
              return (
                <td key={r} className="is-celda">
                  <span
                    className={`mon-falt-celda ${c.falta > 0 ? "is-falta" : "is-cumple"}`}
                    title={c.enObservacion ? `${fmt(c.enObservacion)} en observación` : undefined}
                  >
                    {`${fmt(c.efectivas)} de ${fmt(c.meta)}`}
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Avance › Faltante con un envío por cuotas (ADR 0125 A1). No hay UMP: Hojas de
 * ruta envía zonas con su N y su cuota por celda (sexo × rango de edad), y el
 * avance se mide ahí, con las mismas efectivas del resto del avance (las en
 * observación incluidas). Si Material repartió una zona entre varias personas,
 * cada una lleva su parte.
 */
export function AvancePorZona({ modelo }: { modelo: Modelo }) {
  return (
    <section className="mon-falt mon-pz" aria-label="Avance por zona" data-audit-ready="monitoreo-territorial-avance-cuotas">
      <div className="mon-falt-panel mon-pz-resumen">
        {/* Por cuotas no hay UMP: la pestaña Faltante dice lo que muestra. */}
        <RotuloDePestana titulo="Avance por zona" />
        <p className="mon-pz-cifra">
          <strong>{fmt(modelo.efectivas)}</strong> de {fmt(modelo.meta)} efectivas
          <span> · {fmt(modelo.celdasCompletas)} de {fmt(modelo.celdas)} celdas completas</span>
        </p>
        <p className="mon-pz-nota">
          <Info size={14} aria-hidden="true" /> La muestra se envió por cuotas: el avance va por zona y por celda, no por UMP.
          {modelo.sinZona || modelo.sinCelda
            ? ` ${fmt(modelo.sinZona)} fuera de las zonas y ${fmt(modelo.sinCelda)} sin celda (sin sexo o edad legible, o fuera de los rangos).`
            : ""}
        </p>
      </div>
      <div className="mon-pz-zonas" data-qa-geometry-group="territorial-avance-zonas" data-qa-geometry-contract="intrinsic">
        {modelo.zonas.map((zona) => (
          <article key={zona.idZona} className="mon-falt-panel mon-pz-zona" data-qa-geometry-member>
            <header className="mon-pz-cabecera">
              <h3>{zona.nombre}</h3>
              <span className={zona.efectivas >= zona.meta ? "is-cumple" : "is-falta"}>
                {fmt(zona.efectivas)} de {fmt(zona.meta)}
              </span>
            </header>
            <Matriz zona={zona} />
            {zona.personas.length ? (
              <ul className="mon-pz-personas" aria-label={`Quién levanta ${zona.nombre}`}>
                {zona.personas.map((p) => (
                  <li key={p.codigo}>
                    <b>{p.codigo}</b> {fmt(p.efectivas)}{p.parte != null ? ` de ${fmt(p.parte)}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
