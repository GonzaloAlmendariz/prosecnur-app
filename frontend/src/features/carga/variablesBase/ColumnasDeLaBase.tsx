// «Columnas que trae la base» (ADR 0106, punto 1): las columnas de la data que
// el formulario no declara. Se marcan, se ajusta su etiqueta (y las de sus
// opciones, si es categórica) y se incorporan de una vez. La lógica vive en
// `variablesBaseModel`.

import { useMemo, useReducer, useState } from "react";
import type { ColumnaADeclarar, ColumnaPropia } from "../../../api/baseVariables";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import { CheckCircle2, ChevronDown, ChevronUp, ListPlus, Search, X } from "../../../vendor/lucide-react";
import { normalizarBusqueda } from "../preguntaEquivalenteModel";
import {
  BORRADOR_COLUMNAS_VACIO,
  ROTULO_TIPO,
  columnasADeclarar,
  etiquetaEditada,
  opcionesEditadas,
  opcionesSinEtiqueta,
  reducirColumnas,
  resumenOpciones,
  separarColumnas,
  textoIncorporar,
  type AccionColumnas,
  type BorradorColumnas,
} from "./variablesBaseModel";
import type { MensajeVariablesBase } from "./useVariablesBase";

/** Con más columnas que esto aparece el buscador. */
const UMBRAL_BUSCADOR = 8;

export type ColumnasDeLaBaseProps = {
  extras: readonly ColumnaPropia[];
  ocupado: boolean;
  mensaje: MensajeVariablesBase | null;
  onIncorporar: (columnas: ColumnaADeclarar[]) => Promise<boolean>;
  onQuitar: (name: string) => void;
};

