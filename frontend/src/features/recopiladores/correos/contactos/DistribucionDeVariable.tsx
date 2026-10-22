// La distribución de los efectivos en una variable de control: una barra por
// categoría con su frecuencia y su porcentaje sobre la base del corte, y
// —cuando ya se leyó quién respondió— cuántos respondieron y su tasa.
//
// Clic en una categoría la agrega a los filtros (tablero y lista); otro clic la
// quita. La barra es la proporción sobre la base: lo que mide es lo que dice el %. «Sin dato» va al final y también filtra (el backend lee `""` como sin
// dato). «Otros» —el resto de una variable con muchos valores— no es un valor
// de la lista y no filtra.

import type { VariableDelPerfil } from "../../../../api/mailContactos";
import { formatoConteo, formatoConteoDe } from "../../../../lib/formatoNumero";
import {
  CATEGORIAS_A_LA_VISTA,
  VALOR_SIN_DATO,
  anchoDeBarra,
  categoriasDeLaTarjeta,
  cuadraConLaBase,
  estaFiltrada,
  formatoPorcentaje,
  proporcion,
  sumaDeLaVariable,
  tasaDe,
} from "./modeloContactos";
import { useContactosStore } from "./store";

type Props = {
  variable: VariableDelPerfil;
  base: number;
  conRespuestas: boolean;
};

type Fila = {
  clave: string;
  /** Valor que se manda en `filtros`; `null`: no filtra. */
  valorDelFiltro: string | null;
  rotulo: string;
  n: number;
  respondieron: number | null;
  sinDato: boolean;
};

export function DistribucionDeVariable({ variable, base, conRespuestas }: Props) {
  const filtros = useContactosStore((s) => s.filtros);
  const expandida = useContactosStore((s) => Boolean(s.expandidas[variable.key]));
  const alternarFiltro = useContactosStore((s) => s.alternarFiltro);
  const alternarExpandida = useContactosStore((s) => s.alternarExpandida);
  const { visibles, ocultas } = categoriasDeLaTarjeta(variable, expandida);
  const idTitulo = `rec-contactos-dist-${variable.key}`;
  const cuadra = cuadraConLaBase(variable, base);
  const columnas = conRespuestas ? " is-con-respuestas" : "";

  const filas: Fila[] = [
    ...visibles.map((c) => ({
      clave: `v:${c.valor}`,
      valorDelFiltro: c.otros ? null : c.valor,
      rotulo: c.valor,
      n: c.n,
      respondieron: c.respondieron,
      sinDato: false,
    })),
    ...(variable.sin_dato.n > 0 ? [{
      clave: "sin-dato",
      valorDelFiltro: VALOR_SIN_DATO,
      rotulo: "Sin dato",
      n: variable.sin_dato.n,
      respondieron: variable.sin_dato.respondieron,
      sinDato: true,
    }] : []),
  ];

  return (
    <article className="rec-contactos-dist" aria-labelledby={idTitulo} data-testid={`contactos-dist-${variable.key}`}>
      <header className="rec-contactos-dist-cabecera">
        <h3 id={idTitulo} className="rec-contactos-dist-titulo">{variable.label}</h3>
        <span className="rec-contactos-dist-meta">
          {formatoConteoDe(variable.categorias.length, "categoría")} · base {formatoConteo(base)}
        </span>
      </header>
      <div
        className={`rec-contactos-dist-fila rec-contactos-dist-fila--cabeza${columnas}`}
        aria-hidden
        // Los rótulos de columna: cada uno con el ancho de su columna (C1).
        data-qa-geometry-group={`material-campo/correo/contactos/columnas/${variable.key}`}
        data-qa-geometry-contract="intrinsic"
      >
        <span>Categoría</span>
        <span />
        <span className="is-num">Contactos</span>
        <span className="is-num">%</span>
        {conRespuestas ? <span className="is-num">Respondieron</span> : null}
      </div>
      <ul className="rec-contactos-dist-lista">
        {filas.map((f) => {
          const pct = formatoPorcentaje(proporcion(f.n, base));
          const tasa = tasaDe({ n: f.n, respondieron: f.respondieron });
          const clases = `rec-contactos-dist-fila${columnas}${f.sinDato ? " is-sin-dato" : ""}`;
          const celdas = (
            <>
              <span className="rec-contactos-dist-nombre" title={f.rotulo}>{f.rotulo}</span>
              <span className="rec-contactos-dist-pista" aria-hidden>
                <span className="rec-contactos-dist-relleno" style={{ width: `${anchoDeBarra(f.n, base)}%` }} />
                {conRespuestas && f.respondieron ? (
                  <span className="rec-contactos-dist-respondio" style={{ width: `${anchoDeBarra(f.respondieron, base)}%` }} />
                ) : null}
              </span>
              <span className="is-num">{formatoConteo(f.n)}</span>
              <span className="is-num rec-contactos-dist-pct">{pct}</span>
              {conRespuestas ? (
                <span className="is-num rec-contactos-dist-tasa">
                  {f.respondieron === null ? "—" : `${formatoConteo(f.respondieron)} · ${formatoPorcentaje(tasa)}`}
                </span>
              ) : null}
            </>
          );
          if (f.valorDelFiltro === null) {
            return <li key={f.clave}><div className={`${clases} is-otros`}>{celdas}</div></li>;
          }
          const valor = f.valorDelFiltro;
          const activa = estaFiltrada(filtros, variable.key, valor);
          const nombre = `${variable.label}: ${f.rotulo}. ${formatoConteo(f.n)} contactos, ${pct} de ${formatoConteo(base)}`
            + (conRespuestas && f.respondieron !== null ? `. Respondieron ${formatoConteo(f.respondieron)}, ${formatoPorcentaje(tasa)}` : "");
          return (
            <li key={f.clave}>
              <button
                type="button"
                className={`${clases}${activa ? " is-on" : ""}`}
                aria-pressed={activa}
                aria-label={`${nombre}. ${activa ? "Quitar filtro" : "Filtrar"}`}
                title={activa ? `Quitar el filtro «${f.rotulo}»` : `Filtrar por «${f.rotulo}»`}
                onClick={() => alternarFiltro(variable.key, valor)}
              >
                {celdas}
              </button>
            </li>
          );
        })}
      </ul>
      {variable.categorias.length > CATEGORIAS_A_LA_VISTA ? (
        <button
          type="button"
          className="rec-mail-link rec-contactos-dist-mas"
          aria-expanded={expandida}
          onClick={() => alternarExpandida(variable.key)}
        >
          {expandida ? "Ver solo las más frecuentes" : `Ver ${formatoConteoDe(ocultas, "categoría más", "categorías más")}`}
        </button>
      ) : null}
      {!cuadra ? (
        <p className="rec-contactos-aviso" role="status">
          Las categorías suman {formatoConteo(sumaDeLaVariable(variable))} y la base es {formatoConteo(base)}.
          Pulsa «Actualizar»; si sigue, vuelve a importar la lista.
        </p>
      ) : null}
    </article>
  );
}
