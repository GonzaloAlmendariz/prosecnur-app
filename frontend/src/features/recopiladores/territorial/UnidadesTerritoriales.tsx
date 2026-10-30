// Territorial › Unidades › Lista (ADR 0118 §1): las UMP de la foto. Una franja
// de distritos arriba (titulares, reemplazos y rutas por revisar) elige cuál se
// ve; la lista es una tabla con el reemplazo debajo de su titular y el estado de
// cada UMP con el criterio de Selección (checklist M3–M5). `foco=<id_manzana>`
// resalta una (y elige su distrito); `panel=hoja` abre su hoja (DialogoHojaUmp).
//
// Contrato de Superficie:
// - C1: `material-campo/territorial/distritos` (equal), un distrito por miembro de la franja.
// - C3: sin foto o sin coincidencias, el vacío es de la lista (EstadoVacio).
// - C4: el scroll es del panel de la sección; la tabla del kit (PulsoTable) no fija alto propio.

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { UnidadTerritorial, UnidadesTerritoriales as Unidades } from "../../../api/materialTerritorial";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { ROTULO_DE_FASE } from "../campanas/modeloRegistro";
import { AlertTriangle, FileText, MapPinned, Search } from "../../../vendor/lucide-react";
import { DialogoHojaUmp } from "./DialogoHojaUmp";
import { agruparUnidades, fechaDelEnvio, unidadDelFoco } from "./modeloUnidades";
import { revisarUnidades, type EstadoUnidad } from "./revisionUnidades";
import type { SupuestosVisitas } from "../../hojasRuta/seleccion/visitas";

/** Selección › Entrega en Hojas de ruta: donde se (re)envía la muestra. */
export const HREF_REENVIO = "/hojas-ruta?seccion=seleccion&panel=salidas";

type Props = {
  unidades: Unidades | null;
  /** El mensaje del 409 cuando la foto ya no está. */
  sinFuente: string | null;
  foco: string | null;
  hrefDeFoco: (foco: string) => string;
  hrefDeHoja: (foco: string) => string;
  /** Respuesta y ocupación del estudio: «no alcanza» se mide en visitas, como en Selección. */
  supuestos?: SupuestosVisitas;
};

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
const TODOS = "__todos";

type FilaTabla = { u: UnidadTerritorial; estado: EstadoUnidad | undefined };

function columnasDe(hrefDeHoja: (foco: string) => string): PulsoTableColumna<FilaTabla>[] {
  return [
    { id: "ump", encabezado: "UMP", ancho: 110, celda: ({ u }) => <span className={`rec-terr-ump-codigo is-${u.role}`}>{u.label}</span> },
    { id: "zona", encabezado: "Zona", ancho: 90, celda: ({ u }) => u.zona || "—" },
    { id: "manzana", encabezado: "Manzana", ancho: 100, celda: ({ u }) => u.manzana || "—" },
    { id: "encuestas", encabezado: "Encuestas", ancho: 110, tipo: "cifra", celda: ({ u }) => (u.rango_inicio !== null && u.rango_fin !== null ? `${u.rango_inicio}–${u.rango_fin}` : "—") },
    { id: "viviendas", encabezado: "Viviendas", ancho: 100, tipo: "cifra", celda: ({ u }) => fmt(u.viviendas) },
    { id: "estado", encabezado: "Estado", ancho: 140, celda: ({ estado }) => (estado && estado.tono !== "ok" ? <span className="rec-terr-estado" data-estado={estado.tono}>{estado.motivo}</span> : null) },
    { id: "hoja", encabezado: "Hoja", ancho: 90, celda: ({ u }) => (
      <Link className="rec-terr-ump-hoja" to={hrefDeHoja(u.unit_id)} aria-label={`Ver la hoja de ${u.label}`} onClick={(e) => e.stopPropagation()}>
        <FileText size={13} aria-hidden /> Hoja
      </Link>
    ) },
  ];
}

