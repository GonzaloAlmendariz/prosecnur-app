import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Loader2 } from "../../../vendor/lucide-react";

import type { DisenoEstudioBitacoraEntry } from "../../../api/disenoEstudio";
import { apiBitacoraUpsert } from "../../../api/client";
import { toast } from "../../../components/toasterStore";
import {
  etiquetaModulo,
  etiquetaTono,
  interpretarEntrada,
  tieneContenido,
} from "./gramatica";

/**
 * Entrada rápida (ADR 0047).
 *
 * La métrica de éxito de la bitácora es que registrar cueste menos que no
 * registrar. Tres interacciones desde la vista principal: enfocar (o `/`),
 * escribir, `Enter`.
 *
 * No abre un modal ni cambia de vista a propósito: cualquiera de las dos cosas
 * convierte "anotar esto antes de que se me olvide" en una tarea, y entonces
 * no se anota.
 *
 * El tono, el módulo y las etiquetas se declaran en línea (`!riesgo`,
 * `@monitoreo`, `#campo`) y se muestran como chips mientras se escribe. Todos
 * tienen default, así que ignorar la sintaxis funciona igual.
 */
export function EntradaRapida({
  onGuardada,
}: {
  onGuardada: (entradas: DisenoEstudioBitacoraEntry[]) => void;
}) {
  const [crudo, setCrudo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  const leido = useMemo(() => interpretarEntrada(crudo), [crudo]);
  const listo = tieneContenido(crudo);

  // `/` enfoca desde cualquier parte de la vista, salvo si ya se está
  // escribiendo en otro campo.
  useEffect(() => {
    function alTeclear(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const activo = document.activeElement;
      const escribiendo =
        activo instanceof HTMLInputElement ||
        activo instanceof HTMLTextAreaElement ||
        (activo instanceof HTMLElement && activo.isContentEditable);
      if (escribiendo) return;
      event.preventDefault();
      campoRef.current?.focus();
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, []);

  async function guardar() {
    if (!listo || guardando) return;
    setGuardando(true);
    try {
      const res = await apiBitacoraUpsert({
        module_id: leido.moduloId,
        tone: leido.tono,
        title: leido.titulo,
        body: leido.cuerpo,
        tags: leido.etiquetas,
      });
      onGuardada(res.bitacora);
      setCrudo("");
      campoRef.current?.focus();
    } catch (err) {
      toast.error("No se pudo guardar la entrada", {
        detalle: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="bit-rapida" data-qa-geometry-capacity="owned">
      <textarea
        ref={campoRef}
        className="bit-rapida-campo"
        value={crudo}
        rows={crudo.includes("\n") ? 4 : 1}
        placeholder="¿Qué pasó? Enter para registrar · !riesgo @monitoreo #campo"
        aria-label="Nueva entrada de bitácora"
        disabled={guardando}
        onChange={(event) => setCrudo(event.target.value)}
        onKeyDown={(event) => {
          // Enter guarda; Shift+Enter es salto de línea. Al revés, escribir dos
          // párrafos exigiría mover el mouse hasta un botón.
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void guardar();
          }
        }}
      />

      <div className="bit-rapida-pie">
        <span className="bit-rapida-chips">
          <span className={`bit-chip is-tono is-${leido.tono}`}>{etiquetaTono(leido.tono)}</span>
          <span className="bit-chip">{etiquetaModulo(leido.moduloId)}</span>
          {leido.etiquetas.map((e) => (
            <span key={e} className="bit-chip is-etiqueta">#{e}</span>
          ))}
        </span>

        <button
          type="button"
          className="bit-boton bit-boton--primario"
          onClick={() => void guardar()}
          disabled={!listo || guardando}
        >
          {guardando ? <Loader2 size={14} className="spin" /> : <CornerDownLeft size={14} />}
          <span>Registrar</span>
        </button>
      </div>
    </div>
  );
}
