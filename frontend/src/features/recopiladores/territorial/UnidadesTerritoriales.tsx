// Territorial › Unidades › Lista (ADR 0118 §1, revamp v5): las UMP de la foto. La
// sección abre en la tarea —las rutas por revisar— con un segmentado (Por revisar,
// Sin encuestador, Todas), el distrito en un selector y la búsqueda. La tabla lleva
// el reemplazo debajo de su titular, el encuestador asignado y la observación con
// el criterio de Selección (checklist M3–M5). `foco=<id_manzana>` abre el inspector
// de la UMP; `panel=hoja` abre su hoja (DialogoHojaUmp).
//
// Contrato de Superficie:
// - C1: `material-campo/territorial/inspector` (intrinsic) cuando hay foco.
// - C3: sin foto o sin coincidencias, el vacío es de la lista (EstadoVacio).
// - C4: el scroll es del panel de la sección; la tabla del kit (PulsoTable) no fija alto propio.
// - C5: la columna Observación aparece sólo si alguna UMP trae una; vacía en todas las filas no dice nada (D15).

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { UnidadTerritorial, UnidadesTerritoriales as Unidades } from "../../../api/materialTerritorial";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { ROTULO_DE_FASE } from "../campanas/modeloRegistro";
import { AlertTriangle, FileText, MapPinned, Search } from "../../../vendor/lucide-react";
import { DialogoHojaUmp } from "./DialogoHojaUmp";
import { InspectorUmp } from "./InspectorUmp";
import { agruparUnidades, contarVistas, fechaDelEnvio, filtrarUnidades, hayObservaciones, observacionDe, unidadDelFoco, type VistaDeUnidades } from "./modeloUnidades";
import { revisarUnidades, type EstadoUnidad } from "./revisionUnidades";
import type { SupuestosVisitas } from "../../hojasRuta/seleccion/visitas";
import "./unidades.css";

import { HREF_REENVIO } from "./rutasTerritoriales";

export { HREF_REENVIO };

type Props = {
  unidades: Unidades | null;
  /** El mensaje del 409 cuando la foto ya no está. */
  sinFuente: string | null;
  foco: string | null;
  hrefDeFoco: (foco: string) => string;
  hrefDeHoja: (foco: string) => string;
  /** Paquetes › Reemplazos puntuales con la UMP ya elegida. */
  hrefDeReemplazo: (foco: string) => string;
  /** La lista sin foco: cierra el inspector. */
  hrefSinFoco: string;
  /** Respuesta y ocupación del estudio: «no alcanza» se mide en visitas, como en Selección. */
  supuestos?: SupuestosVisitas;
  /** `unit_id` de cada titular asignada → «Nombre (código)», de la asignación guardada. */
  encuestadorDe?: ReadonlyMap<string, string>;
};

const SIN_ENCUESTADOR: ReadonlyMap<string, string> = new Map();

const VISTAS: readonly { id: VistaDeUnidades; label: string }[] = [
  { id: "por-revisar", label: "Por revisar" },
  { id: "sin-encuestador", label: "Sin encuestador" },
  { id: "todas", label: "Todas" },
];
const TODOS_LOS_DISTRITOS = "__todos";

export function AvisoDesactualizada({ enviadoAt }: { enviadoAt: string | null }) {
  const cuando = fechaDelEnvio(enviadoAt);
  return (
    <div className="rec-terr-aviso" role="status">
      <AlertTriangle size={15} aria-hidden />
      <p>
        La muestra cambió en Hojas de ruta desde el envío{cuando ? ` del ${cuando}` : ""}. Mientras no se reenvíe, aquí no se genera material: saldría de una muestra distinta de la enviada.{" "}
        <Link to={HREF_REENVIO}>Ir a Hojas de ruta</Link>
      </p>
    </div>
  );
}

export function VacioSinFuente({ mensaje }: { mensaje: string | null }) {
  return (
    <EstadoVacio
      tamano="normal"
      icono={<MapPinned size={22} />}
      titulo="No hay muestra enviada"
      descripcion={mensaje ?? "Envía la muestra desde Hojas de ruta › Selección › Entrega para ver sus UMP aquí."}
      accion={<Link className="rec-terr-enlace" to={HREF_REENVIO}>Ir a Hojas de ruta</Link>}
    />
  );
}

const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-PE"));

type FilaTabla = { u: UnidadTerritorial; estado: EstadoUnidad | undefined; encuestador: string | null };

