// Cuerpo de «Comparar fuentes» (ADR 0102): dos bases ligadas a la misma
// revisión del formulario, lado a lado. Primero quiénes son y cuánto traen;
// luego tres contadores pares; el aviso si una carga perdió categorías; las
// variables distintas con sus barras emparejadas y, plegadas, las iguales.

import type { ComparacionFuentes, FuenteComparada } from "../../../api/cargaArmonizacion";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import { AlertTriangle, ChevronDown, Loader2 } from "../../../vendor/lucide-react";
import {
  avisosPerdidas,
  nombresDeLados,
  ordenarVariables,
  rotuloCasos,
  rotuloDatos,
  rotuloDiferenciaFilas,
  rotuloTipoFuente,
} from "./compararFuentesModel";
import { VariableComparadaTarjeta } from "./VariableComparadaTarjeta";
import "./compararFuentes.css";

export type CargaComparacion =
  | { tipo: "cargando" }
  | { tipo: "listo"; datos: ComparacionFuentes }
  | { tipo: "error"; mensaje: string };

function TarjetaFuente({ fuente, lado }: { fuente: FuenteComparada; lado: "a" | "b" }) {
  const datos = rotuloDatos(fuente.datos);
  return (
    <div className={`pulso-cf-fuente is-${lado}`} data-qa-geometry-member>
      <span className="pulso-cf-fuente-lado" aria-hidden="true">{lado.toUpperCase()}</span>
      <div className="pulso-cf-fuente-texto">
        <strong>{fuente.nombre}</strong>
        <span className="pulso-cf-fuente-meta">
          <span>{rotuloTipoFuente(fuente.fuente)}</span>
          {datos ? <span className={`pulso-cf-datos is-${fuente.datos}`}>{datos}</span> : null}
        </span>
      </div>
      <span className="pulso-cf-fuente-n">
        <strong>{formatoConteo(fuente.n_filas)}</strong>
        <small>respuestas</small>
      </span>
    </div>
  );
}

export function CompararFuentesVista({ carga }: { carga: CargaComparacion }) {
  if (carga.tipo === "cargando") {
    return (
      <div className="pulso-plf-estado" role="status" data-qa-geometry-capacity="owned">
        <Loader2 size={16} aria-hidden="true" className="pulso-bfp-giro" />
        <p>Comparando las dos fuentes…</p>
      </div>
    );
  }
  if (carga.tipo === "error") {
    return (
      <div className="pulso-plf-estado is-error" role="alert" data-qa-geometry-capacity="owned">
        <strong>No se pudo comparar</strong>
        <p>{carga.mensaje}</p>
      </div>
    );
  }
  const comp = carga.datos;
  const lados = nombresDeLados(comp.base_a, comp.base_b);
  const casos = rotuloCasos(comp.casos, lados);
  const filas = rotuloDiferenciaFilas(comp.resumen.diferencia_filas, lados);
  const avisos = avisosPerdidas(comp);
  const { destacadas, iguales } = ordenarVariables(comp.variables);
  const contadores = [
    { clave: "iguales", rotulo: "Iguales", valor: comp.resumen.n_iguales, ayuda: "Misma distribución en las dos" },
    { clave: "distintas", rotulo: "Distintas", valor: comp.resumen.n_distintas, ayuda: "La distribución difiere" },
    { clave: "exclusivas", rotulo: "Con categorías propias", valor: comp.resumen.n_con_categorias_exclusivas, ayuda: "Variables con categorías que la otra no tiene" },
  ];

  return (
    <>
      <section className="pulso-cf-encabezado" aria-label="Las dos fuentes">
        <div className="pulso-cf-fuentes" data-qa-geometry-group="carga/comparar-fuentes/fuentes" data-qa-geometry-contract="equal">
          <TarjetaFuente fuente={comp.base_a} lado="a" />
          <TarjetaFuente fuente={comp.base_b} lado="b" />
        </div>
        {casos || filas ? (
          <p className="pulso-cf-casos">
            {casos ? <span>{casos}{comp.casos ? <small> · cruzadas por «{comp.casos.clave}»</small> : null}</span> : null}
            {!casos && filas ? <span>{filas}</span> : null}
          </p>
        ) : null}
      </section>

      <dl className="pulso-cf-contadores" data-qa-geometry-group="carga/comparar-fuentes/contadores" data-qa-geometry-contract="equal">
        {contadores.map((c) => (
          <div key={c.clave} className={`pulso-cf-contador is-${c.clave}${c.valor ? " has-valor" : ""}`} data-qa-geometry-member>
            <dt>{c.rotulo}</dt>
            <dd>{formatoConteo(c.valor)}</dd>
            <small>{c.ayuda}</small>
          </div>
        ))}
      </dl>

      {avisos.map((aviso) => (
        <div key={aviso.lado} className="pulso-cf-aviso" role="note">
          <AlertTriangle size={16} aria-hidden="true" />
          <div className="pulso-cf-aviso-texto">
            <strong>{aviso.titulo}</strong>
            <ul aria-label="Categorías que se quedaron fuera al cargar">
              {aviso.items.map((it) => (
                <li key={it.clave}>
                  <span className="pulso-cf-var-codigo">{it.variable}</span> {it.etiqueta}{" "}
                  <span className="pulso-cf-aviso-n">{formatoConteoDe(it.n, "respuesta")}</span>
                </li>
              ))}
            </ul>
            <span>Agrégalas al formulario y vuelve a publicar; luego vuelve a cargar esta base para conservarlas.</span>
          </div>
        </div>
      ))}

      {destacadas.length ? (
        <section className="pulso-cf-lista" aria-labelledby="pulso-cf-distintas">
          <h3 id="pulso-cf-distintas" className="pulso-cf-lista-titulo">
            Variables que difieren <span>({formatoConteo(destacadas.length)})</span>
          </h3>
          <p className="pulso-cf-lista-nota">
            Porcentajes sobre las respuestas válidas de cada fuente, con los códigos especiales incluidos; en las de
            opción múltiple, sobre quienes respondieron la pregunta.
          </p>
          <div className="pulso-cf-variables" data-qa-geometry-group="carga/comparar-fuentes/variables" data-qa-geometry-contract="intrinsic">
            {destacadas.map((v) => <VariableComparadaTarjeta key={v.variable} variable={v} lados={lados} />)}
          </div>
        </section>
      ) : (
        // C5: vacío legítimo. Ninguna variable difiere entre las dos fuentes.
        <div className="pulso-plf-estado" role="status" data-qa-geometry-capacity="owned">
          <strong>Las dos fuentes coinciden</strong>
          <p>
            {comp.variables.length
              ? "Todas las variables tienen la misma distribución en las dos bases."
              : "La revisión no tiene variables con datos en estas bases para comparar."}
          </p>
        </div>
      )}

      {iguales.length ? (
        <details className="pulso-cf-iguales">
          <summary>
            <ChevronDown size={14} aria-hidden="true" className="pulso-cf-iguales-flecha" />
            Variables iguales <span>({formatoConteo(iguales.length)})</span>
          </summary>
          <ul>
            {iguales.map((v) => (
              <li key={v.variable}>
                <span className="pulso-cf-var-codigo">{v.variable}</span>
                <span className="pulso-cf-iguales-etiqueta">{v.etiqueta || "Sin etiqueta"}</span>
                <span className="pulso-cf-validos">Válidos {formatoConteo(v.n_validos_a)} · {formatoConteo(v.n_validos_b)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
