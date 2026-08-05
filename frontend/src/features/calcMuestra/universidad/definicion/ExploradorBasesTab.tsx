/**
 * Pestaña «Explorador» (sección Datos): las bases por dentro, variable a
 * variable, con filtros dinámicos.
 *
 * G42 · Nació de un pedido de Gonzalo: «falta la pestaña que nos permite
 * explorar las bases de estudiantes y cursos-horario con gráficos muy similares
 * a los del explorador de base de procesamiento/validación».
 *
 * G49 · Y se rehízo por un error de diseño propio. La primera versión describía
 * `aula_frame`, que es PRODUCTO del marco: exigía construirlo para mirar un
 * Excel y mezclaba las columnas del archivo con las que el motor deriva.
 * Gonzalo: «¿por qué este explorador te pediría tener un marco completo si se
 * supone que este es un paso previo al marco? […] con las dos bases iniciales y
 * crudas teníamos suficiente para ir mapeando qué teníamos». Ahora describe las
 * bases declaradas en Fuentes —archivo y hoja— y el marco queda como una opción
 * más, al final, para auditar lo que el motor calculó.
 *
 * G50 · Los filtros son de cualquier columna, no sólo de facultad: «yo también
 * tengo que ser capaz de tener filtros dinámicos que me permitan ese nivel de
 * especificidad […] explorar como si tuviera el Excel, pero la diferencia aquí
 * es que hay gráficos». Se cruzan en AND entre columnas y en OR dentro de una,
 * igual que el autofiltro de una hoja de cálculo.
 *
 * El perfil lo calcula R: la base real tiene 136.284 filas y contar categorías
 * en el cliente exigiría moverla entera por cada clic.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Compass, Filter, Search, X } from "../../../../vendor/lucide-react";
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
  MonitoreoRow,
} from "../../../../api/client";
import {
  apiCalcMuestraExplorarBase,
  type ExploradorBaseCategoria,
  type ExploradorBaseFiltro,
  type ExploradorBasePerfil,
  type ExploradorBaseResumen,
} from "../../../../api/calcMuestraExploradorBase";
import { EmptyState } from "../../../../components/States";
import { fmtDec, fmtInt, fmtPct, rowsFrom } from "../../sharedCore";
import { distribucionDe, inventarioVariables } from "./exploradorBasesModel";
import { nombreDeColumna } from "./exploradorBasesNombres";
import { etiquetaDeValor } from "./exploradorBasesValores";
import { fuentesExplorables, type FuenteExplorable } from "./exploradorBasesFuentes";
import "./exploradorBases.css";

/** Forma común de una columna, venga del archivo (R) o del marco (cliente). */
type ColumnaVista = {
  columna: string;
  titulo: string;
  detalle: string | null;
  tipo: "numerica" | "categorica";
  conDato: number;
  sinDato: number;
  distintos: number;
  categorias: ExploradorBaseCategoria[];
  otras: { n: number; categorias: number; truncadas: number; filas: ExploradorBaseCategoria[] } | null;
  resumen: ExploradorBaseResumen | null;
  /** Traduce los valores; sólo las derivadas del marco lo necesitan. */
  traduceValores: boolean;
};

function Histograma({ resumen }: { resumen: ExploradorBaseResumen }) {
  const alto = Math.max(...resumen.bins.map((bin) => bin.n), 1);
  const rango = resumen.max - resumen.min;
  const posMediana = rango > 0 ? ((resumen.p50 - resumen.min) / rango) * 100 : 50;
  return (
    <figure
      className="cmv2-expb-figura"
      role="img"
      aria-label={`Distribución entre ${fmtDec(resumen.min, 1)} y ${fmtDec(resumen.max, 1)}, mediana ${fmtDec(resumen.p50, 1)}`}
    >
      <div className="cmv2-expb-hist">
        <i className="cmv2-expb-hist-mediana" style={{ left: `${posMediana}%` }} aria-hidden="true" />
        {resumen.bins.map((bin, index) => (
          <span
            key={index}
            style={{ height: `${Math.max(1.5, (bin.n / alto) * 100)}%` }}
            title={`${fmtDec(bin.desde, 1)} – ${fmtDec(bin.hasta, 1)}: ${fmtInt(bin.n)}`}
          />
        ))}
      </div>
      <figcaption className="cmv2-expb-eje" aria-hidden="true">
        <span>{fmtDec(resumen.min, 1)}</span>
        <span data-marca="mediana">mediana {fmtDec(resumen.p50, 1)}</span>
        <span>{fmtDec(resumen.max, 1)}</span>
      </figcaption>
    </figure>
  );
}

