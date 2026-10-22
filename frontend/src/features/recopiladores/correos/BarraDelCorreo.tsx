// La barra del correo abierto: UNA línea fina, con el estilo de la barra de
// Láminas de Gráficos (44 px, filete neutro, herramientas en íconos y lo
// secundario en «Más»).
//
// - Izquierda: la miga de la campaña (volver a la lista, nombre y menú), la
//   plataforma en pequeño y el envío que se mira (selector).
// - Centro: deshacer y rehacer, el dispositivo (escritorio, teléfono, oscuro)
//   como íconos con su nombre en el título, y «Ver como».
// - Derecha: UNA lectura del guardado (F6, patrón Láminas): «Guardar» cuando
//   hay cambios, «Guardado» cuando no; y «Exportar ▾» (F7).
// - En compacto, primero el botón del cajón de plantillas y bloques (F3).
// - «Más» (⋯): explicaciones al pasar el cursor, siguiente persona y el asunto.
//   El asunto vive en el inspector, en Bloque › «Asunto y vista previa».
//
// Cuando su contenedor hace scroll (en compacto el panel es el único dueño),
// la barra queda pegada arriba y se compacta. La transición la apaga
// reduced-motion.

import * as Popover from "@radix-ui/react-popover";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { MailPlatform, MailSend } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { Check, Loader2, Monitor, Moon, MoreHorizontal, Redo2, Save, Smartphone, Undo2, type LucideIcon } from "../../../vendor/lucide-react";
import { NOMBRE_DE_PLATAFORMA } from "./dialectos";
import type { VistaDelCorreo } from "./modeloCorreo";
import { SelectorDeEnvio } from "./SelectorDeEnvio";
import { NOTA_DEL_PROYECTO } from "./store";
import "./correosBarra.css";

const DISPOSITIVOS: { value: VistaDelCorreo; label: string; icono: LucideIcon }[] = [
  { value: "escritorio", label: "Escritorio", icono: Monitor },
  { value: "telefono", label: "Teléfono", icono: Smartphone },
  { value: "oscuro", label: "Modo oscuro", icono: Moon },
];

type Props = {
  cabecera?: ReactNode;
  /** El cajón de plantillas y bloques, sólo en compacto. */
  cajon?: ReactNode;
  /** «Exportar ▾». */
  exportar?: ReactNode;
  plataforma: MailPlatform;
  envios: readonly MailSend[];
  envio: MailSend;
  onElegirEnvio: (sendId: string) => void;
  onAgregarEnvio: () => void;
  onGestionarEnvios: () => void;
  exportados?: Readonly<Record<string, string>>;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  onDeshacer: () => void;
  onRehacer: () => void;
  vista: VistaDelCorreo;
  onVista: (vista: VistaDelCorreo) => void;
  explicaciones: boolean;
  onExplicaciones: (si: boolean) => void;
  persona: { nombre: string; ejemplo: boolean } | null;
  puedeSiguientePersona: boolean;
  onSiguientePersona: () => void;
  asunto: string;
  onIrAlAsunto: () => void;
  /** Lo que se dice sin cambios por guardar: «Guardado» o «Plantilla de fábrica». */
  estadoGuardado: string;
  guardando: boolean;
  porGuardar: boolean;
  puedeGuardar: boolean;
  onGuardar: () => void;
};

/** El primer ancestro que hace scroll vertical: ahí escucha la barra. */
function dueñoDelScroll(el: HTMLElement | null): HTMLElement | null {
  let nodo = el?.parentElement ?? null;
  while (nodo) {
    const { overflowY } = getComputedStyle(nodo);
    if ((overflowY === "auto" || overflowY === "scroll") && nodo.scrollHeight > nodo.clientHeight) return nodo;
    nodo = nodo.parentElement;
  }
  return null;
}

