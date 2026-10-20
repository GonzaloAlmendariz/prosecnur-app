// «Ya existe una campaña con este nombre · Ábrela o usa otro nombre» (F1).
//
// Va en línea, junto al campo del nombre, en «Nueva campaña», en «Renombrar» y
// al importar un correo. «Ábrela» es navegación de ruta: lleva a la campaña que
// ya existe y, con eso, cierra el diálogo (su panel sale de la dirección).

import { Link } from "react-router-dom";

import { AlertCircle } from "../../../vendor/lucide-react";
import { avisoDeHomonima, type CampanaConNombre } from "./nombreUnico";
import "./nombreUnico.css";

type Props = {
  id?: string;
  campana: CampanaConNombre;
  /** Dirección de la campaña que ya existe; sin ella no se ofrece abrirla. */
  href: string | null;
};

export function AvisoDeNombreRepetido({ id, campana, href }: Props) {
  const aviso = avisoDeHomonima(campana);
  return (
    <p id={id} className="rec-nombre-repetido" role="alert">
      <AlertCircle size={14} aria-hidden />
      <span>
        {aviso.texto}
        {aviso.accion && href ? (
          <>
            {" · "}
            <Link className="rec-nombre-repetido-abrir" to={href}>Ábrela</Link>
            {" o usa otro nombre"}
          </>
        ) : aviso.accion ? ` · usa otro nombre` : null}
      </span>
    </p>
  );
}
