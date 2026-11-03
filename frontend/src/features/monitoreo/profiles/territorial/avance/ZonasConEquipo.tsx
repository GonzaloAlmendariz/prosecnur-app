import { Users } from "lucide-react";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import { Popover } from "../../../../../components/Popover";
import { fmt, nombreDeDistrito } from "../rotulos";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { SiluetaDeDistrito } from "./SiluetaDeDistrito";
import type { AvancePorZona, MiembroDelEquipo, Zona } from "./porZonaModelo";
import "./zonasConEquipo.css";

const VISIBLES = 5;
/** Desde cuántos casos en observación se resalta a una persona. */
const OBSERVACION_ALTA = 5;

/** La persona con más casos en observación sumando zonas, y dónde los tiene. */
export function observacionConcentrada(zonas: readonly Zona[]): { codigo: string; casos: number; total: number; donde: Array<{ zona: string; casos: number }> } | null {
  const porCodigo = new Map<string, Array<{ zona: string; casos: number }>>();
  let total = 0;
  for (const z of zonas) {
    total += z.enObservacion;
    for (const p of z.equipo) {
      if (!p.enObservacion) continue;
      porCodigo.set(p.codigo, [...(porCodigo.get(p.codigo) ?? []), { zona: z.nombre, casos: p.enObservacion }]);
    }
  }
  let mejor: { codigo: string; casos: number; donde: Array<{ zona: string; casos: number }> } | null = null;
  for (const [codigo, donde] of porCodigo) {
    const casos = donde.reduce((s, d) => s + d.casos, 0);
    if (!mejor || casos > mejor.casos) mejor = { codigo, casos, donde: donde.sort((a, b) => b.casos - a.casos) };
  }
  return mejor ? { ...mejor, total } : null;
}

/** Quién es un código: su nombre y lo que levantó en esta zona. */
function FichaDePersona({ p, zona }: { p: MiembroDelEquipo; zona: string }) {
  return (
    <span className="mon-zeq-ficha">
      <small>{p.codigo}</small>
      <b>{p.nombre || "Sin nombre en la lista de códigos"}</b>
      <span className="mon-zeq-ficha-dato">{fmt(p.efectivas)} {p.efectivas === 1 ? "efectiva" : "efectivas"} en {zona}, en {fmt(p.dias)} {p.dias === 1 ? "día" : "días"}</span>
      {p.enObservacion ? <span className="mon-zeq-ficha-dato is-obs">{fmt(p.enObservacion)} en observación</span> : null}
    </span>
  );
}

function Persona({ p, max, zona }: { p: MiembroDelEquipo; max: number; zona: Zona }) {
  return (
    <li>
      <Popover
        trigger={<button type="button" className="mon-zeq-codigo-boton" title={p.nombre || undefined}>{p.codigo}</button>}
        align="start"
        maxWidth={260}
        ariaLabel={`Quién es ${p.codigo}`}
      >
        <FichaDePersona p={p} zona={zona.nombre} />
      </Popover>
      <span className="mon-zeq-barra" aria-hidden="true"><i style={{ width: `${(100 * p.efectivas) / Math.max(1, max)}%` }} /></span>
      <b className="mon-zeq-n">{fmt(p.efectivas)}</b>
      <span className="mon-zeq-dias">{fmt(p.dias)} d</span>
      <span className={`mon-zeq-obs${p.enObservacion >= OBSERVACION_ALTA ? " is-alta" : ""}`}>{fmt(p.enObservacion)}</span>
    </li>
  );
}

function TarjetaDeZona({ zona, max }: { zona: Zona; max: number }) {
  const avance = zona.meta > 0 ? Math.round((100 * zona.efectivas) / zona.meta) : 0;
  const visibles = zona.equipo.slice(0, VISIBLES);
  const resto = zona.equipo.slice(VISIBLES);
  const restoEfectivas = resto.reduce((s, p) => s + p.efectivas, 0);
  // ADR 0126: lo que se exige, sean celdas o metas marginales.
  const celdasAbiertas = zona.unidades - zona.unidadesCompletas;
  const pie = [
    resto.length ? `${fmt(resto.length)} ${resto.length === 1 ? "encuestador" : "encuestadores"} más, con ${fmt(restoEfectivas)} ${restoEfectivas === 1 ? "efectiva" : "efectivas"}` : "",
    zona.sinCodigo ? `${fmt(zona.sinCodigo)} ${zona.sinCodigo === 1 ? "caso" : "casos"} con código no reconocido` : "",
  ].filter(Boolean).join(", y ");
  return (
    <article className="mon-zeq-tarjeta" aria-label={zona.nombre} data-qa-geometry-capacity="owned" tabIndex={0}>
      <header className="mon-zeq-cabecera">
        <span className="mon-zeq-sello"><SiluetaDeDistrito distrito={zona.nombre} lado={40} /></span>
        <span className="mon-zeq-nombre">
          <small>{zona.idZona}</small>
          <b>{zona.nombre}</b>
        </span>
        <span className="mon-zeq-avance">
          <b>{avance} %</b>
          <small>{fmt(zona.efectivas)} de {fmt(zona.meta)}</small>
        </span>
      </header>
      <span className="mon-zeq-barra is-meta" aria-hidden="true"><i style={{ width: `${Math.min(100, avance)}%` }} /></span>
      <span className="mon-zeq-fichas">
        <span className={celdasAbiertas ? "is-falta" : "is-ok"}>{fmt(zona.unidadesCompletas)} de {fmt(zona.unidades)} {zona.marginales.length ? "metas" : "celdas"}</span>
        <span>{fmt(zona.enObservacion)} en observación</span>
        {zona.duracionMedianaMin != null ? <span>mediana {fmt(zona.duracionMedianaMin)} min</span> : null}
      </span>
      {zona.equipo.length ? (
        <>
          <div className="mon-zeq-columnas" aria-hidden="true" data-qa-geometry-group={`territorial-zona-columnas-${zona.idZona}`} data-qa-geometry-contract="intrinsic"><span>Código</span><span>Efectivas</span><span className="is-num">N</span><span className="is-num">Días</span><span className="is-num">Obs.</span></div>
          <ul className="mon-zeq-lista" aria-label={`Equipo de ${zona.nombre}`} data-qa-geometry-group={`territorial-zona-equipo-${zona.idZona}`} data-qa-geometry-contract="equal">
            {visibles.map((p) => <Persona key={p.codigo} p={p} max={max} zona={zona} />)}
          </ul>
        </>
      ) : <EstadoVacio icono={<Users size={15} />} titulo="Ningún caso de esta zona trae un código de la lista." />}
      {pie ? <p className="mon-zeq-pie">{pie.charAt(0).toUpperCase() + pie.slice(1)}</p> : null}
    </article>
  );
}