export function BarraDelCorreo(p: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [compacta, setCompacta] = useState(false);
  const [mas, setMas] = useState(false);

  useEffect(() => {
    const dueño = dueñoDelScroll(ref.current);
    if (!dueño) return;
    const alDesplazar = () => setCompacta(dueño.scrollTop > 8);
    alDesplazar();
    dueño.addEventListener("scroll", alDesplazar, { passive: true });
    return () => dueño.removeEventListener("scroll", alDesplazar);
  }, []);

  return (
    <header ref={ref} className={`rec-mail-barra rec-mail-barra--fina${compacta ? " is-compacta" : ""}`} aria-label="Barra del correo">
      <span className="rec-barra-izq">
        {p.cabecera}
        <span className="rec-barra-plataforma" title={`Esta campaña sale por ${NOMBRE_DE_PLATAFORMA[p.plataforma]}`}>
          {NOMBRE_DE_PLATAFORMA[p.plataforma]}
        </span>
        <span className="rec-barra-sep" aria-hidden>·</span>
        <SelectorDeEnvio
          envios={p.envios}
          activo={p.envio}
          onElegir={p.onElegirEnvio}
          onAgregar={p.onAgregarEnvio}
          onGestionar={p.onGestionarEnvios}
          exportados={p.exportados}
        />
      </span>

      <span className="rec-barra-herramientas" role="toolbar" aria-label="Herramientas del correo">
        {p.cajon}
        <span className="rec-barra-grupo" role="group" aria-label="Deshacer y rehacer">
          <button type="button" className="rec-barra-icono" aria-label="Deshacer" title="Deshacer (⌘Z)" disabled={!p.puedeDeshacer} onClick={p.onDeshacer}>
            <Undo2 size={16} aria-hidden />
          </button>
          <button type="button" className="rec-barra-icono" aria-label="Rehacer" title="Rehacer (⌘⇧Z)" disabled={!p.puedeRehacer} onClick={p.onRehacer}>
            <Redo2 size={16} aria-hidden />
          </button>
        </span>
        <span className="rec-barra-grupo rec-barra-dispositivos" role="radiogroup" aria-label="Cómo se mira el correo">
          {DISPOSITIVOS.map((d) => (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={p.vista === d.value}
              aria-label={d.label}
              title={d.label}
              className={`rec-barra-icono${p.vista === d.value ? " is-on" : ""}`}
              onClick={() => p.onVista(d.value)}
            >
              <d.icono size={16} aria-hidden />
            </button>
          ))}
        </span>
        <button
          type="button"
          className="rec-barra-ver-como"
          disabled={!p.puedeSiguientePersona}
          // El nombre se recorta a la vista; entero, en el título (en todos los anchos).
          title={`Ver como ${p.persona?.nombre || "—"}. ${p.puedeSiguientePersona ? "Pulsa para ver a la siguiente persona." : "Importa destinatarios para ver el correo de cada persona."}`}
          onClick={p.onSiguientePersona}
        >
          Ver como <b>{p.persona?.nombre || "—"}</b>
          {p.persona?.ejemplo ? <span className="rec-mail-chip">ejemplo</span> : null}
        </button>
      </span>

      <span className="rec-barra-der">
        {p.porGuardar || p.guardando ? (
          <PulsoButton
            variant="primary"
            size="sm"
            disabled={!p.puedeGuardar}
            title="Hay cambios sin guardar en este correo"
            onClick={p.onGuardar}
          >
            {p.guardando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Save size={14} aria-hidden />}
            {p.guardando ? "Guardando…" : "Guardar"}
            <span className="pulso-sr-only">: hay cambios sin guardar</span>
          </PulsoButton>
        ) : (
          <span className="rec-mail-guardado" role="status" title={NOTA_DEL_PROYECTO}>
            <Check size={13} aria-hidden />
            {p.estadoGuardado}
          </span>
        )}
        {p.exportar}
        <Popover.Root open={mas} onOpenChange={setMas}>
          <Popover.Trigger asChild>
            <button type="button" className="rec-barra-icono" aria-label="Más opciones del correo" title="Más">
              <MoreHorizontal size={16} aria-hidden />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="rec-barra-menu" role="menu" align="end" sideOffset={6} collisionPadding={12} aria-label="Más opciones del correo">
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={p.explicaciones}
                className="rec-barra-menu-item"
                onClick={() => p.onExplicaciones(!p.explicaciones)}
              >
                <span className="rec-barra-menu-marca" aria-hidden />
                <span className="rec-barra-menu-texto">Explicaciones al pasar el cursor<small>Qué hace cada bloque y cómo sale en {NOMBRE_DE_PLATAFORMA[p.plataforma]}</small></span>
                {/* El interruptor de la casa, solo como dibujo: la semántica es la
                    del ítem de menú (menuitemcheckbox + aria-checked), que es el
                    que recibe el foco y el clic. No cabe un <button> dentro de otro. */}
                <span className="pulso-switch rec-barra-menu-switch" aria-hidden="true" aria-checked={p.explicaciones}>
                  <span className="pulso-switch-thumb" />
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="rec-barra-menu-item"
                disabled={!p.puedeSiguientePersona}
                onClick={() => { setMas(false); p.onSiguientePersona(); }}
              >
                <span className="rec-barra-menu-marca" aria-hidden />
                <span>Siguiente persona<small>{p.puedeSiguientePersona ? "El correo de quien sigue en la lista" : "Importa destinatarios primero"}</small></span>
              </button>
              <button type="button" role="menuitem" className="rec-barra-menu-item" onClick={() => { setMas(false); p.onIrAlAsunto(); }}>
                <span className="rec-barra-menu-marca" aria-hidden />
                <span>Asunto<small title={p.asunto}>{p.asunto || "sin asunto"}</small></span>
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </span>
    </header>
  );
}