function columnasDe(hrefDeHoja: (foco: string) => string, conObservacion: boolean): PulsoTableColumna<FilaTabla>[] {
  const columnas: PulsoTableColumna<FilaTabla>[] = [
    { id: "ump", encabezado: "UMP", ancho: 110, celda: ({ u }) => <span className={`rec-terr-ump-codigo is-${u.role}`}>{u.label}</span> },
    { id: "zona", encabezado: "Zona", ancho: 90, celda: ({ u }) => u.zona || "—" },
    { id: "manzana", encabezado: "Manzana", ancho: 100, celda: ({ u }) => u.manzana || "—" },
    { id: "encuestas", encabezado: "Encuestas", ancho: 110, tipo: "cifra", celda: ({ u }) => (u.rango_inicio !== null && u.rango_fin !== null ? `${u.rango_inicio}–${u.rango_fin}` : "—") },
    { id: "viviendas", encabezado: "Viviendas", ancho: 100, tipo: "cifra", celda: ({ u }) => fmt(u.viviendas) },
    { id: "encuestador", encabezado: "Encuestador", ancho: 170, celda: ({ u, encuestador }) => (u.role === "titular" ? (encuestador ?? <span className="rec-terr-sin-asignar">Sin asignar</span>) : null) },
    { id: "observacion", encabezado: "Observación", ancho: 140, celda: ({ estado }) => {
      const obs = observacionDe(estado);
      return obs ? <span className="rec-terr-estado" data-estado={obs.tono}>{obs.motivo}</span> : null;
    } },
    { id: "hoja", encabezado: "Hoja", ancho: 90, celda: ({ u }) => (
      <Link className="rec-terr-ump-hoja" to={hrefDeHoja(u.unit_id)} aria-label={`Ver la hoja de ${u.label}`} onClick={(e) => e.stopPropagation()}>
        <FileText size={13} aria-hidden /> Hoja
      </Link>
    ) },
  ];
  return conObservacion ? columnas : columnas.filter((c) => c.id !== "observacion");
}

