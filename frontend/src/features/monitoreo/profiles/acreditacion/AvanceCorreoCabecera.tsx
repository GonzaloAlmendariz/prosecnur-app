import type { MonitoreoMailchimpAudiencia, MonitoreoMailchimpEstado } from "../../../../api/monitoreoMailchimp";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Loader2, Mail, RefreshCw } from "../../../../vendor/lucide-react";
import { fechaCompleta, haceCuanto } from "./avanceCorreoMatriz";
import { type AvanceDeLectura, cifra, nombreAudiencia, porcentaje } from "./avanceCorreoModelo";

// Cabecera compacta de Avance › Correo: título, audiencia, frescura de la
// lectura y la acción primaria con su progreso dentro del propio botón. Sin
// tarjeta-envoltorio: es la cabeza del panel.

export type AvanceCorreoCabeceraProps = {
  idTitulo: string;
  estado: MonitoreoMailchimpEstado | null;
  audiencias: MonitoreoMailchimpAudiencia[];
  lectura: AvanceDeLectura | null;
  guardandoAudiencia: boolean;
  elegida: string;
  cambiando: boolean;
  ahora: number;
  onElegir: (listId: string) => void;
  onGuardarAudiencia: () => void;
  onCambiar: () => void;
  onCancelarCambio: () => void;
  onActualizar: () => void;
};

export function AvanceCorreoCabecera({
  idTitulo,
  estado,
  audiencias,
  lectura,
  guardandoAudiencia,
  elegida,
  cambiando,
  ahora,
  onElegir,
  onGuardarAudiencia,
  onCambiar,
  onCancelarCambio,
  onActualizar,
}: AvanceCorreoCabeceraProps) {
  const leyendo = lectura !== null;
  const ocupado = leyendo || guardandoAudiencia;
  const listId = estado?.list_id ?? "";
  const conectado = Boolean(estado?.conectado);
  const eligiendo = conectado && (!listId || cambiando);
  const valorSelector = elegida || (cambiando ? listId : "");
  const pct = lectura?.percent ?? null;

  return (
    <header className="mon-correo-cabecera">
      <div className="mon-correo-cabecera-titulo">
        <span className="mon-correo-cabecera-icono" aria-hidden><Mail size={16} /></span>
        <div>
          <span className="mon-correo-versalita">Avance</span>
          <h2 id={idTitulo}>Correo</h2>
        </div>
      </div>

      {conectado ? (
        <div className="mon-correo-audiencia" role="group" aria-label="Audiencia de Mailchimp">
          {eligiendo ? (
            <>
              <label className="mon-correo-filtro">
                <span className="mon-correo-versalita">Audiencia</span>
                <select value={valorSelector} disabled={ocupado} onChange={(e) => onElegir(e.target.value)}>
                  <option value="">Elige la audiencia</option>
                  {audiencias.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name || a.id}{a.member_count != null ? ` · ${cifra(a.member_count)} contactos` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <PulsoButton variant="secondary" size="sm" disabled={ocupado || !elegida || elegida === listId} onClick={onGuardarAudiencia}>
                {guardandoAudiencia ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null}
                Usar esta audiencia
              </PulsoButton>
              {cambiando ? (
                <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={onCancelarCambio}>Cancelar</PulsoButton>
              ) : null}
            </>
          ) : (
            <>
              <span className="mon-correo-versalita">Audiencia</span>
              <strong className="mon-correo-audiencia-nombre">{nombreAudiencia(listId, audiencias)}</strong>
              <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={onCambiar}>Cambiar</PulsoButton>
            </>
          )}
        </div>
      ) : null}

      {conectado && listId ? (
        <div className="mon-correo-cabecera-accion">
          {estado?.leido_at ? (
            <span className="mon-correo-leido" title={fechaCompleta(estado.leido_at)}>
              Leído {haceCuanto(estado.leido_at, ahora) || fechaCompleta(estado.leido_at)}
            </span>
          ) : (
            <span className="mon-correo-leido">Sin lecturas</span>
          )}
          <PulsoButton
            variant="primary"
            size="sm"
            disabled={ocupado}
            onClick={onActualizar}
            className="mon-correo-actualizar"
            aria-describedby={leyendo ? `${idTitulo}-progreso` : undefined}
          >
            {leyendo ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
            {leyendo ? `Leyendo${pct != null ? ` ${porcentaje(pct / 100)}` : "…"}` : "Actualizar desde Mailchimp"}
            {leyendo ? (
              <i
                className="mon-correo-actualizar-avance"
                style={{ inlineSize: `${Math.max(4, Math.min(100, pct ?? 4))}%` }}
                aria-hidden
              />
            ) : null}
          </PulsoButton>
        </div>
      ) : null}

      {lectura ? (
        <div className="mon-correo-progreso" id={`${idTitulo}-progreso`} role="status">
          <span>Leyendo Mailchimp{lectura.message ? ` — ${lectura.message}` : "…"}</span>
          <div
            className="mon-correo-progreso-barra"
            role="progressbar"
            aria-label="Avance de la lectura de Mailchimp"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct ?? undefined}
          >
            <i style={{ inlineSize: `${Math.max(2, Math.min(100, pct ?? 2))}%` }} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