/**
 * Avance › UMP con un envío por cuotas (ADR 0125 A1): cada zona hace de UMP.
 * Una tarjeta por zona con su avance, sus celdas y quién la levantó según los
 * casos. Si Material repartió la cuota por persona, eso vive en Faltante.
 */
export function ZonasConEquipo({ cuotas: crudo }: { cuotas: AvancePorZona }) {
  const cuotas = { ...crudo, zonas: crudo.zonas.map((z) => ({ ...z, nombre: nombreDeDistrito(z.nombre) })) };
  const zonasEnMeta = cuotas.zonas.filter((z) => z.meta > 0 && z.efectivas >= z.meta).length;
  const zonasCerradas = cuotas.zonas.filter((z) => z.unidades && z.unidadesCompletas === z.unidades).length;
  const codigos = new Set(cuotas.zonas.flatMap((z) => z.equipo.map((p) => p.codigo)));
  const sinCodigo = cuotas.zonas.reduce((s, z) => s + z.sinCodigo, 0);
  const concentrada = observacionConcentrada(cuotas.zonas);
  const conAsignacion = cuotas.zonas.some((z) => z.personas.length);
  const max = Math.max(1, ...cuotas.zonas.flatMap((z) => z.equipo.map((p) => p.efectivas)));
  return (
    <section className="mon-zeq" aria-label="Zonas y equipo" data-audit-ready="monitoreo-territorial-avance-zonas" data-qa-geometry-group="territorial-zonas" data-qa-geometry-contract="intrinsic">
      <div className="mon-zeq-banda" data-qa-geometry-group="territorial-zonas-equipo-banda" data-qa-geometry-contract="intrinsic">
        <div className="mon-zeq-tile is-rotulo"><RotuloDePestana /><span className="mon-zeq-nota">En un envío por cuotas, cada zona hace de UMP</span></div>
        <div className="mon-zeq-tile">
          <small>Zonas sobre su meta</small>
          <strong>{fmt(zonasEnMeta)}<span> de {fmt(cuotas.zonas.length)}</span></strong>
          <span className={`mon-zeq-nota${zonasCerradas < cuotas.zonas.length ? " is-falta" : ""}`}>
            {zonasCerradas === cuotas.zonas.length ? "Todas con sus celdas cerradas" : zonasCerradas ? `${fmt(zonasCerradas)} con todas sus celdas cerradas` : "Ninguna con todas sus celdas cerradas"}
          </span>
        </div>
        <div className="mon-zeq-tile">
          <small>Encuestadores</small>
          <strong>{fmt(codigos.size)}<span> con código válido</span></strong>
          <span className="mon-zeq-nota">{sinCodigo ? `${fmt(sinCodigo)} ${sinCodigo === 1 ? "caso" : "casos"} con código no reconocido` : "Todos los casos traen un código de la lista"}</span>
        </div>
        <div className={`mon-zeq-tile${concentrada && concentrada.casos >= OBSERVACION_ALTA ? " is-aviso" : ""}`}>
          <small>Observación concentrada</small>
          {concentrada ? (
            <>
              <strong>{concentrada.codigo}<span> con {fmt(concentrada.casos)} de {fmt(concentrada.total)}</span></strong>
              <span className="mon-zeq-nota">{concentrada.donde.map((d) => `${fmt(d.casos)} en ${d.zona}`).join(" y ")}</span>
            </>
          ) : <strong className="is-texto">Ningún caso en observación</strong>}
        </div>
        <div className={`mon-zeq-tile${conAsignacion ? "" : " is-pendiente"}`}>
          <small>Asignación de Material</small>
          <strong className="is-texto">{conAsignacion ? "Recibida" : "Aún no llega"}</strong>
          <span className="mon-zeq-nota">{conAsignacion ? "La parte de cada persona está en Faltante" : "Mientras tanto se muestra quién levantó cada zona."}</span>
        </div>
      </div>
      <div className="mon-zeq-rejilla" data-qa-geometry-group="territorial-zonas-equipo-rejilla" data-qa-geometry-contract="equal">
        {cuotas.zonas.map((z) => <TarjetaDeZona key={z.idZona} zona={z} max={max} />)}
      </div>
    </section>
  );
}