export function UnidadesTerritoriales({ unidades, sinFuente, foco, hrefDeFoco, hrefDeHoja, hrefDeReemplazo, hrefSinFoco, supuestos, encuestadorDe = SIN_ENCUESTADOR }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const units = useMemo(() => unidades?.units ?? [], [unidades]);
  const grupos = useMemo(() => agruparUnidades(units, busqueda), [busqueda, units]);
  const revision = useMemo(() => revisarUnidades(units, supuestos), [units, supuestos]);
  const conteo = useMemo(() => contarVistas(units, revision.rutasPorRevisar, encuestadorDe), [units, revision, encuestadorDe]);
  const enfocada = unidadDelFoco(units, foco);
  const navigate = useNavigate();
  const conObservacion = useMemo(() => hayObservaciones(revision.porUnidad), [revision]);
  const columnas = useMemo(() => columnasDe(hrefDeHoja, conObservacion), [hrefDeHoja, conObservacion]);
  // M7: el orden de la lista (todas las UMP, titular y sus reemplazos) para pasar de hoja en hoja.
  const orden = useMemo(() => agruparUnidades(units).flatMap((g) => [...g.titulares.flatMap(({ titular, reemplazos }) => [titular, ...reemplazos]), ...g.sueltos].map((u) => u.unit_id)), [units]);
  const iFoco = foco ? orden.indexOf(foco) : -1;
  const vecinas = { anterior: iFoco > 0 ? orden[iFoco - 1] : null, siguiente: iFoco >= 0 && iFoco < orden.length - 1 ? orden[iFoco + 1] : null };
  // La sección abre en la tarea: las rutas por revisar si las hay; si no, todas.
  const [vistaElegida, setVista] = useState<VistaDeUnidades | null>(null);
  const vista: VistaDeUnidades = busqueda.trim() ? "todas" : vistaElegida ?? (conteo["por-revisar"] ? "por-revisar" : "todas");
  const [distrito, setDistrito] = useState<string>(TODOS_LOS_DISTRITOS);

  if (!unidades) {
    return (
      <div className="rec-terr-seccion" data-qa-geometry-capacity="owned">
        <VacioSinFuente mensaje={sinFuente} />
      </div>
    );
  }

  const cuando = fechaDelEnvio(unidades.enviado_at);
  const filtroDistrito = distrito === TODOS_LOS_DISTRITOS ? null : distrito;
  const mostrados = filtrarUnidades(grupos, vista, filtroDistrito, revision.rutasPorRevisar, encuestadorDe);
  const reemplazosDe = enfocada?.role === "titular" ? units.filter((u) => u.titular_id === enfocada.unit_id) : [];
  const vacioDeVista = vista === "por-revisar"
    ? { titulo: "Ninguna ruta por revisar", descripcion: "Todas las titulares alcanzan con sus viviendas." }
    : vista === "sin-encuestador"
      ? { titulo: "Todas las titulares tienen encuestador", descripcion: "La asignación está completa." }
      : null;
  return (
    <div className="rec-terr-seccion">
      {unidades.stale ? <AvisoDesactualizada enviadoAt={unidades.enviado_at} /> : null}
      <header className="rec-terr-cabeza">
        <span>
          <h2>UMP de la muestra</h2>
          <p>
            {unidades.n_titulares.toLocaleString("es-PE")} titulares y {unidades.n_reemplazos.toLocaleString("es-PE")} reemplazos, {ROTULO_DE_FASE[unidades.fase].toLocaleLowerCase("es-PE")}
            {cuando ? `, enviada el ${cuando}` : ""}
          </p>
        </span>
      </header>

      <div className="rec-terr-herramientas" role="toolbar" aria-label="Filtros de las UMP">
        <GlidingRadioGroup
          value={vista}
          options={VISTAS}
          getOptionValue={(o) => o.id}
          onValueChange={(v) => { setBusqueda(""); setVista(v); }}
          className="rec-terr-opciones"
          aria-label="Qué UMP mostrar"
        >
          {(o) => <span>{o.label} <b className="rec-terr-vista-cifra">{conteo[o.id].toLocaleString("es-PE")}</b></span>}
        </GlidingRadioGroup>
        <PulsoSelect
          value={distrito}
          onValueChange={setDistrito}
          ariaLabel="Distrito"
          size="sm"
          className="rec-terr-distrito-select"
          options={[
            { value: TODOS_LOS_DISTRITOS, label: "Todos los distritos" },
            ...revision.distritos.map((d) => ({ value: d.clave, label: d.distrito || d.clave })),
          ]}
        />
        <label className="rec-terr-buscar">
          <Search size={14} aria-hidden />
          <PulsoInput
            type="search"
            aria-label="Buscar UMP"
            placeholder="UMP, distrito, zona o manzana"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
      </div>

      <div className="rec-terr-unidades" data-con-inspector={enfocada ? "" : undefined}>
      <div className="rec-terr-unidades-lista">
      {mostrados.length ? (
        mostrados.map((g) => (
          <section key={g.clave} className="rec-terr-distrito" aria-label={`Distrito ${g.distrito || g.clave}`}>
            {!filtroDistrito ? <h3>{g.distrito || g.clave}<small>{g.titulares.length.toLocaleString("es-PE")} {g.titulares.length === 1 ? "titular" : "titulares"}</small></h3> : null}
            <PulsoTable
              columnas={columnas}
              filas={[...g.titulares.flatMap(({ titular, reemplazos }) => [titular, ...reemplazos]), ...g.sueltos].map((u) => ({ u, estado: revision.porUnidad.get(u.unit_id), encuestador: encuestadorDe.get(u.unit_id) ?? null }))}
              idDeFila={(f) => f.u.unit_id}
              ariaLabel={`UMP de ${g.distrito || g.clave}`}
              densidad="compacta"
              seleccionada={foco}
              onSeleccionar={(id) => navigate(hrefDeFoco(id))}
              altoMaximo={100000}
            />
          </section>
        ))
      ) : (
        <EstadoVacio
          icono={<Search size={18} />}
          titulo={!unidades.units.length ? "La muestra enviada no trae UMP" : busqueda.trim() ? `Ninguna UMP coincide con «${busqueda}»` : vacioDeVista?.titulo ?? "Ninguna UMP en este distrito"}
          descripcion={!unidades.units.length ? "Vuelve a enviarla desde Hojas de ruta." : busqueda.trim() ? "Prueba con el código, el distrito o la zona." : vacioDeVista?.descripcion ?? "Elige otro distrito."}
        />
      )}
      </div>
      {enfocada ? (
        <InspectorUmp
          unidad={enfocada}
          reemplazos={reemplazosDe}
          estado={revision.porUnidad.get(enfocada.unit_id)}
          encuestador={encuestadorDe.get(enfocada.unit_id) ?? null}
          hrefCerrar={hrefSinFoco}
          hrefFicha={hrefDeHoja(enfocada.unit_id)}
          hrefReemplazo={hrefDeReemplazo(enfocada.titular_id ?? enfocada.unit_id)}
        />
      ) : null}
      </div>

      <DialogoHojaUmp
        unidad={enfocada}
        stale={unidades.stale}
        hrefAnterior={vecinas.anterior ? hrefDeHoja(vecinas.anterior) : null}
        hrefSiguiente={vecinas.siguiente ? hrefDeHoja(vecinas.siguiente) : null}
        motivo={enfocada ? revision.porUnidad.get(enfocada.unit_id)?.motivo ?? null : null}
      />
    </div>
  );
}
