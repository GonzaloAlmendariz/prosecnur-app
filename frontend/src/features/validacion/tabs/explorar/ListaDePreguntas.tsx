import { useId, useMemo, useState } from "react";
import { Search } from "../../../../vendor/lucide-react";
import { PulsoInput } from "../../../../components/PulsoInput";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { ExploradorSeccion, ExploradorVariable } from "../../types";
import ChipsTipo from "./ChipsTipo";
import {
  TIPO_ETIQUETA,
  TIPO_TONO,
  UMBRAL_COMPLETITUD,
  coincide,
  completitud,
  conteoPorFamilia,
  enFamilia,
  type FamiliaTipo,
} from "./tiposVariable";

/**
 * La lista de preguntas de Explorar (prototipo `validacion-explorar`, panel
 * "Preguntas"): buscador con lupa, chips de tipo con su conteo y, por
 * sección (con su rótulo, sin plegar), cada pregunta con su texto arriba, el código debajo con el punto
 * de su tipo y la completitud en una barra a todo el ancho.
 */
export default function ListaDePreguntas({
  secciones,
  elegida,
  onElegir,
  repeatCode = null,
  repeatLabel = null,
}: {
  secciones: ExploradorSeccion[];
  elegida: string | null;
  onElegir: (v: ExploradorVariable) => void;
  repeatCode?: string | null;
  repeatLabel?: string | null;
}) {
  const [consulta, setConsulta] = useState("");
  const [familia, setFamilia] = useState<FamiliaTipo>("todas");
  const listaId = useId();

  const todas = useMemo(() => secciones.flatMap((s) => s.variables), [secciones]);
  const conteo = useMemo(() => conteoPorFamilia(todas), [todas]);
  const filtradas = useMemo(
    () =>
      secciones
        .map((s) => ({ ...s, variables: s.variables.filter((v) => enFamilia(v, familia) && coincide(v, consulta)) }))
        .filter((s) => s.variables.length > 0),
    [secciones, consulta, familia],
  );

  return (
    <div className="vx-preguntas">
      <div className="vx-busca">
        <Search size={14} aria-hidden />
        <PulsoInput
          size="sm"
          type="search"
          aria-label="Buscar preguntas"
          aria-controls={listaId}
          placeholder="Buscar por texto o código"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
        />
      </div>
      <ChipsTipo valor={familia} conteo={conteo} onCambio={setFamilia} etiqueta="Filtrar la lista por tipo" />
      <div className="vx-preguntas-lista" id={listaId}>
        {filtradas.length === 0 && (
          <p role="status" className="vx-barra-nota">
            {!secciones.length
              ? "Sin preguntas en esta base."
              : consulta.trim()
                ? `Ninguna pregunta coincide con "${consulta.trim()}".`
                : "Ninguna pregunta de este tipo."}
          </p>
        )}
        {filtradas.map((sec, i) => {
          const seccionId = `${listaId}-seccion-${i}`;
          return (
            <div key={sec.nombre} className="vx-preguntas-seccion">
              <h5 className="vx-preguntas-grupo" id={seccionId}>
                <span>{sec.nombre}</span>
                <span>{formatoConteo(sec.variables.length)}</span>
              </h5>
              <ul aria-labelledby={seccionId} data-qa-geometry-group="validacion/explorar-preguntas" data-qa-geometry-contract="intrinsic">
                {sec.variables.map((v) => (
                  <li key={v.name}>
                    <FilaPregunta
                      v={v}
                      elegida={v.name === elegida}
                      onClick={() => onElegir(v)}
                      especifica={v.repeat_scope === "conditional" ? (repeatCode && repeatLabel ? `Variable específica de ${repeatLabel}` : "Variable condicional según el servicio") : null}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilaPregunta({
  v,
  elegida,
  onClick,
  especifica,
}: {
  v: ExploradorVariable;
  elegida: boolean;
  onClick: () => void;
  especifica: string | null;
}) {
  const frac = completitud(v);
  const pct = frac === null ? null : Math.round(frac * 100);
  const baja = frac !== null && frac < UMBRAL_COMPLETITUD;
  const texto = v.label || v.name;
  const tipo = TIPO_ETIQUETA[v.tipo] ?? TIPO_ETIQUETA.mixto;
  return (
    <button type="button" className="vx-pregunta-fila" aria-current={elegida ? "true" : undefined} onClick={onClick} title={texto}>
      <b>{texto}</b>
      {pct !== null && <em>{pct} %</em>}
      <span className="vx-pregunta-codigo">
        <i className="vx-tp" data-tono={TIPO_TONO[v.tipo]} title={tipo.larga} aria-label={tipo.larga} role="img" />
        {texto !== v.name ? <code>{v.name}</code> : <span>{tipo.larga}</span>}
        {especifica && <span className="pulso-variable-repeat-scope" title={especifica}>Específica</span>}
      </span>
      {pct !== null && (
        <span className={`vx-pregunta-av${baja ? " is-baja" : ""}`} aria-label={`${pct} % de casos con dato`} role="img">
          <i style={{ width: `${pct}%` }} />
        </span>
      )}
    </button>
  );
}