export function ColumnasDeLaBase({ extras, ocupado, mensaje, onIncorporar, onQuitar }: ColumnasDeLaBaseProps) {
  const [borrador, despachar] = useReducer(reducirColumnas, BORRADOR_COLUMNAS_VACIO);
  const [consulta, setConsulta] = useState("");
  const { pendientes, incorporadas } = useMemo(() => separarColumnas(extras), [extras]);
  const visibles = useMemo(() => {
    const palabras = normalizarBusqueda(consulta).split(/\s+/).filter(Boolean);
    if (!palabras.length) return pendientes;
    return pendientes.filter((c) => {
      const t = normalizarBusqueda(`${c.name} ${c.label}`);
      return palabras.every((p) => t.includes(p));
    });
  }, [consulta, pendientes]);
  const aEnviar = columnasADeclarar(extras, borrador);
  const todasMarcadas = visibles.length > 0 && visibles.every((c) => borrador.marcadas.includes(c.name));

  const incorporar = async () => {
    if (await onIncorporar(aEnviar)) despachar({ tipo: "reiniciar" });
  };

  return (
    <section className="pulso-armon-seccion" aria-labelledby="pulso-vb-columnas" data-qa-geometry-member>
      <div className="pulso-armon-seccion-head">
        <div className="pulso-armon-seccion-titulo">
          <h3 id="pulso-vb-columnas">
            Columnas que trae la base
            {extras.length > 0 && <small>{formatoConteo(extras.length)}</small>}
          </h3>
          <p className="pulso-armon-ayuda">Están en la data, pero no en el formulario.</p>
        </div>
      </div>

      {extras.length === 0 ? (
        // C5 categoría 1: vacío legítimo, la data no trae nada fuera del formulario.
        <p className="pulso-armon-vacio">La base no trae columnas fuera del formulario.</p>
      ) : (
        <>
          {pendientes.length > 0 && (
            <>
              <div className="pulso-vb-barra">
                <label className="pulso-vb-todas">
                  <input
                    type="checkbox"
                    checked={todasMarcadas}
                    disabled={visibles.length === 0}
                    onChange={(e) => despachar({ tipo: "todas", names: visibles.map((c) => c.name), marcada: e.currentTarget.checked })}
                  />
                  {consulta.trim() ? "Marcar las que casan" : "Marcar todas"}
                </label>
                {pendientes.length > UMBRAL_BUSCADOR && (
                  <label className="pulso-vb-buscar">
                    <Search size={13} aria-hidden="true" />
                    <span className="pulso-sr-only">Buscar columna</span>
                    <input type="search" value={consulta} placeholder="Buscar columna" onChange={(e) => setConsulta(e.target.value)} />
                  </label>
                )}
              </div>
              {visibles.length === 0 ? (
                <p className="pulso-armon-nota">Ninguna columna casa con «{consulta.trim()}».</p>
              ) : (
                <ul className="pulso-vb-columnas" aria-label="Columnas por incorporar">
                  {visibles.map((c) => (
                    <ColumnaPendiente
                      key={c.name}
                      columna={c}
                      borrador={borrador}
                      marcada={borrador.marcadas.includes(c.name)}
                      despachar={despachar}
                    />
                  ))}
                </ul>
              )}
              <div className="pulso-vb-acciones">
                {mensaje && (
                  <span className={mensaje.tono === "error" ? "pulso-armon-error" : "pulso-vb-ok"} role={mensaje.tono === "error" ? "alert" : "status"}>
                    {mensaje.texto}
                  </span>
                )}
                <PulsoButton
                  variant="primary"
                  size="sm"
                  className="pulso-armon-btn"
                  disabled={ocupado || aEnviar.length === 0}
                  onClick={() => void incorporar()}
                >
                  <ListPlus size={14} aria-hidden="true" />
                  {ocupado ? "Incorporando…" : textoIncorporar(aEnviar.length)}
                </PulsoButton>
              </div>
            </>
          )}

          {pendientes.length === 0 && mensaje && (
            <p className={mensaje.tono === "error" ? "pulso-armon-error" : "pulso-vb-ok"} role={mensaje.tono === "error" ? "alert" : "status"}>
              {mensaje.texto}
            </p>
          )}

          {incorporadas.length > 0 && (
            <ul className="pulso-vb-columnas is-incorporadas" aria-label="Columnas incorporadas">
              {incorporadas.map((c) => (
                <li key={c.name} className="pulso-vb-columna">
                  <div className="pulso-vb-columna-fila">
                    <span className="pulso-vb-incorporada"><CheckCircle2 size={13} aria-hidden="true" />Incorporada</span>
                    <code className="pulso-vb-nombre">{c.name}</code>
                    <span className="pulso-vb-etiqueta">{c.label}</span>
                    <span className="pulso-vb-tipo">{ROTULO_TIPO[c.tipo]}</span>
                    <PulsoButton
                      variant="ghost"
                      size="sm"
                      className="pulso-armon-btn"
                      disabled={ocupado}
                      aria-label={`Quitar ${c.name} de las incorporadas`}
                      onClick={() => onQuitar(c.name)}
                    >
                      <X size={13} aria-hidden="true" />
                      Quitar
                    </PulsoButton>
                  </div>
                  {c.opciones.length > 0 && <p className="pulso-vb-opciones-resumen">{resumenOpciones(c.opciones, 5)}</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function ColumnaPendiente({
  columna: c,
  borrador,
  marcada,
  despachar,
}: {
  columna: ColumnaPropia;
  borrador: BorradorColumnas;
  marcada: boolean;
  despachar: (a: AccionColumnas) => void;
}) {
  const [abiertas, setAbiertas] = useState(false);
  const idOpciones = `pulso-vb-opciones-${c.name.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const sinEtiqueta = opcionesSinEtiqueta(c.opciones);
  const editadas = opcionesEditadas(borrador, c);
  return (
    <li className={marcada ? "pulso-vb-columna is-marcada" : "pulso-vb-columna"}>
      <div className="pulso-vb-columna-fila">
        <input
          type="checkbox"
          className="pulso-vb-marca"
          checked={marcada}
          aria-label={`Incorporar ${c.name}`}
          onChange={(e) => despachar({ tipo: "marcar", name: c.name, marcada: e.currentTarget.checked })}
        />
        <code className="pulso-vb-nombre">{c.name}</code>
        <input
          className="pulso-vb-etiqueta-input"
          value={etiquetaEditada(borrador, c)}
          aria-label={`Etiqueta de ${c.name}`}
          onChange={(e) => despachar({ tipo: "etiqueta", name: c.name, valor: e.target.value })}
        />
        <span className="pulso-vb-tipo">{ROTULO_TIPO[c.tipo]}</span>
        <span className="pulso-vb-validos">{formatoConteoDe(c.n_validos, "válido", "válidos")}</span>
      </div>
      {c.tipo === "select_one" && c.opciones.length > 0 && (
        <div className="pulso-vb-opciones">
          <p className="pulso-vb-opciones-resumen">
            {resumenOpciones(editadas)}
            {sinEtiqueta && !abiertas && <span className="pulso-vb-sin-etiqueta"> · sin etiquetas</span>}
          </p>
          <button
            type="button"
            className="pulso-vb-enlace"
            aria-expanded={abiertas}
            aria-controls={idOpciones}
            onClick={() => setAbiertas((v) => !v)}
          >
            {abiertas ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
            {sinEtiqueta ? "Escribir etiquetas" : "Editar etiquetas"}
          </button>
          {abiertas && (
            <ol id={idOpciones} className="pulso-vb-opciones-lista" aria-label={`Opciones de ${c.name}`}>
              {c.opciones.map((o) => (
                <li key={o.codigo}>
                  <code>{o.codigo}</code>
                  <input
                    value={borrador.opciones[c.name]?.[o.codigo] ?? (o.etiqueta === o.codigo ? "" : o.etiqueta)}
                    placeholder={o.codigo}
                    aria-label={`Etiqueta del código ${o.codigo} de ${c.name}`}
                    onChange={(e) => despachar({ tipo: "opcion", name: c.name, codigo: o.codigo, valor: e.target.value })}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}
