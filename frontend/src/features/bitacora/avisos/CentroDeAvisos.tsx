import { BellOff, Clock, X } from "../../../vendor/lucide-react";

import { EmptyState } from "../../../components/States";
import { identidadDeFase } from "../identidadDeFase";
import { POSPONER_SUGERIDO, type Aviso } from "./motor";
import type { ControlAvisos } from "./useAvisos";
import "./avisos.css";

/**
 * Centro de avisos (ADR 0047).
 *
 * Es un PANEL direccionable (`?panel=avisos`), no un popover suelto: la regla
 * de la casa pide que todo overlay viva en la URL, y de paso eso lo vuelve
 * alcanzable por el QA visual.
 *
 * Muestra los vencidos agrupados por cercanía y los próximos como lista plana.
 * Los vencidos se agrupan porque al abrir tras días cerrada pueden ser decenas
 * y una lista corrida no se lee.
 */
export function CentroDeAvisos({
  control,
  catalogoFases,
  onCerrar,
}: {
  control: ControlAvisos;
  catalogoFases: ReadonlyArray<{ id: string; modulo: string; seccion: string }>;
  onCerrar: () => void;
}) {
  const hayAlgo = control.vencidos.length > 0 || control.proximos.length > 0;

  return (
    <aside
      className="bit-avisos"
      role="dialog"
      aria-label="Centro de avisos"
      data-audit-ready="bitacora-avisos"
    >
      <header className="bit-avisos-cabecera">
        <div>
          <strong>Avisos</strong>
          <small>
            {control.vencidos.length > 0
              ? `${control.vencidos.length} sin atender`
              : "Nada pendiente"}
          </small>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar el centro de avisos">
          <X size={15} />
        </button>
      </header>

      <div className="bit-avisos-cuerpo">
        {!hayAlgo ? (
          <EmptyState
            icon={<BellOff size={26} aria-hidden="true" />}
            title="Ningún aviso por ahora"
            hint="Los recordatorios que pongas en un hito del cronograma aparecen acá cuando les llega la hora."
            variant="inline"
          />
        ) : (
          <>
            {control.grupos.map((grupo) => (
              <section key={grupo.bucket} aria-label={grupo.label}>
                <h4 className="bit-avisos-titulo">
                  <span>{grupo.label}</span>
                  <small>{grupo.avisos.length}</small>
                </h4>
                <ul className="bit-avisos-lista">
                  {grupo.avisos.map((aviso) => (
                    <FilaAviso
                      key={aviso.clave}
                      aviso={aviso}
                      catalogoFases={catalogoFases}
                      onPosponer={(minutos) => void control.posponer(aviso, minutos)}
                      onDescartar={() => void control.descartar(aviso)}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {control.proximos.length > 0 && (
              <section aria-label="Próximos avisos">
                <h4 className="bit-avisos-titulo">
                  <span>Próximos</span>
                  <small>{control.proximos.length}</small>
                </h4>
                <ul className="bit-avisos-lista is-proximos">
                  {control.proximos.slice(0, 12).map((aviso) => (
                    <li key={aviso.clave} className="bit-aviso is-proximo">
                      <Sello aviso={aviso} catalogoFases={catalogoFases} />
                      <span className="bit-aviso-cuerpo">
                        <strong>{aviso.actividad}</strong>
                        <small>{cuandoSuena(aviso)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function Sello({
  aviso,
  catalogoFases,
}: {
  aviso: Aviso;
  catalogoFases: ReadonlyArray<{ id: string; modulo: string; seccion: string }>;
}) {
  const fase = catalogoFases.find((f) => f.id === aviso.fase);
  const identidad = identidadDeFase(fase?.modulo, fase?.seccion);
  const Icono = identidad.icono;
  return (
    <span className="bit-aviso-sello" style={identidad.vars} aria-hidden="true">
      {Icono ? <Icono size={14} /> : <Clock size={14} />}
    </span>
  );
}

function FilaAviso({
  aviso,
  catalogoFases,
  onPosponer,
  onDescartar,
}: {
  aviso: Aviso;
  catalogoFases: ReadonlyArray<{ id: string; modulo: string; seccion: string }>;
  onPosponer: (minutos: number) => void;
  onDescartar: () => void;
}) {
  return (
    <li className="bit-aviso">
      <Sello aviso={aviso} catalogoFases={catalogoFases} />
      <span className="bit-aviso-cuerpo">
        <strong>{aviso.actividad}</strong>
        <small>{cuandoVencio(aviso)}</small>
      </span>
      <span className="bit-aviso-acciones">
        {/* Posponer con opciones y no un único "más tarde": "más tarde" sin
            decir cuándo es lo mismo que descartar sin decirlo. */}
        <label className="bit-aviso-posponer">
          <span className="pulso-sr-only">Posponer {aviso.actividad}</span>
          <select
            value=""
            onChange={(event) => {
              const minutos = Number(event.target.value);
              if (Number.isFinite(minutos) && minutos > 0) onPosponer(minutos);
            }}
          >
            <option value="">Posponer…</option>
            {POSPONER_SUGERIDO.map((o) => (
              <option key={o.minutos} value={o.minutos}>{o.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onDescartar}
          aria-label={`Descartar el aviso de ${aviso.actividad}`}
          title="Descartar"
        >
          <BellOff size={13} />
        </button>
      </span>
    </li>
  );
}

// `hour12: false`: en es-PE el formato de 12 horas rinde "09:00 a. m.", con
// puntos y espacios que en una fila compacta se leen como ruido.
const FORMATO = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function cuandoVencio(aviso: Aviso): string {
  return `Debía avisar el ${FORMATO.format(aviso.cuando).replace(".", "")}`;
}

function cuandoSuena(aviso: Aviso): string {
  return `Avisa el ${FORMATO.format(aviso.cuando).replace(".", "")}`;
}
