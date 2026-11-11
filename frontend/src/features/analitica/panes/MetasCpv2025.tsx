// Metas de calibración desde el CPV 2025 (ADR 0131 paso 5).
//
// El analista elige el ámbito (todo el conjunto, unas provincias o unos
// distritos), sus grupos de edad y la agrupación del nivel educativo; el
// backend agrega la población censada. Luego mapea cada categoría de su base a
// una del censo y las metas pasan al margen como conteos. Lo que queda sin
// mapear se avisa. Universo: población censada, sin la omisión censal.

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "../../../vendor/lucide-react";
import type { ValorColumna, VariableInstrumento } from "../../../api/client";
import {
  getCpv2025Catalogo, postCpv2025Metas,
  type CpvCatalogo, type CpvMargen, type CpvMetas, type CpvMetasPedido,
} from "../../../api/ponderacionCpv2025";
import { Alert } from "../../../components/Alert";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { ErrorBlock, LoadingBlock } from "../../../components/States";
import { formatoConteo } from "../../../lib/formatoNumero";
import { MargenCpv } from "../ponderacion/MargenCpv";
import { Segmentado } from "../ponderacion/Segmentado";
import type { MetasCpvConfig, PonderMargin } from "../store";
import {
  metasDesdeMapeo, rotuloGrupoEdad, sugerirMapeo, validarGruposEdad, type Mapeo,
} from "./metasCpvModel";
import "./MetasCpv2025.css";

type Ambito = "conjunto" | "provincias" | "distritos";

// Variable de la base que probablemente corresponde a cada margen del censo.
const PATRON_VARIABLE: Record<string, RegExp> = {
  sexo: /sex|genero|género|gender/i,
  edad: /edad|etario|age/i,
  educacion: /educ|_edu|nivel_?ed|instruc|estudios/i,
  distrito: /distrito|district|ubigeo/i,
  provincia: /provincia/i,
};

export type MetasCpv2025Props = {
  categoricas: VariableInstrumento[];
  catCache: Record<string, ValorColumna[]>;
  ensureCats: (name: string) => void;
  margenes: PonderMargin[];
  guardado: MetasCpvConfig | null | undefined;
  onAplicar: (m: PonderMargin) => void;
  onGuardarPedido: (p: MetasCpvConfig) => void;
};