export function ExploradorBasesTab({
  aulasState,
  workspace,
  onReconstruir,
  puedeReconstruir = false,
  reconstruyendo = false,
}: {
  aulasState: CalcMuestraAulasState | null;
  workspace?: CalcMuestraWorkspace | null;
  onReconstruir?: () => void;
  puedeReconstruir?: boolean;
  reconstruyendo?: boolean;
}) {
  const fuentes = useMemo(
    () => fuentesExplorables(workspace, aulasState),
    [workspace, aulasState],
  );
  const [fuenteId, setFuenteId] = useState("");
  const fuente: FuenteExplorable | null =
    fuentes.find((item) => item.id === fuenteId) ?? fuentes[0] ?? null;

  const [filtros, setFiltros] = useState<ExploradorBaseFiltro[]>([]);
  const [unidad, setUnidad] = useState<"filas" | "estudiantes">("filas");
  const [variable, setVariable] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [colaAbierta, setColaAbierta] = useState(false);
  const [editandoFiltro, setEditandoFiltro] = useState<string | null>(null);

  const [perfil, setPerfil] = useState<ExploradorBasePerfil | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claveFiltros = JSON.stringify(filtros);
  const esArchivo = fuente?.tipo === "archivo";
  const fileId = esArchivo ? fuente.fileId : "";
  const sheet = esArchivo ? fuente.sheet : "";

  useEffect(() => {
    if (!fileId) {
      setPerfil(null);
      setError(null);
      // El fetch anterior se aborta sin pasar por su `catch`: sin esto, saltar
      // al marco dejaba la nota diciendo «Recalculando…» para siempre.
      setCargando(false);
      return;
    }
    const control = new AbortController();
    setCargando(true);
    setError(null);
    apiCalcMuestraExplorarBase(
      { file_id: fileId, sheet, filtros: JSON.parse(claveFiltros), unidad, top: 40 },
      { signal: control.signal },
    )
      .then((resultado) => {
        setPerfil(resultado);
        setCargando(false);
      })
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        setPerfil(null);
        setCargando(false);
        setError(e instanceof Error ? e.message : "No se pudo leer la base declarada.");
      });
    return () => control.abort();
  }, [fileId, sheet, claveFiltros, unidad]);

  /* ---- el marco, cuando es la fuente elegida: mismo camino de siempre ---- */
  const filasMarcoBase = useMemo<MonitoreoRow[]>(
    () => (fuente?.tipo === "marco" ? rowsFrom<MonitoreoRow>(aulasState?.frame?.aula_frame) : []),
    [fuente?.tipo, aulasState?.frame],
  );
  // Los filtros valen igual sobre el marco: un chip que se deja poner y no acota
  // nada miente sobre lo que se está mirando. Aquí se aplican en el cliente
  // porque las filas ya están en memoria.
  const filasMarco = useMemo<MonitoreoRow[]>(() => {
    if (!filtros.length) return filasMarcoBase;
    return filasMarcoBase.filter((row) =>
      filtros.every((filtro) => {
        const valor = (row as Record<string, unknown>)[filtro.columna];
        return valor != null && filtro.valores.includes(String(valor).trim());
      }),
    );
  }, [filasMarcoBase, filtros]);
  const columnasMarco = useMemo<ColumnaVista[]>(() => {
    if (fuente?.tipo !== "marco" || !filasMarco.length) return [];
    return inventarioVariables(filasMarco).map((row) => {
      const nombre = nombreDeColumna(row.columna, workspace?.variable_mappings);
      const dist = distribucionDe(filasMarco, row.columna, row.tipo);
      return {
        columna: row.columna,
        titulo: nombre.titulo,
        detalle: nombre.origen === "motor" ? nombre.detalle ?? null : null,
        tipo: row.tipo,
        conDato: dist?.conDato ?? row.conDato,
        sinDato: dist?.sinDato ?? 0,
        distintos: row.distintos,
        categorias: dist?.tipo === "categorica" ? dist.categorias.map((c) => ({ clave: c.clave, n: c.n })) : [],
        otras: dist?.tipo === "categorica" && dist.otras
          ? { ...dist.otras, filas: dist.otras.filas.map((c) => ({ clave: c.clave, n: c.n })) }
          : null,
        resumen: dist?.tipo === "numerica"
          ? { min: dist.min, max: dist.max, media: dist.media, p25: dist.p25, p50: dist.p50, p75: dist.p75, bins: dist.bins }
          : null,
        traduceValores: nombre.origen !== "excel",
      } satisfies ColumnaVista;
    });
  }, [fuente?.tipo, filasMarco, workspace?.variable_mappings]);

  const columnas = useMemo<ColumnaVista[]>(() => {
    if (fuente?.tipo === "marco") return columnasMarco;
    if (!perfil) return [];
    return perfil.columnas.map((col) => ({
      columna: col.columna,
      titulo: col.columna,
      detalle: null,
      tipo: col.tipo,
      conDato: col.conDato,
      sinDato: col.sinDato,
      distintos: col.distintos,
      categorias: col.categorias,
      otras: col.otras,
      resumen: col.resumen,
      traduceValores: false,
    }));
  }, [fuente?.tipo, columnasMarco, perfil]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const orden = [...columnas].sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
    return q ? orden.filter((col) => col.titulo.toLowerCase().includes(q)) : orden;
  }, [columnas, busqueda]);

  const activa = visibles.find((col) => col.columna === variable) ?? visibles[0] ?? null;

  /* ---- filtros: sólo columnas categóricas con una lista manejable ---- */
  const filtrables = useMemo(
    () => columnas.filter((col) => col.tipo === "categorica" && col.distintos <= 200),
    [columnas],
  );
  const filtroDe = (columna: string) => filtros.find((f) => f.columna === columna) ?? null;
  /* Los filtros hablan el idioma de la pantalla: sobre el marco, un chip que
     dijera `included: true` obligaría a traducir mentalmente lo que la lista de
     categorías ya muestra como «¿Entra al marco?: Sí». */
  const columnaDe = (columna: string) => columnas.find((col) => col.columna === columna) ?? null;
  const rotuloColumna = (columna: string) => columnaDe(columna)?.titulo ?? columna;
  const rotuloValor = (columna: string, clave: string) =>
    columnaDe(columna)?.traduceValores ? etiquetaDeValor(columna, clave) ?? clave : clave;
  /*
   * G52 · Una columna filtrada no se describe a sí misma.
   *
   * Al acotar por «Facultad: CIENCIAS E INGENIERÍA», el perfil devuelve una
   * sola facultad —es correcto: eso es lo que queda— y entonces el popover de
   * esa columna ofrecía un único valor, sin forma de añadir una segunda
   * facultad. Es la trampa clásica del autofiltro, y se resuelve igual que en
   * una hoja: el desplegable de una columna muestra SU catálogo, no su
   * resultado. Aquí se conserva el último catálogo visto sin ese filtro; los
   * conteos son los de ese momento, que es justo lo que la hoja también hace.
   */
  const catalogoValores = useRef(new Map<string, ExploradorBaseCategoria[]>());
  useEffect(() => {
    for (const col of columnas) {
      if (col.tipo !== "categorica") continue;
      if (filtros.some((filtro) => filtro.columna === col.columna)) continue;
      catalogoValores.current.set(col.columna, col.categorias);
    }
  }, [columnas, filtros]);

  const valoresEnEdicion = !editandoFiltro
    ? []
    : filtroDe(editandoFiltro)
      ? catalogoValores.current.get(editandoFiltro) ?? columnaDe(editandoFiltro)?.categorias ?? []
      : columnaDe(editandoFiltro)?.categorias ?? [];
  const seleccionadosEnEdicion = editandoFiltro ? filtroDe(editandoFiltro)?.valores.length ?? 0 : 0;

  // El popover se cierra como cualquier desplegable: click fuera o Escape. Sin
  // esto quedaba abierto tapando la lectura mientras se navegaba el índice.
  const barraFiltrosRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!editandoFiltro) return;
    const fuera = (event: MouseEvent) => {
      const barra = barraFiltrosRef.current;
      if (barra && !barra.contains(event.target as Node)) setEditandoFiltro(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditandoFiltro(null);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [editandoFiltro]);

  function alternarValor(columna: string, valor: string) {
    setFiltros((prev) => {
      const actual = prev.find((f) => f.columna === columna);
      if (!actual) return [...prev, { columna, valores: [valor] }];
      const valores = actual.valores.includes(valor)
        ? actual.valores.filter((v) => v !== valor)
        : [...actual.valores, valor];
      // Un filtro sin valores no acota nada y ocupa un chip: se retira solo.
      return valores.length
        ? prev.map((f) => (f.columna === columna ? { columna, valores } : f))
        : prev.filter((f) => f.columna !== columna);
    });
    setColaAbierta(false);
  }

  const filas = fuente?.tipo === "marco" ? filasMarco.length : perfil?.filas ?? 0;
  const filasBase = fuente?.tipo === "marco" ? filasMarcoBase.length : perfil?.filasBase ?? 0;
  const acotada = filtros.length > 0 && filas !== filasBase;
  const unidadDisponible = fuente?.tipo === "archivo" && (perfil?.unidadDisponible ?? false);
  const marcoConstruido = Boolean(aulasState?.frame);

  if (!fuentes.length) {
    return (
      <section className="cmv2-expb" data-audit-ready="false" aria-label="Explorador de bases">
        <div className="cmv2-expb-vacio-marco">
          <EmptyState
            icon={<Compass size={22} aria-hidden="true" />}
            title="Todavía no hay bases declaradas"
            hint="Sube tus archivos en Datos › Fuentes y vuelve aquí: el explorador las describe tal como están, sin necesidad de construir el marco."
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className="cmv2-expb"
      data-audit-ready={columnas.length ? "true" : "false"}
      data-qa-geometry-group="calc-muestra/explorador-bases"
      data-qa-geometry-contract="intrinsic"
      aria-label="Explorador de bases"
    >
      <header className="cmv2-expb-barra">
        <div className="cmv2-expb-conmutador" role="group" aria-label="Base a explorar">
          {fuentes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={fuente?.id === item.id}
              data-activo={fuente?.id === item.id || undefined}
              title={item.detalle}
              onClick={() => {
                setFuenteId(item.id);
                setVariable("");
                setFiltros([]);
                setColaAbierta(false);
                setEditandoFiltro(null);
                // Otra base, otras columnas: el catálogo de la anterior no
                // describe nada aquí.
                catalogoValores.current.clear();
              }}
            >
              {item.etiqueta}
            </button>
          ))}
        </div>

        {unidadDisponible ? (
          <div className="cmv2-expb-unidad" role="group" aria-label="Qué se cuenta">
            {([
              { id: "filas" as const, label: "Filas" },
              { id: "estudiantes" as const, label: "Estudiantes" },
            ]).map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                aria-pressed={unidad === opcion.id}
                data-activo={unidad === opcion.id || undefined}
                onClick={() => setUnidad(opcion.id)}
              >
                {opcion.label}
              </button>
            ))}
          </div>
        ) : null}

        <p className="cmv2-expb-nota" role="note">
          {/* Mientras se relee con un filtro nuevo se conserva el perfil
              anterior, así que la nota anuncia el recálculo en vez de vaciarse;
              en la primera carga lo dice el cuerpo y aquí sobraría. */}
          {cargando && columnas.length ? (
            <>Recalculando con los filtros…</>
          ) : columnas.length ? (
            <>
              <strong>{fmtInt(filas)}</strong>
              {acotada ? <> de {fmtInt(filasBase)}</> : null} filas ·{" "}
              <strong>{fmtInt(columnas.length)}</strong> columnas
              {unidad === "estudiantes" && perfil?.estudiantes != null ? (
                <> · {fmtInt(perfil.estudiantes)} estudiantes distintos</>
              ) : null}
              {fuente?.tipo === "marco"
                ? " · lo que el motor derivó, no tu archivo"
                : " · tal como se leyó, sin criterios"}
            </>
          ) : null}
        </p>
      </header>

      {/* G50/G52 · Los filtros, como el autofiltro de una hoja: una sola barra
          con los chips activos y un desplegable para añadir otra columna. La
          lista de valores cuelga de la barra como popover y no empuja el cuerpo:
          abrir un filtro no tiene por qué mover de sitio lo que se está
          leyendo. */}
      <div className="cmv2-expb-filtros" ref={barraFiltrosRef}>
        {filtros.map((filtro) => {
          const abierto = editandoFiltro === filtro.columna;
          return (
            <span key={filtro.columna} className="cmv2-expb-chip" data-abierto={abierto || undefined}>
              {/* El chip también abre su lista: para corregir un filtro se va a
                  él, no al desplegable de añadir. */}
              <button
                type="button"
                className="cmv2-expb-chip-abrir"
                aria-expanded={abierto}
                onClick={() => setEditandoFiltro(abierto ? null : filtro.columna)}
              >
                <strong>{rotuloColumna(filtro.columna)}</strong>
                <span>
                  {filtro.valores.length === 1
                    ? rotuloValor(filtro.columna, filtro.valores[0]!)
                    : `${filtro.valores.length} valores`}
                </span>
              </button>
              <button
                type="button"
                className="cmv2-expb-chip-quitar"
                aria-label={`Quitar el filtro de ${rotuloColumna(filtro.columna)}`}
                onClick={() => {
                  setFiltros((prev) => prev.filter((f) => f.columna !== filtro.columna));
                  if (abierto) setEditandoFiltro(null);
                }}
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          );
        })}

        {filtrables.length ? (
          <label className="cmv2-expb-anadir">
            <Filter size={12} aria-hidden="true" />
            <span>{filtros.length ? "Añadir filtro" : "Filtrar por…"}</span>
            <ChevronDown size={13} aria-hidden="true" />
            <select
              aria-label="Añadir un filtro por columna"
              value=""
              onChange={(event) => setEditandoFiltro(event.target.value || null)}
            >
              <option value="">Elegir columna…</option>
              {filtrables.map((col) => (
                <option key={col.columna} value={col.columna}>
                  {col.titulo}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {filtros.length > 1 ? (
          <button
            type="button"
            className="cmv2-expb-limpiar"
            onClick={() => { setFiltros([]); setEditandoFiltro(null); }}
          >
            Quitar todos
          </button>
        ) : null}

        {editandoFiltro ? (
          <div className="cmv2-expb-valores" role="group" aria-label={`Valores de ${rotuloColumna(editandoFiltro)}`}>
            <header>
              <h4>{rotuloColumna(editandoFiltro)}</h4>
              <p>
                {seleccionadosEnEdicion
                  ? `${fmtInt(seleccionadosEnEdicion)} de ${fmtInt(valoresEnEdicion.length)} elegidos`
                  : `${fmtInt(valoresEnEdicion.length)} valores · elige los que quieras ver`}
              </p>
              <button type="button" onClick={() => setEditandoFiltro(null)}>
                Listo
              </button>
            </header>
            <div className="cmv2-expb-nube">
              {valoresEnEdicion.map((cat) => {
                const activo = filtroDe(editandoFiltro)?.valores.includes(cat.clave) ?? false;
                return (
                  <button
                    key={cat.clave}
                    type="button"
                    data-activo={activo || undefined}
                    aria-pressed={activo}
                    onClick={() => alternarValor(editandoFiltro, cat.clave)}
                  >
                    {activo ? <Check size={11} aria-hidden="true" /> : null}
                    {rotuloValor(editandoFiltro, cat.clave)}
                    <em>{fmtInt(cat.n)}</em>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="cmv2-expb-vacio-marco">
          <EmptyState
            icon={<Compass size={22} aria-hidden="true" />}
            title="No se pudo leer esta base"
            hint={error}
          />
        </div>
      ) : !columnas.length ? (
        <div className="cmv2-expb-vacio-marco">
          {/* Un cruce puede quedarse sin filas, y decir «esta base no trae
              columnas» sería culpar al archivo de lo que hizo el filtro. */}
          <EmptyState
            icon={<Compass size={22} aria-hidden="true" />}
            title={cargando
              ? "Leyendo la base…"
              : filtros.length && !filas
                ? "Ningún registro cumple estos filtros"
                : "Esta base no trae columnas legibles"}
            hint={cargando
              ? "La primera lectura de una base grande tarda unos segundos; después los filtros son inmediatos."
              : filtros.length && !filas
                ? `De ${fmtInt(filasBase)} filas, ninguna cruza todas las condiciones activas.`
                : "Revisa la hoja declarada en Datos › Fuentes."}
            cta={!cargando && filtros.length && !filas ? (
              <button type="button" className="cmv2-expb-reconstruir" onClick={() => setFiltros([])}>
                Quitar los filtros
              </button>
            ) : !cargando && fuente?.tipo === "marco" && onReconstruir && !marcoConstruido ? (
              <button
                type="button"
                className="cmv2-expb-reconstruir"
                disabled={!puedeReconstruir || reconstruyendo}
                onClick={onReconstruir}
              >
                {reconstruyendo ? "Calculando…" : "Calcular población y cursos-horario elegibles"}
              </button>
            ) : undefined}
          />
        </div>
      ) : (
        <div className="cmv2-expb-cuerpo">
          <aside className="cmv2-expb-indice" aria-label="Columnas de la base">
            <label className="cmv2-expb-buscador">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={busqueda}
                placeholder={`Buscar entre ${fmtInt(columnas.length)} columnas`}
                onChange={(event) => setBusqueda(event.target.value)}
              />
            </label>
            <div className="cmv2-expb-scroll">
              <ul className="cmv2-expb-plana">
                {visibles.map((col) => {
                  // La cobertura se mide contra el total de la propia columna,
                  // no contra las filas: contando personas, `conDato` habla de
                  // estudiantes y dividir entre matrículas daba 20% a columnas
                  // que están completas.
                  const share = col.conDato / Math.max(1, col.conDato + col.sinDato);
                  return (
                    <li key={col.columna}>
                      <button
                        type="button"
                        data-activa={activa?.columna === col.columna || undefined}
                        onClick={() => { setVariable(col.columna); setColaAbierta(false); }}
                        title={`${col.titulo} · ${fmtPct(share)} con dato`}
                      >
                        <span className="cmv2-expb-var">{col.titulo}</span>
                        {share < 0.995 ? (
                          <span className="cmv2-expb-parcial" title="Filas con dato">{fmtPct(share)}</span>
                        ) : null}
                        <span className="cmv2-expb-meta">
                          {col.tipo === "numerica" ? "núm." : fmtInt(col.distintos)}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!visibles.length ? (
                  <li className="cmv2-expb-sin-match">Ninguna columna coincide con «{busqueda}».</li>
                ) : null}
              </ul>
            </div>
          </aside>

          <div className="cmv2-expb-lectura">
            {!activa ? (
              <EmptyState
                icon={<Search size={20} aria-hidden="true" />}
                title="Elige una columna en el índice"
                hint="Cada una se describe con su distribución."
              />
            ) : (
              <article className="cmv2-expb-card">
                <header className="cmv2-expb-card-head">
                  <div className="cmv2-expb-card-title">
                    <h3>{activa.titulo}</h3>
                    <p>
                      {activa.tipo === "numerica"
                        ? "Numérica"
                        : `Categórica · ${fmtInt(activa.distintos)} valores distintos${acotada ? " aquí" : ""}`}
                      {activa.detalle ? <> · {activa.detalle}</> : null}
                    </p>
                  </div>
                  <dl className="cmv2-expb-chips">
                    <div>
                      <dt>{unidad === "estudiantes" ? "Estudiantes" : "Con dato"}</dt>
                      <dd>{fmtInt(activa.conDato)}</dd>
                    </div>
                    <div data-alerta={activa.sinDato > 0 || undefined}>
                      <dt>Sin dato</dt>
                      <dd>
                        {fmtInt(activa.sinDato)}
                        {activa.sinDato > 0 ? (
                          <em>{fmtPct(activa.sinDato / Math.max(1, activa.conDato + activa.sinDato))}</em>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                </header>

                {activa.tipo === "numerica" && activa.resumen ? (
                  <div className="cmv2-expb-numerica">
                    <Histograma resumen={activa.resumen} />
                    <dl
                      className="cmv2-expb-cuantiles"
                      data-qa-geometry-group="calc-muestra/explorador-cuantiles"
                      data-qa-geometry-contract="equal"
                    >
                      {([
                        ["Mínimo", activa.resumen.min],
                        ["P25", activa.resumen.p25],
                        ["Mediana", activa.resumen.p50],
                        ["Media", activa.resumen.media],
                        ["P75", activa.resumen.p75],
                        ["Máximo", activa.resumen.max],
                      ] as const).map(([label, valor]) => (
                        <div key={label} data-qa-geometry-member data-qa-geometry-capacity="owned">
                          <dt>{label}</dt>
                          <dd>{fmtDec(valor, 1)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : (
                  <>
                    <ul
                      className="cmv2-expb-categorias"
                      data-qa-geometry-group="calc-muestra/explorador-categorias"
                      data-qa-geometry-contract="equal"
                    >
                      {activa.categorias.map((categoria) => {
                        const etiqueta = activa.traduceValores
                          ? etiquetaDeValor(activa.columna, categoria.clave) ?? categoria.clave
                          : categoria.clave;
                        const share = activa.conDato ? categoria.n / activa.conDato : 0;
                        const enFiltro = filtroDe(activa.columna)?.valores.includes(categoria.clave) ?? false;
                        return (
                          <li key={categoria.clave} data-qa-geometry-member data-qa-geometry-capacity="owned">
                            {/* Cada categoría es también un filtro: la pregunta
                                que sigue a «cuántos hay» casi siempre es «y de
                                esos, qué pasa con…». */}
                            <button
                              type="button"
                              className="cmv2-expb-cat-label"
                              data-en-filtro={enFiltro || undefined}
                              title={`${etiqueta} · filtrar por este valor`}
                              onClick={() => alternarValor(activa.columna, categoria.clave)}
                            >
                              {etiqueta}
                            </button>
                            <span className="cmv2-expb-cat-bar" aria-hidden="true">
                              <i style={{ width: `${Math.max(0.8, share * 100)}%` }} />
                            </span>
                            <span className="cmv2-expb-cat-n">{fmtInt(categoria.n)}</span>
                            <span className="cmv2-expb-cat-pct">{fmtPct(share)}</span>
                          </li>
                        );
                      })}
                      {activa.otras ? (
                        <li data-resto="true" data-qa-geometry-member data-qa-geometry-capacity="owned">
                          <button
                            type="button"
                            className="cmv2-expb-cat-label cmv2-expb-cola-toggle"
                            aria-expanded={colaAbierta}
                            onClick={() => setColaAbierta((abierta) => !abierta)}
                          >
                            {colaAbierta ? "Ocultar" : "Ver"} las otras {fmtInt(activa.otras.categorias)} categorías
                          </button>
                          <span className="cmv2-expb-cat-bar" aria-hidden="true">
                            <i style={{ width: `${Math.max(0.8, (activa.otras.n / Math.max(1, activa.conDato)) * 100)}%` }} />
                          </span>
                          <span className="cmv2-expb-cat-n">{fmtInt(activa.otras.n)}</span>
                          <span className="cmv2-expb-cat-pct">
                            {fmtPct(activa.otras.n / Math.max(1, activa.conDato))}
                          </span>
                        </li>
                      ) : null}
                    </ul>
                    {activa.otras && colaAbierta ? (
                      <div className="cmv2-expb-cola">
                        <ul>
                          {activa.otras.filas.map((categoria) => (
                            <li key={categoria.clave}>
                              <span title={categoria.clave}>
                                {activa.traduceValores
                                  ? etiquetaDeValor(activa.columna, categoria.clave) ?? categoria.clave
                                  : categoria.clave}
                              </span>
                              <em>{fmtInt(categoria.n)}</em>
                              <b>{fmtPct(categoria.n / Math.max(1, activa.conDato))}</b>
                            </li>
                          ))}
                        </ul>
                        {activa.otras.truncadas > 0 ? (
                          <p role="note">
                            Y {fmtInt(activa.otras.truncadas)} categorías más, cada una por debajo de las
                            listadas.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
