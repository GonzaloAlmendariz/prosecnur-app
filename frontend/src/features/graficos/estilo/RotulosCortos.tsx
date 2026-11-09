// Identidad › Rótulos cortos (U3, 2026-11-05; ranking del ADR 0141, 2026-11-09). Dirección:
// `/procesamiento?seccion=graficos&pestana=identidad&foco=rotulos`. Dos rankings por base, del rótulo más largo al más
// corto: "Preguntas" y "Categorías". Cada fila: el rótulo completo, su largo, en cuántas láminas sale y el campo "Rótulo
// corto". Enter o salir del campo guarda por POST /api/graficos/rotulos; la respuesta vuelve al store del plan.
// Sólo Gráficos: Analítica conserva su propia revisión de etiquetas.
//
// Un solo dueño de desplazamiento (C4): el cuerpo de la pestaña. La lista no tiene alto propio.

import { useEffect, useId, useMemo } from "react";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { Panel } from "../../../components/Panel";
import { Alert } from "../../../components/Alert";
import { EstadoChip } from "../../../components/EstadoChip";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { formatoConteo } from "../../../lib/formatoNumero";
import { useSession } from "../../../lib/SessionContext";
import { Search, Trash2, Type } from "../../../vendor/lucide-react";
import { usePlanStore } from "../store";
import { RadioSegmentado } from "../subpestanas/RadioSegmentado";
import {
  baseInicial,
  categoriasHuerfanas,
  claveFila,
  filasRanking,
  filtrarFilas,
  textoAviso,
  type FilaRanking,
  type TipoRanking,
} from "./modeloRotulosCortos";
import { useRotulosCortosUi } from "./rotulosCortosStore";
import "./rotulosCortos.css";

const usosTexto = (n: number) => (n === 0 ? "Sin láminas" : n === 1 ? "En 1 lámina" : `En ${formatoConteo(n)} láminas`);

function FilaRotulo({ fila, huerfana = false }: { fila: FilaRanking; huerfana?: boolean }) {
  const id = useId();
  const k = claveFila(fila.tipo, fila.clave);
  const borrador = useRotulosCortosUi((s) => s.borradores[k]);
  const error = useRotulosCortosUi((s) => s.errores[k] ?? "");
  const guardando = useRotulosCortosUi((s) => !!s.guardando[k]);
  const setBorrador = useRotulosCortosUi((s) => s.setBorrador);
  const descartar = useRotulosCortosUi((s) => s.descartar);
  const guardar = useRotulosCortosUi((s) => s.guardar);
  const valor = borrador ?? fila.corto;
  const n = valor.trim().length;
  const ayuda = error || (guardando ? "Guardando…" : n ? `${formatoConteo(n)} de ${formatoConteo(fila.largo)} caracteres.` : "");

  return (
    <li className={error ? "pulso-rc-fila is-error" : "pulso-rc-fila"} data-fila={fila.clave} data-qa-geometry-member>
      <div className="pulso-rc-original">
        <span id={`${id}-et`} className="pulso-rc-largo">{fila.etiqueta}</span>
        <span className="pulso-rc-meta">
          {fila.detalle ? <span className="pulso-rc-detalle">{fila.detalle}</span> : null}
          <span>{formatoConteo(fila.largo)} caracteres</span>
          {huerfana ? null : <span>{usosTexto(fila.usos)}</span>}
        </span>
        {huerfana ? <EstadoChip tone="warn" label="No está en el formulario" detail="Ninguna base trae hoy esta categoría: el corto no se aplica." /> : null}
        {fila.sugerencia ? (
          <span className="pulso-rc-sugerida">
            En un gráfico: {`"${fila.sugerencia}"`}
            <PulsoButton variant="ghost" size="sm" onClick={() => { setBorrador(fila, fila.sugerencia ?? ""); document.getElementById(`${id}-in`)?.focus(); }}
              aria-label={`Usar "${fila.sugerencia}" como rótulo corto`}>
              Usar
            </PulsoButton>
          </span>
        ) : null}
      </div>
      <div className="pulso-rc-campo">
        <label htmlFor={`${id}-in`} className="pulso-rc-campo-rotulo">Rótulo corto</label>
        <div className="pulso-rc-campo-fila">
          <PulsoInput
            id={`${id}-in`}
            size="sm"
            className="pulso-rc-input"
            value={valor}
            invalid={!!error}
            disabled={guardando}
            aria-describedby={`${id}-et ${id}-ayuda`}
            onChange={(e) => setBorrador(fila, e.target.value)}
            onBlur={() => { if (borrador !== undefined) void guardar(fila, borrador); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void guardar(fila, valor); }
              if (e.key === "Escape") descartar(fila);
            }}
          />
          {fila.corto ? (
            <PulsoButton variant="icon" size="sm" intent="remove" disabled={guardando}
              aria-label={`Quitar el rótulo corto "${fila.corto}"`} onClick={() => void guardar(fila, "")}>
              <Trash2 size={14} aria-hidden="true" />
            </PulsoButton>
          ) : null}
        </div>
        <p id={`${id}-ayuda`} className={error ? "pulso-rc-ayuda is-error" : "pulso-rc-ayuda"} role={error ? "alert" : undefined}>{ayuda}</p>
      </div>
    </li>
  );
}