export function MetasCpv2025({
  categoricas, catCache, ensureCats, margenes, guardado, onAplicar, onGuardarPedido,
}: MetasCpv2025Props) {
  const [catalogo, setCatalogo] = useState<CpvCatalogo | null>(null);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [pedido, setPedido] = useState<MetasCpvConfig>(() => guardado ?? {
    distritos: [], provincias: [], grupos_edad: [], agrupacion_educacion: "4_grupos", desagregacion: "ninguna",
  });
  const [buscar, setBuscar] = useState("");
  const [consulta, setConsulta] = useState<{ estado: "inactiva" | "cargando" | "error"; error?: string; metas?: CpvMetas }>({ estado: "inactiva" });
  const [asignacion, setAsignacion] = useState<Record<string, { var: string; mapeo: Mapeo }>>({});

  // El bloque ya no se pliega: se monta cuando hace falta y lee el catálogo al montarse.
  useEffect(() => {
    if (catalogo) return;
    getCpv2025Catalogo()
      .then((c) => {
        setCatalogo(c);
        setPedido((p) => (p.grupos_edad.length ? p : { ...p, grupos_edad: c.gruposEdadDefault }));
      })
      .catch((e: unknown) => setErrorCatalogo(e instanceof Error ? e.message : String(e)));
  }, [catalogo]);

  const ambito: Ambito = pedido.distritos.length ? "distritos" : pedido.provincias.length ? "provincias" : "conjunto";
  const [ambitoUi, setAmbitoUi] = useState<Ambito>(ambito);
  const errorGrupos = validarGruposEdad(pedido.grupos_edad);

  const listado = useMemo(() => {
    if (!catalogo) return [];
    const q = buscar.trim().toLowerCase();
    if (ambitoUi === "provincias") {
      return catalogo.provincias
        .filter((p) => !q || `${p.provincia} ${p.departamento}`.toLowerCase().includes(q))
        .map((p) => ({ codigo: p.codigo, rotulo: p.provincia, detalle: `${p.departamento}, ${p.nDistritos} distritos` }));
    }
    return catalogo.distritos
      .filter((d) => !q || `${d.distrito} ${d.provincia}`.toLowerCase().includes(q))
      .map((d) => ({ codigo: d.ubigeo, rotulo: d.distrito, detalle: `${d.provincia}, ${formatoConteo(d.poblacion18)} de 18+` }));
  }, [catalogo, buscar, ambitoUi]);

  const seleccion = ambitoUi === "provincias" ? pedido.provincias : pedido.distritos;
  // Sin scroll anidado (C4): las provincias caben enteras; de los distritos se
  // ven los elegidos y, al buscar, hasta TOPE coincidencias.
  const TOPE = 30;
  const visibles = ambitoUi === "distritos"
    ? (buscar.trim() ? listado.slice(0, TOPE) : listado.filter((x) => seleccion.includes(x.codigo)))
    : listado;
  const ocultos = ambitoUi === "distritos" && buscar.trim() ? Math.max(0, listado.length - TOPE) : 0;
  const alternar = (codigo: string) => {
    const set = new Set(seleccion);
    if (set.has(codigo)) set.delete(codigo); else set.add(codigo);
    const lista = [...set];
    setPedido((p) => ambitoUi === "provincias"
      ? { ...p, provincias: lista, distritos: [] }
      : { ...p, distritos: lista, provincias: [] });
  };
  const elegirAmbito = (a: Ambito) => {
    setAmbitoUi(a);
    setBuscar("");
    if (a === "conjunto") setPedido((p) => ({ ...p, distritos: [], provincias: [] }));
  };

  const setGrupo = (i: number, campo: "min" | "max", raw: string) => {
    const v = raw.trim() === "" ? null : Number.parseInt(raw, 10);
    setPedido((p) => ({
      ...p,
      grupos_edad: p.grupos_edad.map((g, j) => (j !== i ? g : campo === "min"
        ? { ...g, min: v ?? 0, etiqueta: "" }
        : { ...g, max: v != null && Number.isFinite(v) ? v : null, etiqueta: "" })),
    }));
  };

  async function consultar() {
    const cuerpo: CpvMetasPedido = {
      distritos: ambitoUi === "distritos" ? pedido.distritos : [],
      provincias: ambitoUi === "provincias" ? pedido.provincias : [],
      grupos_edad: pedido.grupos_edad.map((g) => ({ ...g, etiqueta: g.etiqueta || rotuloGrupoEdad(g) })),
      agrupacion_educacion: pedido.agrupacion_educacion,
      desagregacion: pedido.desagregacion,
    };
    setConsulta({ estado: "cargando" });
    try {
      const metas = await postCpv2025Metas(cuerpo);
      setConsulta({ estado: "inactiva", metas });
      // Variable de la base sugerida por margen; el mapeo guardado se respeta.
      const next: Record<string, { var: string; mapeo: Mapeo }> = {};
      for (const m of metas.margenes) {
        const previo = margenes.find((x) => x.fuente?.variable === m.variable);
        const v = previo?.var ?? categoricas.find((c) => PATRON_VARIABLE[m.variable]?.test(c.name))?.name ?? "";
        if (v) ensureCats(v);
        next[m.variable] = { var: v, mapeo: previo?.fuente?.mapeo ?? {} };
      }
      setAsignacion(next);
    } catch (e) {
      setConsulta({ estado: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }

  const metas = consulta.metas;
  const aplicar = (m: CpvMargen) => {
    const a = asignacion[m.variable];
    if (!a?.var) return;
    const base = (catCache[a.var] ?? []).map((c) => ({ value: c.value, label: c.label || c.value }));
    const mapeo = Object.keys(a.mapeo).length ? a.mapeo : sugerirMapeo(base, m);
    const r = metasDesdeMapeo(base, m, mapeo);
    onAplicar({ var: a.var, targets: r.targets, fuente: { tipo: "cpv2025", variable: m.variable, mapeo } });
    onGuardarPedido({ ...pedido, distritos: ambitoUi === "distritos" ? pedido.distritos : [], provincias: ambitoUi === "provincias" ? pedido.provincias : [], consultado: metas?.consultado });
  };

  return (
    <section className="pond-cpv" aria-labelledby="pond-cpv-titulo">
      <div className="pond-cpv-cabeza">
        <strong className="pond-cpv-titulo" id="pond-cpv-titulo">Metas del CPV 2025</strong>
        <small title="Población censada por el INEI en 2025 (REDATAM). No incluye la omisión censal estimada.">
          Población censada, sin omisión
        </small>
      </div>

      {errorCatalogo ? <ErrorBlock label="No se pudo leer el catálogo del censo" detail={errorCatalogo} /> : null}
      {!catalogo && !errorCatalogo ? <LoadingBlock variant="inline" label="Leyendo los distritos del censo" /> : null}

      {catalogo && (
        <div className="pond-cpv-cuerpo" data-qa-geometry-group="analitica/ponderacion-cpv" data-qa-geometry-contract="intrinsic">
          <div className="pond-cpv-fila">
            <span className="pond-cpv-rotulo" id="pond-cpv-ambito">Ámbito</span>
            <Segmentado<Ambito>
              etiquetadoPor="pond-cpv-ambito"
              valor={ambitoUi}
              onCambio={elegirAmbito}
              opciones={[
                { valor: "conjunto", rotulo: "Todo el conjunto", ayuda: `Los ${formatoConteo(catalogo.distritos.length)} distritos del archivo` },
                { valor: "provincias", rotulo: "Provincias" },
                { valor: "distritos", rotulo: "Distritos" },
              ]}
            />
          </div>

          {ambitoUi !== "conjunto" && (
            <div className="pond-cpv-lista-caja">
              <PulsoInput size="sm" className="pond-cpv-buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)}
                placeholder={ambitoUi === "provincias" ? "Buscar provincia" : "Buscar distrito"} aria-label="Buscar en el ámbito" />
              <Panel variant="subtle" className="pond-cpv-lista" role="group" aria-label={ambitoUi === "provincias" ? "Provincias" : "Distritos"} data-qa-geometry-capacity="owned">
                <div className="pond-cpv-lista-grilla" data-qa-geometry-group="analitica/ponderacion-cpv-ambito" data-qa-geometry-contract="equal">
                {visibles.map((x) => {
                  const on = seleccion.includes(x.codigo);
                  return (
                    <button key={x.codigo} type="button" className={`pond-cpv-opcion${on ? " is-on" : ""}`}
                      aria-pressed={on} onClick={() => alternar(x.codigo)}>
                      <span>{x.rotulo}</span>
                      <small>{x.detalle}</small>
                    </button>
                  );
                })}
                </div>
                {!visibles.length && (
                  <p className="pond-copy">
                    {ambitoUi === "distritos" && !buscar.trim() ? "Busca un distrito por su nombre o el de su provincia." : "Sin coincidencias."}
                  </p>
                )}
                {ocultos > 0 && <p className="pond-cpv-nota">{formatoConteo(ocultos)} más; afina la búsqueda.</p>}
              </Panel>
              <small className="pond-cpv-nota">
                {seleccion.length ? `${formatoConteo(seleccion.length)} ${seleccion.length === 1 ? "elegido" : "elegidos"}` : "Elige al menos uno"}
              </small>
            </div>
          )}

          <div className="pond-cpv-fila is-arriba">
            <span className="pond-cpv-rotulo">Grupos de edad</span>
            <div className="pond-cpv-grupos">
              {pedido.grupos_edad.map((g, i) => (
                <span key={i} className="pond-cpv-grupo">
                  <PulsoInput size="sm" numeric inputMode="numeric" value={g.min} onChange={(e) => setGrupo(i, "min", e.target.value)} aria-label={`Edad mínima del grupo ${i + 1}`} />
                  <span aria-hidden="true">a</span>
                  <PulsoInput size="sm" numeric inputMode="numeric" value={g.max ?? ""} placeholder="más" onChange={(e) => setGrupo(i, "max", e.target.value)} aria-label={`Edad máxima del grupo ${i + 1} (vacío: a más)`} />
                  <PulsoButton variant="icon" size="sm" aria-label={`Quitar el grupo ${rotuloGrupoEdad(g)}`}
                    onClick={() => setPedido((p) => ({ ...p, grupos_edad: p.grupos_edad.filter((_, j) => j !== i) }))}>
                    <X size={13} aria-hidden="true" />
                  </PulsoButton>
                </span>
              ))}
              <PulsoButton variant="secondary" size="sm" onClick={() => setPedido((p) => {
                const ultimo = p.grupos_edad[p.grupos_edad.length - 1];
                const min = ultimo ? (ultimo.max ?? ultimo.min) + 1 : 18;
                return { ...p, grupos_edad: [...p.grupos_edad, { etiqueta: "", min, max: null }] };
              })}>
                <Plus size={13} aria-hidden="true" /> Grupo
              </PulsoButton>
              <PulsoButton variant="secondary" size="sm" onClick={() => setPedido((p) => ({ ...p, grupos_edad: catalogo.gruposEdadDefault }))}>
                Restablecer
              </PulsoButton>
            </div>
          </div>
          {errorGrupos ? <div role="alert"><Alert kind="warn">{errorGrupos}</Alert></div> : null}

          <div className="pond-cpv-fila">
            <span className="pond-cpv-campo" title="Agrupación de los 13 niveles del censo (18 años a más)">
              <span className="pond-cpv-rotulo">Nivel educativo</span>
              <PulsoSelect size="sm" ariaLabel="Agrupación del nivel educativo" value={pedido.agrupacion_educacion}
                onValueChange={(v) => setPedido((p) => ({ ...p, agrupacion_educacion: v }))}
                options={catalogo.agrupacionesEducacion.map((a) => ({ value: a.codigo, label: a.etiqueta }))} />
            </span>
            <span className="pond-cpv-campo" title="Agrega un margen con la población de cada distrito o provincia del ámbito">
              <span className="pond-cpv-rotulo">Margen geográfico</span>
              <PulsoSelect size="sm" ariaLabel="Margen geográfico" value={pedido.desagregacion}
                onValueChange={(v) => setPedido((p) => ({ ...p, desagregacion: v as MetasCpvConfig["desagregacion"] }))}
                options={[
                  { value: "ninguna", label: "Ninguno" },
                  { value: "provincia", label: "Por provincia" },
                  { value: "distrito", label: "Por distrito" },
                ]} />
            </span>
            <PulsoButton variant="primary" size="sm" onClick={consultar}
              disabled={!!errorGrupos || consulta.estado === "cargando" || (ambitoUi !== "conjunto" && !seleccion.length)}>
              {consulta.estado === "cargando" ? "Consultando" : "Consultar"}
            </PulsoButton>
          </div>

          {consulta.estado === "error" ? (
            <ErrorBlock label="No se pudieron consultar las metas del censo" detail={consulta.error} />
          ) : null}

          {metas && (
            <div className="pond-cpv-resultado" data-qa-geometry-group="analitica/ponderacion-cpv-margenes" data-qa-geometry-contract="intrinsic">
              <p className="pond-cpv-fuente" title={`${metas.fuente}. Consultado el ${metas.consultado}.`}>
                Población censada: <strong>{formatoConteo(metas.total)}</strong> personas en {formatoConteo(metas.ambito.nDistritos)}{" "}
                {metas.ambito.nDistritos === 1 ? "distrito" : "distritos"}. {metas.universo}.
              </p>
              {metas.avisos.map((a, i) => (
                <Alert key={i} kind={a.level === "warn" ? "warn" : "info"}>{a.message}</Alert>
              ))}
              {metas.margenes.map((m) => (
                <MargenCpv
                  key={m.variable}
                  margen={m}
                  categoricas={categoricas}
                  asignado={asignacion[m.variable] ?? { var: "", mapeo: {} }}
                  categoriasBase={catCache[asignacion[m.variable]?.var ?? ""] ?? []}
                  enUso={margenes.some((x) => x.fuente?.variable === m.variable && x.var === asignacion[m.variable]?.var)}
                  onAsignar={(a) => { if (a.var) ensureCats(a.var); setAsignacion((s) => ({ ...s, [m.variable]: a })); }}
                  onAplicar={() => aplicar(m)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
