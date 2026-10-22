import { useId, useMemo } from "react";

import { Alert } from "../../../../components/Alert";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Loader2, Mail, PlugZap, RefreshCw } from "../../../../vendor/lucide-react";
import { AvanceCorreoCabecera } from "./AvanceCorreoCabecera";
import { AvanceCorreoCronologia } from "./AvanceCorreoCronologia";
import { AvanceCorreoEmbudo } from "./AvanceCorreoEmbudo";
import { AvanceCorreoEnvios } from "./AvanceCorreoEnvios";
import { AvanceCorreoInvalidos } from "./AvanceCorreoInvalidos";
import { AvanceCorreoPublicos } from "./AvanceCorreoPublicos";
import { type EstadoCorreo, faseCorreo, marcaReadiness, publicosDeEnvios } from "./avanceCorreoModelo";
import { paletaDePublicos } from "./paletaPublicos";
import "./paletaPublicos.css";
import "./AvanceCorreo.css";

// Presentación de Avance › Correo: pinta el estado que le da `AvanceCorreo`
// (contenedor con la carga y el job). Sin efectos, para poder probar cada fase
// con un render estático.
//
// Composición: cabecera compacta → embudo (héroe, a todo el ancho) → matriz de
// públicos → cronología con el detalle del envío → tabla de envíos →
// inválidos. Un público elegido (chips del embudo o nombre en la matriz)
// recalcula embudo, cronología y tabla. El panel es el único dueño del scroll.

export type AvanceCorreoVistaProps = {
  s: EstadoCorreo;
  elegida: string;
  cambiando: boolean;
  /** Reloj para «Leído hace N min»; lo refresca el contenedor. */
  ahora: number;
  onElegir: (listId: string) => void;
  onGuardarAudiencia: () => void;
  onCambiar: () => void;
  onCancelarCambio: () => void;
  onActualizar: () => void;
  onReintentar: () => void;
  onPublico: (publico: string) => void;
};

export function AvanceCorreoVista({
  s,
  elegida,
  cambiando,
  ahora,
  onElegir,
  onGuardarAudiencia,
  onCambiar,
  onCancelarCambio,
  onActualizar,
  onReintentar,
  onPublico,
}: AvanceCorreoVistaProps) {
  const ids = useId();
  const estado = s.estado;
  const fase = faseCorreo({ estado, cargando: s.cargando, error: s.error });
  const envios = useMemo(() => estado?.envios ?? [], [estado]);
  const publicosEnvio = useMemo(() => publicosDeEnvios(envios), [envios]);
  const paleta = useMemo(() => paletaDePublicos([
    ...(estado?.publicos ?? []).map((p) => p.actor),
    ...publicosEnvio,
    ...(estado?.invalidos.por_actor ?? []).map((a) => a.actor),
  ]), [estado, publicosEnvio]);
  // Un público que dejó de existir tras una lectura no deja la vista vacía.
  const publico = publicosEnvio.includes(s.publico) || estado?.publicos.some((p) => p.actor === s.publico) ? s.publico : "";
  const conDatos = (fase === "listo" || fase === "sin-envios") && estado;

  return (
    <section
      className="pulso-panel mon-fill-panel mon-advance-panel mon-correo"
      aria-labelledby={`${ids}-titulo`}
      aria-busy={fase === "cargando" || s.lectura !== null}
    >
      <span hidden data-audit-ready={marcaReadiness(fase)} />
      <AvanceCorreoCabecera
        idTitulo={`${ids}-titulo`}
        estado={estado}
        audiencias={s.audiencias}
        lectura={s.lectura}
        guardandoAudiencia={s.guardandoAudiencia}
        elegida={elegida}
        cambiando={cambiando}
        ahora={ahora}
        onElegir={onElegir}
        onGuardarAudiencia={onGuardarAudiencia}
        onCambiar={onCambiar}
        onCancelarCambio={onCancelarCambio}
        onActualizar={onActualizar}
      />

      {s.aviso ? <p className="mon-correo-confirmacion" role="status">{s.aviso}</p> : null}
      {s.error && estado ? <Alert kind="error">{s.error}</Alert> : null}
      {estado && estado.avisos.length > 0 && conDatos ? (
        <Alert kind="warn">
          <ul className="mon-correo-avisos">{estado.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </Alert>
      ) : null}

      {fase === "cargando" ? (
        <p className="mon-correo-cargando" role="status"><Loader2 size={14} className="pulso-spin" aria-hidden /> Leyendo el estado de Mailchimp…</p>
      ) : null}
      {fase === "error" ? (
        <div className="mon-correo-vacio" data-qa-geometry-capacity="owned">
          <EstadoVacio
            tamano="normal"
            icono={<Mail size={18} />}
            titulo="No se pudo leer el estado de Mailchimp"
            descripcion={s.error}
            accion={<PulsoButton variant="secondary" size="sm" onClick={onReintentar}>Reintentar</PulsoButton>}
          />
        </div>
      ) : null}
      {fase === "sin-conexion" ? (
        <div className="mon-correo-vacio" data-qa-geometry-capacity="owned">
          <EstadoVacio
            tamano="normal"
            icono={<PlugZap size={18} />}
            titulo="Falta conectar Mailchimp"
            descripcion="Agrega la clave de Mailchimp en Configuración › Conexiones y vuelve a esta pestaña."
          />
        </div>
      ) : null}
      {fase === "sin-audiencia" ? (
        <div className="mon-correo-vacio" data-qa-geometry-capacity="owned">
          <EstadoVacio
            tamano="normal"
            icono={<Mail size={18} />}
            titulo="Elige la audiencia del estudio"
            descripcion="Es la lista de Mailchimp desde la que salen las invitaciones."
          />
        </div>
      ) : null}
      {fase === "preparando" ? (
        <div className="mon-correo-vacio" data-qa-geometry-capacity="owned">
          <EstadoVacio
            tamano="normal"
            icono={<RefreshCw size={18} />}
            titulo="Monitoreo está preparando el cruce"
            descripcion="Los públicos aparecen apenas termine de cruzar el universo; esta vista se actualiza sola."
          />
        </div>
      ) : null}
      {fase === "sin-lecturas" ? (
        <div className="mon-correo-vacio" data-qa-geometry-capacity="owned">
          <EstadoVacio
            tamano="normal"
            icono={<RefreshCw size={18} />}
            titulo="Todavía no hay lecturas"
            descripcion="Actualiza desde Mailchimp para traer los envíos."
          />
        </div>
      ) : null}

      {conDatos ? (
        <div
          className="mon-correo-cuerpo"
          data-qa-geometry-group="monitoreo/acreditacion/avance/correo"
          data-qa-geometry-contract="intrinsic"
        >
          <AvanceCorreoEmbudo envios={envios} publicos={publicosEnvio} publico={publico} paleta={paleta} onPublico={onPublico} />
          <AvanceCorreoPublicos
            publicos={estado.publicos}
            envios={envios}
            umbrales={estado.umbrales}
            paleta={paleta}
            publico={publico}
            onPublico={onPublico}
          />
          {envios.length ? (
            <>
              <AvanceCorreoCronologia envios={envios} paleta={paleta} publico={publico} />
              <AvanceCorreoEnvios envios={envios} publico={publico} paleta={paleta} />
            </>
          ) : null}
          <AvanceCorreoInvalidos invalidos={estado.invalidos} envios={envios} paleta={paleta} />
        </div>
      ) : null}
    </section>
  );
}
