import { useEffect, useState } from "react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { apiHojasRutaBitacora, apiHojasRutaBitacoraAnotar, type HojasRutaBitacoraEntrada } from "../../../../api/hojasRuta";
import "./bitacora.css";

/**
 * Bitácora de decisiones (U17) dentro de las salidas de Selección. Va aquí y no en
 * un `?panel=bitacora` propio mientras la página clásica sea la de por defecto: el
 * QA recorre los paneles declarados sobre esa página, y uno que sólo existe en el
 * lienzo abriría nada (ADR 0114 §3, enmienda de U17). Se monta en las dos páginas
 * (el panel de salidas del lienzo y el de la mesa clásica), así que trae su CSS.
 */

const ACCION: Record<string, string> = {
  territorio_confirmado: "Territorio",
  poblacion_calculada: "Población",
  tamano_calculado: "Tamaño",
  marco_elegible_adoptado: "Marco elegible adoptado",
  sorteo: "Sorteo",
  decision_cobertura: "Decisión de cobertura",
  plan_supuestos: "Plan de campo",
  reemplazos_puntuales: "Reemplazos puntuales",
  campo_desde_piloto: "Campo desde la piloto",
  cuotas_recalculadas: "Cuotas por hoja",
  nota: "Nota",
};

/** Vacía no siempre significa «sin decisiones»: un proyecto con muestra es anterior a la bitácora (U17). */
export const mensajeBitacoraVacia = (conDecisionesPrevias: boolean) =>
  conDecisionesPrevias
    ? "Este proyecto se diseñó antes de que existiera la bitácora: sus decisiones previas no quedaron registradas. Desde ahora, cada sorteo, cambio de tamaño o de marco elegible deja aquí su rastro."
    : "Todavía no hay decisiones registradas. Cada sorteo, cambio de tamaño o de marco elegible deja aquí su rastro.";

const cuando = (iso: string) => {
  const d = new Date(iso.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** `conDecisionesPrevias`: el proyecto ya tiene muestra; si la bitácora está vacía, es anterior a ella (B23). */
export function BitacoraSeccion({ conDecisionesPrevias = false }: { conDecisionesPrevias?: boolean } = {}) {
  const [entradas, setEntradas] = useState<HojasRutaBitacoraEntrada[] | null>(null);
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const leer = () =>
    apiHojasRutaBitacora()
      .then((e) => {
        setEntradas(e);
        setError("");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo leer la bitácora"));
  useEffect(() => {
    void leer();
  }, []);
  return (
    <section className="hr-muestra-grupo hr-bitacora-seccion" aria-label="Bitácora de decisiones">
      <h3>Bitácora de decisiones</h3>
      {error ? <p className="hr-bitacora-aviso">{error}</p> : null}
      {entradas === null && !error ? <p className="hr-bitacora-vacio">Leyendo la bitácora…</p> : null}
      {entradas && !entradas.length ? (
        <p className="hr-bitacora-vacio">
          {mensajeBitacoraVacia(conDecisionesPrevias)}
        </p>
      ) : null}
      {entradas?.length ? (
        <ol className="hr-bitacora">
          {entradas.slice(0, 30).map((e) => (
            <li key={e.id}>
              <span>
                <strong>{ACCION[e.accion] ?? e.accion}</strong>
                <small>{cuando(e.fecha)}, {e.fase === "pilot" ? "Piloto" : "Campo real"}</small>
              </span>
              <p>{e.resumen}</p>
            </li>
          ))}
        </ol>
      ) : null}
      <textarea className="hr-bitacora-nota" aria-label="Nota para la bitácora" placeholder="Anota una decisión o un acuerdo con el equipo" value={nota} onChange={(ev) => setNota(ev.target.value)} rows={2} />
      <PulsoButton
        variant="secondary"
        size="sm"
        disabled={!nota.trim() || guardando}
        onClick={() => {
          setGuardando(true);
          apiHojasRutaBitacoraAnotar("nota", nota.trim())
            .then(() => {
              setNota("");
              return leer();
            })
            .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo anotar"))
            .finally(() => setGuardando(false));
        }}
      >
        {guardando ? "Anotando…" : "Anotar"}
      </PulsoButton>
    </section>
  );
}
