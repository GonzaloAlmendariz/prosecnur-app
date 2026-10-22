import type { PuntoDeSerie } from "./avanceCorreoEmbudoModelo";
import { cifra } from "./avanceCorreoModelo";

// Mini-serie de barras: respuestas atribuidas a cada envío del público
// (invitación, R1, R2…). La escala es la del propio público: se lee la forma
// —cuánto rinde cada recordatorio frente a la invitación—; las cifras van en
// el nombre accesible y en el `title` de cada barra.

export function AvanceCorreoSerie({ puntos, publico }: { puntos: PuntoDeSerie[]; publico: string }) {
  if (!puntos.length) return <span className="mon-correo-tenue">—</span>;
  const max = Math.max(0, ...puntos.map((p) => p.respuestas ?? 0));
  const resumen = puntos.map((p) => `${p.rotulo} ${cifra(p.respuestas)}`).join("; ");
  return (
    <span className="mon-correo-serie" role="img" aria-label={`Respuestas por envío de ${publico}: ${resumen}`}>
      {puntos.map((p) => {
        const alto = max > 0 && p.respuestas ? Math.max(8, (p.respuestas / max) * 100) : 0;
        return (
          <span key={p.campaign_id} className="mon-correo-serie-col" title={`${p.rotulo}: ${cifra(p.respuestas)} respuestas`}>
            <span className="mon-correo-serie-pista">
              <i className={p.posicion === 1 ? "es-invitacion" : undefined} style={{ blockSize: `${alto}%` }} />
            </span>
            <small aria-hidden>{p.rotuloCorto}</small>
          </span>
        );
      })}
    </span>
  );
}