export function UnidadesTerritoriales({ unidades, sinFuente, foco, hrefDeFoco, hrefDeHoja, supuestos }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const units = useMemo(() => unidades?.units ?? [], [unidades]);
  const grupos = useMemo(() => agruparUnidades(units, busqueda), [busqueda, units]);
  const revision = useMemo(() => revisarUnidades(units, supuestos), [units, supuestos]);
  const enfocada = unidadDelFoco(units, foco);
  const navigate = useNavigate();
  const columnas = useMemo(() => columnasDe(hrefDeHoja), [hrefDeHoja]);
  // M7: el orden de la lista (todas las UMP, titular y sus reemplazos) para pasar de hoja en hoja.
  const orden = useMemo(() => agruparUnidades(units).flatMap((g) => [...g.titulares.flatMap(({ titular, reemplazos }) => [titular, ...reemplazos]), ...g.sueltos].map((u) => u.unit_id)), [units]);
  const iFoco = foco ? orden.indexOf(foco) : -1;
  const vecinas = { anterior: iFoco > 0 ? orden[iFoco - 1] : null, siguiente: iFoco >= 0 && iFoco < orden.length - 1 ? orden[iFoco + 1] : null };
  // Distrito a la vista: el de la UMP enfocada si la hay; si no, el primero. Con búsqueda se ven todos.
  const [elegido, setElegido] = useState<string | null>(null);
  const claveFoco = enfocada ? enfocada.ubigeo || enfocada.distrito : null;
  // Si la UMP enfocada es de otro distrito (se llegó con «Siguiente» o por un enlace), la lista la sigue.
  const sigueAlFoco = claveFoco && elegido && elegido !== TODOS && elegido !== claveFoco;
  const visible = busqueda.trim() ? TODOS : sigueAlFoco ? claveFoco : elegido ?? claveFoco ?? revision.distritos[0]?.clave ?? TODOS;

  if (!unidades) {
    return (
      <div className="rec-terr-seccion" data-qa-geometry-capacity="owned">
        <VacioSinFuente mensaje={sinFuente} />
      </div>
    );
  }

  const cuando = fechaDelEnvio(unidades.enviado_at);
  const porRevisar = revision.distritos.reduce((a, d) => a + d.porRevisar, 0);
  const mostrados = visible === TODOS ? grupos : grupos.filter((g) => g.clave === visible);
  return (
    <div className="rec-terr-seccion">
      {unidades.stale ? <AvisoDesactualizada enviadoAt={unidades.enviado_at} /> : null}
      <header className="rec-terr-cabeza">
        <span>
          <h2>UMP de la muestra</h2>
          <p>
            {unidades.n_titulares.toLocaleString("es-PE")} titulares y {unidades.n_reemplazos.toLocaleString("es-PE")} reemplazos
            {` · ${ROTULO_DE_FASE[unidades.fase]}`}
            {cuando ? ` · enviada el ${cuando}` : ""}
            {porRevisar ? ` · ${porRevisar} ${porRevisar === 1 ? "ruta" : "rutas"} por revisar` : ""}
          </p>
        </span>
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
      </header>

      <nav className="rec-terr-franja" aria-label="Distritos de la muestra" data-qa-geometry-group="material-campo/territorial/distritos" data-qa-geometry-contract="equal">
        {revision.distritos.map((d) => (
          <button key={d.clave} type="button" className="rec-terr-franja-distrito" data-qa-geometry-member aria-pressed={visible === d.clave} onClick={() => { setBusqueda(""); setElegido(d.clave); }}>
            <strong>{d.distrito || d.clave}</strong>
            <small>{d.titulares} titulares · {d.reemplazos} reemplazos</small>
            {d.porRevisar ? <em data-estado="aviso">{d.porRevisar} por revisar</em> : <em>sin observaciones</em>}
          </button>
        ))}
        <button type="button" className="rec-terr-franja-todos" aria-pressed={visible === TODOS} onClick={() => setElegido(TODOS)}>Todos</button>
      </nav>

      {mostrados.length ? (
        mostrados.map((g) => (
          <section key={g.clave} className="rec-terr-distrito" aria-label={`Distrito ${g.distrito || g.clave}`}>
            {visible === TODOS ? <h3>{g.distrito || g.clave}<small>{g.titulares.length.toLocaleString("es-PE")} {g.titulares.length === 1 ? "titular" : "titulares"}</small></h3> : null}
            <PulsoTable
              columnas={columnas}
              filas={[...g.titulares.flatMap(({ titular, reemplazos }) => [titular, ...reemplazos]), ...g.sueltos].map((u) => ({ u, estado: revision.porUnidad.get(u.unit_id) }))}
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
          titulo={unidades.units.length ? `Ninguna UMP coincide con «${busqueda}»` : "La muestra enviada no trae UMP"}
          descripcion={unidades.units.length ? "Prueba con el código, el distrito o la zona." : "Vuelve a enviarla desde Hojas de ruta."}
        />
      )}

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
