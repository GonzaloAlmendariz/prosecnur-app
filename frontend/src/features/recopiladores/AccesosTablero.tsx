// Aulas › Accesos con el kit de tablero (pasada de diseño, 2 nov 2026). Era el n.º 1
// del ranking de fealdad: un vacío de 18 px que explicaba tres cosas y otro que partía
// «30 aulas» en una columna. Aquí la sección dice, antes de que el usuario haga nada,
// cuánto falta (cifras), qué se va a comprobar (los tres chequeos con su estado) y a
// quién le toca el enlace (las aulas del plan como fichas que lo esperan).

import { CifrasEnTarjeta } from "../../components/CifrasEnTarjeta";
import { Panel } from "../../components/Panel";
import { CheckCircle2, Link2, Loader2 } from "../../vendor/lucide-react";
import { PulsoButton } from "../../components/PulsoButton";
import "./styles/accesosTablero.css";

const miles = (n: number) => n.toLocaleString("es-PE");

const ESTADO: Record<string, { rotulo: string; tono?: "aviso" | "listo" }> = {
  draft: { rotulo: "Borrador" },
  prepared: { rotulo: "Preparados", tono: "listo" },
  handed_off: { rotulo: "Entregados", tono: "listo" },
  stale: { rotulo: "Desactualizados", tono: "aviso" },
};

export function CifrasDeAccesos({ aulas, conAcceso, canal, estado }: {
  aulas: number;
  conAcceso: number;
  canal: string;
  estado: string | null;
}) {
  const e = estado ? ESTADO[estado] : null;
  return (
    <CifrasEnTarjeta
      cifras={[
        { id: "aulas", rotulo: "Aulas del plan", valor: miles(aulas), nota: "titulares que necesitan enlace" },
        {
          id: "acceso", rotulo: "Con acceso", valor: miles(conAcceso), de: aulas,
          avance: { valor: conAcceso, total: aulas, etiqueta: "Aulas con acceso" },
        },
        { id: "canal", rotulo: "Canal", valor: <span className="rec-acc-canal">{canal}</span>, nota: "de dónde salen los enlaces" },
        {
          id: "estado", rotulo: "Estado", valor: <span className="rec-acc-canal">{e?.rotulo ?? "Sin preparar"}</span>,
          nota: e ? "de los accesos guardados" : "todavía no se guarda nada",
          tono: e?.tono ?? "aviso",
        },
      ]}
    />
  );
}

const CHEQUEOS = [
  { id: "plataforma", titulo: "La plataforma lo permite", detalle: "El formulario existe, acepta respuestas y admite el enlace por aula." },
  { id: "pulso", titulo: "Pulso ya sabe hacerlo", detalle: "Hay una implementación para este canal en esta versión de la app." },
  { id: "version", titulo: "Esta versión lo autoriza", detalle: "La política de la versión deja usar el canal para un operativo real." },
] as const;

/** Antes de comprobar: lo que se va a mirar, con su estado y una sola acción. */
export function ChequeosDelOrigen({ ocupado, onComprobar }: { ocupado: boolean; onComprobar: () => void }) {
  return (
    <div className="rec-acc-chequeos">
      <ol>
        {CHEQUEOS.map((c, i) => (
          <li key={c.id}>
            <span className="rec-acc-paso" aria-hidden>{i + 1}</span>
            <span className="rec-acc-chequeo-texto">
              <strong>{c.titulo}</strong>
              <small>{c.detalle}</small>
            </span>
            <span className="rec-acc-estado">Sin comprobar</span>
          </li>
        ))}
      </ol>
      <div className="rec-acc-chequeos-pie">
        <PulsoButton variant="primary" size="sm" onClick={onComprobar} disabled={ocupado}>
          {ocupado ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <CheckCircle2 size={14} aria-hidden />} Comprobar ahora
        </PulsoButton>
      </div>
    </div>
  );
}

/** Vinculación sin enlaces: las aulas del plan, cada una esperando el suyo. */
export function AulasSinAcceso({ codigos }: { codigos: readonly string[] }) {
  return (
    <Panel
      variant="subtle"
      title={<><Link2 size={16} aria-hidden /> {miles(codigos.length)} aulas esperan su enlace</>}
      hint="Cada ficha se llena cuando la vista previa trae el enlace de la plataforma."
    >
      <ul className="rec-acc-fichas">
        {codigos.map((c) => <li key={c}>{c}</li>)}
      </ul>
    </Panel>
  );
}