export function RotulosCortos() {
  const rc = usePlanStore((s) => s.plan.rotulos_cortos);
  const { state } = useSession();
  const ranking = useRotulosCortosUi((s) => s.ranking);
  const cargando = useRotulosCortosUi((s) => s.cargando);
  const errorCarga = useRotulosCortosUi((s) => s.errorCarga);
  const elegida = useRotulosCortosUi((s) => s.base);
  const tipo = useRotulosCortosUi((s) => s.tipo);
  const consulta = useRotulosCortosUi((s) => s.consulta);
  const avisos = useRotulosCortosUi((s) => s.avisos);
  const { cargar, setBase, setTipo, setConsulta } = useRotulosCortosUi.getState();
  const tituloId = useId();
  const buscarId = useId();

  useEffect(() => { void cargar(); }, [cargar, state?.session_id, state?.active_base]);

  const base = baseInicial(ranking, state?.active_base, elegida);
  const datosBase = ranking?.bases.find((b) => b.base === base);
  const filas = useMemo(() => filasRanking(datosBase, tipo, rc), [datosBase, tipo, rc]);
  const visibles = useMemo(() => filtrarFilas(filas, consulta), [filas, consulta]);
  const huerfanas = useMemo(() => (tipo === "categorias" ? filtrarFilas(categoriasHuerfanas(rc, ranking), consulta) : []), [tipo, rc, ranking, consulta]);
  const nPreguntas = datosBase?.preguntas.length ?? 0;
  const nCategorias = datosBase?.opciones.length ?? 0;
  const etiquetaDe = (ref: string) => datosBase?.preguntas.find((p) => p.ref === ref)?.etiqueta ?? ref;
  const esperando = cargando && !ranking;

  return (
    <section className="pulso-rc" aria-labelledby={tituloId} data-seccion="rotulos-cortos"
      data-audit-ready={esperando ? "false" : errorCarga && !ranking ? "vacio:ranking-ilegible" : "graficos-rotulos-cortos"}>
      <header className="pulso-rc-cabecera">
        <h3 id={tituloId} className="pulso-rc-titulo">Rótulos cortos</h3>
        <p className="pulso-rc-bajada">
          Del rótulo más largo al más corto. El rótulo corto reemplaza al completo en las láminas del PPT y el Word; no
          cambia Analítica. El nombre corto escrito en un gráfico le gana al de esta lista.
        </p>
      </header>

      {errorCarga ? <ErrorBlock label="No se pudo leer el ranking de rótulos" detail={errorCarga} /> : null}
      {esperando ? <LoadingBlock label="Leyendo los rótulos del formulario…" /> : null}

      {ranking ? (
        <div className="pulso-rc-barra">
          <RadioSegmentado<TipoRanking> etiqueta="Ranking" valor={tipo} onCambiar={setTipo}
            opciones={[
              { clave: "preguntas", rotulo: `Preguntas ${formatoConteo(nPreguntas)}`, titulo: `Preguntas (${formatoConteo(nPreguntas)})` },
              { clave: "categorias", rotulo: `Categorías ${formatoConteo(nCategorias)}`, titulo: `Categorías (${formatoConteo(nCategorias)})` },
            ]} />
          {ranking.bases.length > 1 && base ? (
            <span className="pulso-rc-base">
              <PulsoSelect size="sm" ariaLabel="Base" value={base} onValueChange={setBase}
                options={ranking.bases.map((b) => ({ value: b.base, label: b.base }))} />
            </span>
          ) : null}
          <span className="pulso-rc-buscar">
            <Search size={14} aria-hidden="true" />
            <input id={buscarId} type="search" value={consulta} onChange={(e) => setConsulta(e.target.value)}
              aria-label={tipo === "preguntas" ? "Buscar una pregunta" : "Buscar una categoría"}
              placeholder={tipo === "preguntas" ? "Buscar una pregunta" : "Buscar una categoría"} />
          </span>
        </div>
      ) : null}

      {avisos.length ? (
        <Alert kind="warn">
          <ul className="pulso-rc-avisos">
            {avisos.map((a) => <li key={`${a.tipo}-${a.base}-${a.corto}`}>{textoAviso(a, a.tipo === "preguntas" ? etiquetaDe : (r) => r)}</li>)}
          </ul>
        </Alert>
      ) : null}

      {ranking ? (
        visibles.length ? (
          <Panel noPadding aria-label={tipo === "preguntas" ? "Preguntas por largo del rótulo" : "Categorías por largo del rótulo"}>
            <ol className="pulso-rc-lista" data-qa-geometry-group="graficos/identidad-rotulos-cortos" data-qa-geometry-contract="intrinsic">
              {visibles.map((f) => <FilaRotulo key={claveFila(f.tipo, f.clave)} fila={f} />)}
            </ol>
          </Panel>
        ) : (
          <EmptyState icon={<Type size={20} aria-hidden="true" />}
            title={consulta.trim() ? "Ninguna coincide" : tipo === "preguntas" ? "Sin preguntas con rótulo" : "Sin categorías con rótulo"}
            hint={consulta.trim() ? "Prueba con otra palabra." : "Esta base no trae rótulos de ese tipo en su formulario."} />
        )
      ) : null}

      {huerfanas.length ? (
        <Panel noPadding aria-label="Categorías que no están en el formulario">
          <ul className="pulso-rc-lista" data-qa-geometry-group="graficos/identidad-rotulos-huerfanos" data-qa-geometry-contract="intrinsic">
            {huerfanas.map((f) => <FilaRotulo key={claveFila(f.tipo, f.clave)} fila={f} huerfana />)}
          </ul>
        </Panel>
      ) : null}
    </section>
  );
}
