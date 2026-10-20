import type { MailPlatform } from "../../../api/materialMail";
import { SALIDAS_DEL_ENVIO } from "./modeloSalidas";
import "./correosSalidas.css";

/** Para qué sirve cada botón de salida; la principal, marcada. */
export function SalidasDelEnvio({ plataforma }: { plataforma: MailPlatform }) {
  return (
    <dl
      className="rec-mail-salidas"
      aria-label="Para qué sirve cada salida"
      data-qa-geometry-group={`material-campo/correo/salidas-${plataforma}`}
      data-qa-geometry-contract="intrinsic"
    >
      {SALIDAS_DEL_ENVIO[plataforma].map((s) => (
        <div key={s.accion} className="rec-mail-salida" data-qa-geometry-member>
          <dt title={s.accion}>
            {s.corto}
            {s.principal ? <span className="rec-mail-salida-principal">principal</span> : null}
          </dt>
          <dd>{s.para}</dd>
        </div>
      ))}
    </dl>
  );
}
