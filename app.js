/* ============================================================================
   INRA · Sistema de Registro de Casos de Avasallamiento
   app.js — JavaScript vanilla, organizado en módulos funcionales.
   ============================================================================ */

/* ============================================================================
   CONFIGURACIÓN
   ============================================================================ */
const SUPABASE_URL = "https://ucyqtohqfnngyqgffbho.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjeXF0b2hxZm5uZ3lxZ2ZmYmhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MTM2NzcsImV4cCI6MjEwNTA4OTY3N30.tGojM4W7c7mryXx49copSlXY8Hpmx81rYQK9csx5Slw";

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Íconos SVG en línea (no se usan emojis en ninguna parte de la interfaz).
const ICONS = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M12 3.2 21 19H3z"/><line x1="12" y1="9" x2="12" y2="13.5"/><line x1="12" y1="16.3" x2="12" y2="16.4"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2.2"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M12 21s-7-7.4-7-12.2A7 7 0 0 1 19 8.8C19 13.6 12 21 12 21z"/><circle cx="12" cy="8.8" r="2.4"/></svg>`,
  save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h7"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><rect x="4.5" y="10.5" width="15" height="9.5" rx="1.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>`
};

// Campos de la Parte 2 que se consideran "seguimiento operativo" y por lo tanto
// se pueden actualizar directamente (coincide con campos_libres del trigger SQL).
// Todo lo demás requiere: si ya tiene valor, pasa por Solicitud de Cambio.
const CAMPOS_LIBRES = [
  "estado_inspeccion", "fecha_real_inspeccion", "fecha_programada_inspeccion",
  "tecnico_responsable", "observaciones_programacion",
  "informe_inspeccion", "fecha_informe", "conclusion_informe_inspeccion",
  "accion_a_seguir", "observaciones_parte2", "estado_global", "estado_actual",
  "estado_verificacion", "detalle_verificacion"
];

const CAMPOS_PARTE1 = [
  "hoja_de_ruta","fecha_ingreso","departamento","provincia","municipio","nombre_predio",
  "tipo_propiedad","idpredio","codigo_expediente","clasificacion_caso",
  "denunciante","denunciados","informe_atencion","fecha_informe_atencion","prioridad",
  "asociado_comunidad","nombre_comunidad","corresponde_atender","fundamento_determinacion",
  "estado_global","estado_actual"
];
const CAMPOS_PARTE2 = [
  "fecha_programada_inspeccion","tecnico_responsable","observaciones_programacion",
  "fecha_real_inspeccion","estado_inspeccion","informe_inspeccion","fecha_informe",
  "conclusion_informe_inspeccion","accion_a_seguir","observaciones_parte2"
];
const CAMPOS_PARTE3 = [
  "res_medidas_precautorias","fecha_resolucion_medidas","inf_medidas_precautorias","fecha_informe_medidas",
  "nota_remision_medidas","fecha_nota","intimacion","fecha_intimacion","notificacion_intimacion",
  "informe_verificacion_intimacion","fecha_informe_verificacion","estado_verificacion","detalle_verificacion",
  "carta_comando","fecha_carta_comando","informe_acta_desalojo","fecha_desalojo","observaciones_parte3"
];
// Campos opcionales que NO cuentan como obligatorios para el % de completitud (sección 39)
const CAMPOS_OPCIONALES = [
  "idpredio","fundamento_determinacion","fecha_informe_atencion",
  "observaciones_programacion","conclusion_informe_inspeccion","observaciones_parte2",
  "detalle_verificacion","observaciones_parte3","notificacion_intimacion"
];

/* ============================================================================
   ESTADO GLOBAL EN MEMORIA
   ============================================================================ */
const STATE = {
  user: null,
  perfil: null,
  territorios: [],        // catálogo departamento/provincia/municipio
  casosCache: [],
  casoActual: null,       // caso cargado actualmente en detalle/formulario
  filtroActivoLabel: null,
  filtros: {},
  charts: {}
};

/* ============================================================================
   UTILIDADES
   ============================================================================ */
const UTIL = {
  qs: (sel, ctx = document) => ctx.querySelector(sel),
  qsa: (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel)),

  toast(msg, tipo = "info") {
    const cont = UTIL.qs("#toast-container");
    const el = document.createElement("div");
    el.className = `toast ${tipo}`;
    el.textContent = msg;
    cont.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  },

  fechaCorta(iso) {
    if (!iso) return "—";
    const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("es-BO");
  },

  fechaHora(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString("es-BO");
  },

  vacio(v) {
    return v === null || v === undefined || v === "" ;
  },

  debounce(fn, ms = 350) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  errorAmigable(err) {
    const msg = (err && err.message) || "";
    if (msg.includes("CAMPO_PROTEGIDO")) {
      return "El dato ya estaba registrado. Se requiere autorización administrativa para modificarlo.";
    }
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return "No se pudo guardar. Verifique su conexión.";
    }
    if (msg.includes("JWT") || msg.includes("session")) {
      return "La sesión expiró. Vuelva a iniciar sesión.";
    }
    return "No se pudo completar la operación.";
  }
};

/* ============================================================================
   AUTENTICACIÓN
   ============================================================================ */
const AUTH = {
  async init() {
    const { data: { session } } = await supa.auth.getSession();
    if (session) {
      await AUTH.cargarSesion(session);
    } else {
      ROUTER.mostrarLogin();
    }
    supa.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") ROUTER.mostrarLogin();
    });
  },

  async cargarSesion(session) {
    STATE.user = session.user;
    const { data: perfil, error } = await supa.from("perfiles").select("*").eq("id", session.user.id).single();
    if (error || !perfil) {
      UTIL.toast("No se pudo cargar el perfil de usuario.", "error");
      await AUTH.logout();
      return;
    }
    STATE.perfil = perfil;
    ROUTER.mostrarApp();
  },

  async login(email, password) {
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await AUTH.cargarSesion(data.session);
  },

  async logout() {
    await supa.auth.signOut();
    STATE.user = null;
    STATE.perfil = null;
    ROUTER.mostrarLogin();
  },

  esAdmin() {
    return STATE.perfil && STATE.perfil.rol === "ADMINISTRADOR";
  }
};

/* ============================================================================
   TERRITORIOS (departamento -> provincia -> municipio)
   ============================================================================ */
const TERRITORIOS = {
  async cargar() {
    const { data, error } = await supa.from("unidades_territoriales").select("*").order("departamento").order("provincia").order("municipio");
    if (error) { UTIL.toast("No se pudo cargar la información territorial.", "error"); return; }
    STATE.territorios = data || [];
  },

  departamentos() {
    return [...new Set(STATE.territorios.map(t => t.departamento))].sort();
  },
  provincias(departamento) {
    return [...new Set(STATE.territorios.filter(t => t.departamento === departamento).map(t => t.provincia))].sort();
  },
  municipios(departamento, provincia) {
    return [...new Set(STATE.territorios.filter(t => t.departamento === departamento && t.provincia === provincia).map(t => t.municipio))].sort();
  },

  // Enlaza un trío departamento/provincia/municipio <select> con comportamiento en cascada.
  enlazarSelects(selDep, selProv, selMun) {
    const llenar = (sel, opciones, placeholder) => {
      sel.innerHTML = `<option value="">${placeholder}</option>` + opciones.map(o => `<option value="${o}">${o}</option>`).join("");
    };
    llenar(selDep, TERRITORIOS.departamentos(), "Departamento");
    llenar(selProv, [], "Provincia");
    llenar(selMun, [], "Municipio");
    TERRITORIOS.reenlazarCascada(selDep, selProv, selMun);
  },

  // Solo (re)asigna los eventos de cascada, sin reconstruir las opciones ya cargadas.
  // Se usa para restaurar la cascada si algo más (como el recálculo de progreso del
  // formulario) sobrescribió selDep.onchange / selProv.onchange después de enlazarSelects().
  reenlazarCascada(selDep, selProv, selMun, alCambiar) {
    const llenar = (sel, opciones, placeholder) => {
      sel.innerHTML = `<option value="">${placeholder}</option>` + opciones.map(o => `<option value="${o}">${o}</option>`).join("");
    };
    selDep.onchange = () => {
      llenar(selProv, TERRITORIOS.provincias(selDep.value), "Provincia");
      llenar(selMun, [], "Municipio");
      if (alCambiar) alCambiar();
    };
    selProv.onchange = () => {
      llenar(selMun, TERRITORIOS.municipios(selDep.value, selProv.value), "Municipio");
      if (alCambiar) alCambiar();
    };
    selMun.onchange = () => { if (alCambiar) alCambiar(); };
  },

  // Aplica valores ya guardados a un trío de selects en cascada.
  setValores(selDep, selProv, selMun, dep, prov, mun) {
    const llenar = (sel, opciones, placeholder) => {
      sel.innerHTML = `<option value="">${placeholder}</option>` + opciones.map(o => `<option value="${o}">${o}</option>`).join("");
    };
    llenar(selDep, TERRITORIOS.departamentos(), "Departamento");
    selDep.value = dep || "";
    llenar(selProv, dep ? TERRITORIOS.provincias(dep) : [], "Provincia");
    selProv.value = prov || "";
    llenar(selMun, (dep && prov) ? TERRITORIOS.municipios(dep, prov) : [], "Municipio");
    selMun.value = mun || "";
  }
};

/* ============================================================================
   CASOS
   ============================================================================ */
const CASOS = {
  async fetchTodos() {
    const { data, error } = await supa.from("casos").select("*").order("nro", { ascending: false });
    if (error) { UTIL.toast("No se pudieron cargar los casos.", "error"); return []; }
    STATE.casosCache = data || [];
    return STATE.casosCache;
  },

  async fetchPorId(id) {
    const { data, error } = await supa.from("casos").select("*").eq("id", id).single();
    if (error) { UTIL.toast("No se pudo cargar el caso.", "error"); return null; }
    return data;
  },

  aplicaFiltros(lista, f) {
    return lista.filter(c => {
      if (f.texto) {
        const t = f.texto.toLowerCase();
        const campos = [c.id_inspec, c.hoja_de_ruta, c.nombre_predio, c.denunciante, c.denunciados, c.codigo_expediente];
        if (!campos.some(v => (v || "").toLowerCase().includes(t))) return false;
      }
      if (f.departamento && c.departamento !== f.departamento) return false;
      if (f.provincia && c.provincia !== f.provincia) return false;
      if (f.municipio && c.municipio !== f.municipio) return false;
      if (f.tipo_propiedad) {
        const tp = (c.tipo_propiedad || "").trim().toUpperCase();
        const ftp = f.tipo_propiedad.trim().toUpperCase();
        if (ftp === "OTROS" || ftp === "OTRO") {
          if (tp === "TIERRA FISCAL" || tp === "COMUNIDAD") return false;
        } else {
          if (tp !== ftp) return false;
        }
      }
      if (f.clasificacion) {
        const cl = (c.clasificacion_caso || "").trim().toUpperCase();
        const fcl = f.clasificacion.trim().toUpperCase();
        if (fcl === "OTROS" || fcl === "OTRO") {
          if (cl === "DENUNCIA DE AVASALLAMIENTO" || cl === "IDENTIFICACION DE ACTIVIDAD ANTROPICA") return false;
        } else {
          if (cl !== fcl) return false;
        }
      }
      if (f.prioridad && c.prioridad !== f.prioridad) return false;
      if (f.estado_global) {
        const eg = (c.estado_global || "").trim().toUpperCase();
        const fg = f.estado_global.trim().toUpperCase();
        if (fg === "PROCESO CONCLUIDO" || fg === "CONCLUIDO") {
          if (eg !== "PROCESO CONCLUIDO" && eg !== "CONCLUIDO") return false;
        } else {
          if (eg !== fg) return false;
        }
      }
      if (f.estado_actual) {
        const ea = (c.estado_actual || "").trim().toUpperCase();
        const fa = f.estado_actual.trim().toUpperCase();
        if (fa.includes("DESESTIMADA")) {
          if (!ea.includes("DESESTIMADA")) return false;
        } else {
          if (ea !== fa) return false;
        }
      }
      if (f.estado_inspeccion) {
        const ei = (c.estado_inspeccion || "").trim().toUpperCase();
        const fi = f.estado_inspeccion.trim().toUpperCase();
        const pendientes = ["PENDIENTE DE INSPECCION", "PENDIENTE"];
        if (pendientes.includes(fi)) {
          if (!pendientes.includes(ei)) return false;
        } else {
          if (ei !== fi) return false;
        }
      }
      if (f.accion && c.accion_a_seguir !== f.accion) return false;
      if (f.gestion && String(c.gestion) !== String(f.gestion)) return false;
      return true;
    });
  },

  async verificarDuplicado({ hoja_de_ruta, id_inspec, codigo_expediente, nombre_predio }) {
    const partes = [];
    if (hoja_de_ruta) partes.push(`hoja_de_ruta.eq.${hoja_de_ruta}`);
    if (codigo_expediente) partes.push(`codigo_expediente.eq.${codigo_expediente}`);
    if (nombre_predio) partes.push(`nombre_predio.eq.${nombre_predio}`);
    if (partes.length === 0) return [];
    const { data, error } = await supa.from("casos").select("id,id_inspec,hoja_de_ruta,nombre_predio,codigo_expediente").or(partes.join(","));
    if (error) return [];
    return data || [];
  },

  async crear(payload) {
    const insertPayload = { ...payload, creado_por: STATE.user.id, actualizado_por: STATE.user.id };
    const { data, error } = await supa.from("casos").insert(insertPayload).select().single();
    if (error) throw error;

    // Trazabilidad del registro inicial
    const filas = Object.entries(payload)
      .filter(([campo, valor]) => !UTIL.vacio(valor))
      .map(([campo, valor]) => ({
        caso_id: data.id, campo, valor_anterior: null, valor_nuevo: String(valor),
        usuario_id: STATE.user.id, accion: "registro_inicial", motivo: "Registro inicial del caso"
      }));
    if (filas.length) await supa.from("historial_cambios").insert(filas);

    return data;
  },

  // Clasifica los cambios del formulario en: directos (campo vacío o "libre") y
  // protegidos (campo ya tenía valor y no es de edición libre -> requiere solicitud).
  clasificarCambios(original, nuevos) {
    const directos = {};
    const protegidos = {};
    for (const [campo, valorNuevo] of Object.entries(nuevos)) {
      const valorAnterior = original[campo];
      const iguales = (valorAnterior ?? "") === (valorNuevo ?? "");
      if (iguales) continue;
      const libre = CAMPOS_LIBRES.includes(campo);
      if (UTIL.vacio(valorAnterior) || libre) {
        directos[campo] = valorNuevo;
      } else {
        protegidos[campo] = valorNuevo;
      }
    }
    return { directos, protegidos };
  },

  // Aplica los cambios directos (los protegidos se manejan aparte vía SOLICITUDES).
  async actualizarDirecto(casoId, directos, original) {
    if (Object.keys(directos).length === 0) return null;
    const payload = { ...directos, actualizado_por: STATE.user.id };
    const { data, error } = await supa.from("casos").update(payload).eq("id", casoId).select().single();
    if (error) throw error;

    const filas = Object.entries(directos).map(([campo, valorNuevo]) => ({
      caso_id: casoId, campo,
      valor_anterior: UTIL.vacio(original[campo]) ? null : String(original[campo]),
      valor_nuevo: valorNuevo === null || valorNuevo === "" ? null : String(valorNuevo),
      usuario_id: STATE.user.id,
      accion: UTIL.vacio(original[campo]) ? "registro_inicial" : "actualizacion_directa",
      motivo: null
    }));
    if (filas.length) await supa.from("historial_cambios").insert(filas);
    return data;
  },

  async eliminar(casoId) {
    const { error } = await supa.from("casos").delete().eq("id", casoId);
    if (error) throw error;
  },

  // Corrección administrativa excepcional del estado (sección 5)
  async corregirEstadoManual(casoId, nuevoEstado, motivo, original) {
    const payload = { estado_actual_override: nuevoEstado, estado_actual_override_motivo: motivo, actualizado_por: STATE.user.id };
    const { data, error } = await supa.from("casos").update(payload).eq("id", casoId).select().single();
    if (error) throw error;
    await supa.from("historial_cambios").insert({
      caso_id: casoId, campo: "estado_actual_override",
      valor_anterior: original.estado_actual_override || null, valor_nuevo: nuevoEstado,
      usuario_id: STATE.user.id, accion: "correccion_administrativa", motivo
    });
    return data;
  },

  completitud(caso) {
    const obligatorios = [...CAMPOS_PARTE1, ...CAMPOS_PARTE2, ...CAMPOS_PARTE3].filter(c => !CAMPOS_OPCIONALES.includes(c));
    const relevantes = obligatorios.filter(c => CASOS.campoAplica(caso, c));
    if (relevantes.length === 0) return 0;
    const llenos = relevantes.filter(c => !UTIL.vacio(caso[c])).length;
    return Math.round((llenos / relevantes.length) * 100);
  },

  // La Parte 3 aplica si la acción a seguir incluye MEDIDAS PRECAUTORIAS.
  campoAplica(caso, campo) {
    if (CAMPOS_PARTE3.includes(campo)) {
      return caso.accion_a_seguir === "EMITIR MEDIDAS PRECAUTORIAS" || caso.accion_a_seguir === "MEDIDAS PRECAUTORIAS";
    }
    if (campo === "nombre_comunidad") {
      return caso.asociado_comunidad === "SI";
    }
    return true;
  },

  completitudParte(caso, campos) {
    const relevantes = campos.filter(c => !CAMPOS_OPCIONALES.includes(c) && CASOS.campoAplica(caso, c));
    if (relevantes.length === 0) return 100;
    const llenos = relevantes.filter(c => !UTIL.vacio(caso[c])).length;
    return Math.round((llenos / relevantes.length) * 100);
  }
};

/* ============================================================================
   HISTORIAL / TRAZABILIDAD
   ============================================================================ */
const HISTORIAL = {
  async fetchPorCaso(casoId) {
    const { data, error } = await supa.from("historial_cambios")
      .select("*, perfiles:usuario_id(nombre_completo)")
      .eq("caso_id", casoId).order("fecha", { ascending: false });
    if (error) return [];
    return data || [];
  }
};

/* ============================================================================
   SOLICITUDES DE CAMBIO (aprobación administrativa)
   ============================================================================ */
const SOLICITUDES = {
  async crearVarias(casoId, protegidos, original, motivo) {
    const filas = Object.entries(protegidos).map(([campo, valorPropuesto]) => ({
      caso_id: casoId, campo,
      valor_anterior: UTIL.vacio(original[campo]) ? null : String(original[campo]),
      valor_propuesto: valorPropuesto === null || valorPropuesto === "" ? null : String(valorPropuesto),
      usuario_solicitante: STATE.user.id, motivo
    }));
    if (filas.length === 0) return;
    const { error } = await supa.from("solicitudes_cambio").insert(filas);
    if (error) throw error;
  },

  async fetchTodas(estado) {
    let q = supa.from("solicitudes_cambio")
      .select("*, casos:caso_id(id_inspec,hoja_de_ruta,nombre_predio), sol:usuario_solicitante(nombre_completo), apr:usuario_aprobador(nombre_completo)")
      .order("fecha_solicitud", { ascending: false });
    if (estado) q = q.eq("estado", estado);
    const { data, error } = await q;
    if (error) return [];
    return data || [];
  },

  async aprobar(solicitud, comentario) {
    // 1. Aplica el cambio directamente en casos (el usuario actual es admin -> el trigger lo permite)
    const payload = { [solicitud.campo]: solicitud.valor_propuesto, actualizado_por: STATE.user.id };
    const { error: errUpd } = await supa.from("casos").update(payload).eq("id", solicitud.caso_id);
    if (errUpd) throw errUpd;

    // 2. Marca la solicitud como aprobada
    const { error: errSol } = await supa.from("solicitudes_cambio").update({
      estado: "APROBADO", usuario_aprobador: STATE.user.id, fecha_aprobacion: new Date().toISOString(), comentario_aprobacion: comentario || null
    }).eq("id", solicitud.id);
    if (errSol) throw errSol;

    // 3. Registra en historial
    await supa.from("historial_cambios").insert({
      caso_id: solicitud.caso_id, campo: solicitud.campo,
      valor_anterior: solicitud.valor_anterior, valor_nuevo: solicitud.valor_propuesto,
      usuario_id: STATE.user.id, accion: "cambio_aprobado", motivo: solicitud.motivo
    });
  },

  async rechazar(solicitud, comentario) {
    const { error } = await supa.from("solicitudes_cambio").update({
      estado: "RECHAZADO", usuario_aprobador: STATE.user.id, fecha_aprobacion: new Date().toISOString(), comentario_aprobacion: comentario || null
    }).eq("id", solicitud.id);
    if (error) throw error;
    await supa.from("historial_cambios").insert({
      caso_id: solicitud.caso_id, campo: solicitud.campo,
      valor_anterior: solicitud.valor_anterior, valor_nuevo: "(rechazado)",
      usuario_id: STATE.user.id, accion: "cambio_rechazado", motivo: comentario || solicitud.motivo
    });
  }
};

/* ============================================================================
   INSPECCIONES (eventos de programación / reprogramación / realización / informe)
   ============================================================================ */
const INSPECCIONES = {
  async registrarEvento(casoId, tipoEvento, { fechaAnterior, fechaNueva, tecnico, motivo, observaciones }) {
    const { error } = await supa.from("inspecciones_eventos").insert({
      caso_id: casoId, tipo_evento: tipoEvento,
      fecha_anterior: fechaAnterior || null, fecha_nueva: fechaNueva || null,
      tecnico_responsable: tecnico || null, motivo: motivo || null,
      usuario_id: STATE.user.id, observaciones: observaciones || null
    });
    if (error) throw error;
  },

  async fetchEventosPorCaso(casoId) {
    const { data, error } = await supa.from("inspecciones_eventos").select("*").eq("caso_id", casoId).order("fecha_evento", { ascending: false });
    if (error) return [];
    return data || [];
  }
};

/* ============================================================================
   ALERTAS (calculadas dinámicamente, sección 9-10)
   ============================================================================ */
const ALERTAS = {
  // Devuelve la lista de pendientes de UN caso.
  pendientesDeCaso(c) {
    const lista = [];
    const ok = (txt) => lista.push({ ok: true, texto: txt });
    const pend = (txt) => lista.push({ ok: false, texto: txt });

    if (UTIL.vacio(c.informe_atencion)) pend("Falta registrar informe de atención"); else ok("Informe de atención registrado");

    if (c.corresponde_atender === "SI") {
      if (UTIL.vacio(c.fecha_programada_inspeccion) && UTIL.vacio(c.fecha_real_inspeccion)) {
        pend("Falta programar inspección");
      } else if (UTIL.vacio(c.fecha_real_inspeccion)) {
        ok("Inspección programada"); pend("Falta realizar la inspección");
      } else {
        ok("Inspección realizada");
        if (UTIL.vacio(c.fecha_informe)) pend("Falta informe de inspección");
        else ok("Informe de inspección registrado");
      }
    } else if (c.corresponde_atender === "PENDIENTE") {
      pend("Falta determinar si corresponde atender el caso");
    }

    if (c.accion_a_seguir === "EMITIR MEDIDAS PRECAUTORIAS" || c.accion_a_seguir === "MEDIDAS PRECAUTORIAS") {
      if (!UTIL.vacio(c.res_medidas_precautorias)) ok("Medidas precautorias registradas");
      else pend("Falta emitir resolución de medidas precautorias");

      if (!UTIL.vacio(c.res_medidas_precautorias)) {
        if (UTIL.vacio(c.intimacion)) pend("Falta registrar intimación");
        else {
          ok("Intimación registrada");
          if (UTIL.vacio(c.informe_verificacion_intimacion)) pend("Falta registrar verificación de intimación");
          else {
            ok("Verificación registrada");
            if (c.estado_verificacion === "INCUMPLIDA" && UTIL.vacio(c.carta_comando)) {
              pend("Verificación incumplida: falta carta al comando");
            }
            if (!UTIL.vacio(c.carta_comando) && UTIL.vacio(c.fecha_desalojo)) {
              pend("Falta registrar desalojo");
            }
          }
        }
      }
    }
    return lista;
  },

  // Calcula el panel general de alertas sobre toda la cartera de casos.
  // (Se dejó solo lo pedido: sin informe de atención, inspección pendiente,
  // inspecciones realizadas sin informe, y casos sin medidas precautorias emitidas.)
  resumenGeneral(casos) {
    const activos = casos.filter(c => c.estado_global === "PROCESO EN CURSO");

    const sinInformeAtencion = activos.filter(c => UTIL.vacio(c.informe_atencion));
    const inspeccionPendiente = activos.filter(c => c.corresponde_atender === "SI" && UTIL.vacio(c.fecha_programada_inspeccion) && UTIL.vacio(c.fecha_real_inspeccion));
    const realizadasSinInforme = activos.filter(c => !UTIL.vacio(c.fecha_real_inspeccion) && UTIL.vacio(c.fecha_informe));
    const sinMedidasPrecautorias = activos.filter(c => (c.accion_a_seguir === "EMITIR MEDIDAS PRECAUTORIAS" || c.accion_a_seguir === "MEDIDAS PRECAUTORIAS") && UTIL.vacio(c.res_medidas_precautorias));

    return { sinInformeAtencion, inspeccionPendiente, realizadasSinInforme, sinMedidasPrecautorias };
  }
};

/* ============================================================================
   DASHBOARD
   ============================================================================ */
const DASHBOARD = {
  async render() {
    const casos = await CASOS.fetchTodos();
    DASHBOARD.renderTarjetas(casos);
    DASHBOARD.renderGraficos(casos);
    DASHBOARD.renderUltimosRegistros(casos);
    DASHBOARD.renderPrioridadAlta(casos);
  },

  renderTarjetas(casos) {
    const total = casos.length || 1;
    const enCurso = casos.filter(c => c.estado_global === "PROCESO EN CURSO").length;
    const concluidos = casos.filter(c => c.estado_global === "PROCESO CONCLUIDO").length;
    const porcEnCurso = ((enCurso / total) * 100).toFixed(1);
    const porcConcluidos = ((concluidos / total) * 100).toFixed(1);

    const insp = casos.filter(c => c.estado_inspeccion === "INSPECCIONADO").length;
    const pend = casos.filter(c => c.estado_inspeccion === "PENDIENTE DE INSPECCION" || c.estado_inspeccion === "PENDIENTE").length;
    const prog = casos.filter(c => c.estado_inspeccion === "PROGRAMADA").length;
    const desalojados = casos.filter(c => c.estado_actual === "DESALOJADO").length;
    const desestimados = casos.filter(c => (c.estado_actual || "").includes("DESESTIMADA")).length;

    const porcInsp = ((insp / total) * 100).toFixed(1);
    const porcPend = ((pend / total) * 100).toFixed(1);
    const porcProg = ((prog / total) * 100).toFixed(1);

    // Fila 1 (3 tarjetas - Ref: code2.html)
    const f1Html = `
      <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#0f392b] hover:shadow-md transition-all" data-f1="0">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">TOTAL DE CASOS</span>
          <span class="p-2 rounded-lg bg-emerald-50 text-[#0f392b]">
            <span class="material-symbols-outlined text-[20px]">inventory_2</span>
          </span>
        </div>
        <div class="mt-4">
          <div class="text-4xl font-extrabold text-slate-900 tracking-tight">${casos.length}</div>
          <p class="text-xs text-slate-400 mt-1">Expedientes totales registrados</p>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#0f392b] hover:shadow-md transition-all" data-f1="1">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">PROCESOS EN CURSO</span>
          <span class="p-2 rounded-lg bg-emerald-50 text-[#0f392b]">
            <span class="material-symbols-outlined text-[20px]">pending_actions</span>
          </span>
        </div>
        <div class="mt-4 flex items-baseline justify-between">
          <div class="text-4xl font-extrabold text-[#0f392b] tracking-tight">${enCurso}</div>
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-[#0f392b]">${porcEnCurso}%</span>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-slate-400 hover:shadow-md transition-all" data-f1="2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">PROCESOS CONCLUIDOS</span>
          <span class="p-2 rounded-lg bg-slate-100 text-slate-600">
            <span class="material-symbols-outlined text-[20px]">task_alt</span>
          </span>
        </div>
        <div class="mt-4 flex items-baseline justify-between">
          <div class="text-4xl font-extrabold text-slate-800 tracking-tight">${concluidos}</div>
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">${porcConcluidos}%</span>
        </div>
      </div>
    `;

    const f1Cont = UTIL.qs("#dashboard-cards-fila1");
    if (f1Cont) {
      f1Cont.innerHTML = f1Html;
      const f1Actions = [
        () => ROUTER.irAListadoConFiltro({}, "Total de Casos"),
        () => ROUTER.irAListadoConFiltro({ estado_global: "PROCESO EN CURSO" }, "Procesos en Curso"),
        () => ROUTER.irAListadoConFiltro({ estado_global: "PROCESO CONCLUIDO" }, "Procesos Concluidos")
      ];
      UTIL.qsa("[data-f1]", f1Cont).forEach(el => {
        const idx = Number(el.dataset.f1);
        el.onclick = f1Actions[idx];
      });
    }

    // Fila 2 (5 tarjetas - Ref: code2.html)
    const f2Html = `
      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:border-emerald-600 hover:shadow-md transition-all" data-f2="0">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">INSPECCIONADOS</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-2xl font-bold text-slate-900">${insp}</span>
          <span class="text-xs text-emerald-700 font-medium">${porcInsp}%</span>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-amber-200 bg-amber-50/20 p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:border-amber-400 hover:shadow-md transition-all" data-f2="1">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold uppercase tracking-wider text-amber-800">INSPECCIÓN PENDIENTE</span>
          <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        </div>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-2xl font-bold text-amber-900">${pend}</span>
          <span class="text-xs text-amber-700 font-medium">${porcPend}%</span>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:border-slate-400 hover:shadow-md transition-all" data-f2="2">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">INSPECCIONES PROGRAMADAS</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-2xl font-bold text-slate-700">${prog}</span>
          <span class="text-xs text-slate-400 font-medium">${porcProg}%</span>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#0f392b] hover:shadow-md transition-all" data-f2="3">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">DESALOJADOS</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-2xl font-bold text-[#0f392b]">${desalojados}</span>
          <span class="text-xs text-[#0f392b] font-semibold">Concluidos</span>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:border-slate-400 hover:shadow-md transition-all col-span-2 md:col-span-1" data-f2="4">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">DESESTIMADOS</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-2xl font-bold text-slate-600">${desestimados}</span>
          <span class="text-xs text-slate-500 font-medium">Archivados</span>
        </div>
      </div>
    `;

    const f2Cont = UTIL.qs("#dashboard-cards-fila2");
    if (f2Cont) {
      f2Cont.innerHTML = f2Html;
      const f2Actions = [
        () => ROUTER.irAListadoConFiltro({ estado_inspeccion: "INSPECCIONADO" }, "Inspeccionados"),
        () => ROUTER.irAListadoConFiltro({ estado_inspeccion: "PENDIENTE DE INSPECCION" }, "Inspección Pendiente"),
        () => ROUTER.irAListadoConFiltro({ estado_inspeccion: "PROGRAMADA" }, "Inspecciones Programadas"),
        () => ROUTER.irAListadoConFiltro({ estado_actual: "DESALOJADO" }, "Desalojados"),
        () => ROUTER.irAListadoConFiltro({ estado_actual: "DENUNCIA DE AVASALLAMIENTO DESESTIMADA" }, "Desestimados")
      ];
      UTIL.qsa("[data-f2]", f2Cont).forEach(el => {
        const idx = Number(el.dataset.f2);
        el.onclick = f2Actions[idx];
      });
    }
  },

  renderGraficos(casos) {
    const total = casos.length || 1;

    // 1. ESTADO ACTUAL (Ref: code2.html lines 210-350)
    const ordenEstados = [
      "CON INSPECCION- PENDIENTE DE EMISION DE MEDIDAS PRECAUTORIAS",
      "CON MEDIDAS PRECAUTORIAS",
      "CON INTIMACION",
      "CON CARTA AL COMANDO",
      "POR DEFINIR",
      "DESALOJADO",
      "DENUNCIA DE AVASALLAMIENTO DESESTIMADA",
      "SE PROSIGUIO CON EL TRAMITE DE DOTACION"
    ];
    const concluidos = [
      "DESALOJADO",
      "DENUNCIA DE AVASALLAMIENTO DESESTIMADA",
      "SE PROSIGUIO CON EL TRAMITE DE DOTACION"
    ];

    const mapEstados = {};
    ordenEstados.forEach(e => { mapEstados[e] = 0; });
    casos.forEach(c => {
      const ea = (c.estado_actual || "").trim();
      if (!ea) return;
      if (mapEstados[ea] !== undefined) mapEstados[ea]++;
      else mapEstados[ea] = (mapEstados[ea] || 0) + 1;
    });

    const maxVal = Math.max(...Object.values(mapEstados), 1);
    const containerEstados = UTIL.qs("#dashboard-estados-barras");
    if (containerEstados) {
      containerEstados.innerHTML = Object.entries(mapEstados).map(([nombre, cant]) => {
        const esConcluido = concluidos.includes(nombre);
        const colorBarra = esConcluido ? "bg-slate-500" : "bg-[#0f392b]";
        const colorTexto = cant > 0 ? "text-slate-900" : "text-slate-400";
        const pct = ((cant / maxVal) * 100).toFixed(1);
        return `
          <div class="space-y-1 cursor-pointer group hover:bg-slate-50 p-1.5 rounded-lg transition-colors" data-estado-click="${nombre}">
            <div class="flex justify-between text-xs">
              <span class="font-medium text-slate-700 uppercase group-hover:text-[#0f392b] transition-colors">${nombre}</span>
              <span class="font-bold ${colorTexto} tabular-nums">${cant}</span>
            </div>
            <div class="w-full bg-slate-100 rounded-sm h-3.5 overflow-hidden">
              <div class="${colorBarra} h-full rounded-sm transition-all duration-300" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join("");

      UTIL.qsa("[data-estado-click]", containerEstados).forEach(el => {
        el.onclick = () => ROUTER.irAListadoConFiltro({ estado_actual: el.dataset.estadoClick }, el.dataset.estadoClick);
      });
    }

    // 2. CLASIFICACIÓN (Ref: code2.html lines 356-392)
    const mapClasif = {};
    casos.forEach(c => {
      const cl = c.clasificacion_caso || "Sin Clasificación";
      mapClasif[cl] = (mapClasif[cl] || 0) + 1;
    });
    const maxClasif = Math.max(...Object.values(mapClasif), 1);
    const containerClasif = UTIL.qs("#dashboard-clasificacion-widget");
    if (containerClasif) {
      containerClasif.innerHTML = Object.entries(mapClasif).map(([nombre, cant]) => {
        const pct = ((cant / maxClasif) * 100).toFixed(1);
        return `
          <div class="cursor-pointer group hover:bg-slate-50 p-1 rounded transition-colors" data-clasif-click="${nombre}">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-slate-700 font-medium truncate group-hover:text-[#0f392b]">${nombre}</span>
              <span class="font-bold text-slate-900">${cant}</span>
            </div>
            <div class="w-full bg-slate-100 rounded-sm h-3 overflow-hidden">
              <div class="bg-[#0f392b] h-full rounded-sm" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join("");
      UTIL.qsa("[data-clasif-click]", containerClasif).forEach(el => {
        el.onclick = () => ROUTER.irAListadoConFiltro({ clasificacion: el.dataset.clasifClick }, el.dataset.clasifClick);
      });
    }

    // 3. DEPARTAMENTO (Ref: code2.html lines 394-448)
    const mapDepto = {};
    casos.forEach(c => {
      const dp = c.departamento || "Sin dato";
      mapDepto[dp] = (mapDepto[dp] || 0) + 1;
    });
    const deptosOrdenados = Object.entries(mapDepto).sort((a, b) => b[1] - a[1]);
    const maxDepto = Math.max(...Object.values(mapDepto), 1);
    const containerDepto = UTIL.qs("#dashboard-departamento-widget");
    if (containerDepto) {
      containerDepto.innerHTML = deptosOrdenados.slice(0, 6).map(([nombre, cant], idx) => {
        const pct = ((cant / maxDepto) * 100).toFixed(1);
        const color = idx === 0 ? "bg-[#0f392b]" : idx === 1 ? "bg-emerald-800" : idx === 2 ? "bg-emerald-700" : "bg-slate-400";
        return `
          <div class="cursor-pointer group hover:bg-slate-50 p-1 rounded transition-colors" data-depto-click="${nombre}">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-slate-800 ${idx === 0 ? 'font-bold' : 'font-medium'} group-hover:text-[#0f392b]">${nombre}</span>
              <span class="font-bold ${idx === 0 ? 'text-[#0f392b]' : 'text-slate-800'}">${cant}</span>
            </div>
            <div class="w-full bg-slate-100 rounded-sm h-3 overflow-hidden">
              <div class="${color} h-full rounded-sm" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join("");

      const topDepto = deptosOrdenados[0];
      const footerDepto = UTIL.qs("#dashboard-depto-footer");
      if (footerDepto && topDepto) {
        const pctTop = ((topDepto[1] / total) * 100).toFixed(0);
        footerDepto.textContent = `${topDepto[0]} concentra el ${pctTop}% de las causas`;
      }

      UTIL.qsa("[data-depto-click]", containerDepto).forEach(el => {
        el.onclick = () => ROUTER.irAListadoConFiltro({ departamento: el.dataset.deptoClick }, el.dataset.deptoClick);
      });
    }

    // 4. GESTIÓN (Ref: code2.html lines 450-482)
    const mapGestion = {};
    casos.forEach(c => {
      const g = c.gestion || (c.fecha_ingreso ? c.fecha_ingreso.slice(0, 4) : "Sin año");
      mapGestion[g] = (mapGestion[g] || 0) + 1;
    });
    const gestiones = Object.keys(mapGestion).sort();
    const maxGestion = Math.max(...Object.values(mapGestion), 1);
    const containerGestion = UTIL.qs("#dashboard-gestion-widget");
    if (containerGestion) {
      containerGestion.innerHTML = `
        <div class="h-36 flex items-end justify-between gap-3 px-2">
          ${gestiones.map((g, idx) => {
            const cant = mapGestion[g];
            const pct = Math.max(((cant / maxGestion) * 100), 12).toFixed(0);
            const esMax = cant === maxGestion;
            const barBg = esMax ? "bg-[#0f392b]" : "bg-emerald-700/60";
            const numColor = esMax ? "text-[#0f392b]" : "text-slate-600";
            return `
              <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group" data-gestion-click="${g}">
                <span class="text-xs font-bold ${numColor}">${cant}</span>
                <div class="w-full ${barBg} rounded-t-sm shadow-sm group-hover:opacity-80 transition-all" style="height: ${pct}%"></div>
                <span class="text-xs ${esMax ? 'font-bold text-[#0f392b]' : 'font-medium text-slate-500'} mt-1">${g}</span>
              </div>
            `;
          }).join("")}
        </div>
      `;

      const topGestion = Object.entries(mapGestion).sort((a, b) => b[1] - a[1])[0];
      const footerGestion = UTIL.qs("#dashboard-gestion-footer");
      if (footerGestion && topGestion) {
        footerGestion.textContent = `Gestión ${topGestion[0]} registra el mayor volumen de causas (${topGestion[1]} casos)`;
      }

      UTIL.qsa("[data-gestion-click]", containerGestion).forEach(el => {
        el.onclick = () => ROUTER.irAListadoConFiltro({ gestion: el.dataset.gestionClick }, `Gestión ${el.dataset.gestionClick}`);
      });
    }
  },

  pintarChart(canvasId, dataMap, tipo) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (STATE.charts[canvasId]) STATE.charts[canvasId].destroy();
    // Recorta etiquetas largas para que el eje no quede saturado, sin perder el dato completo (tooltip).
    const acortar = (s) => (s && s.length > 14) ? s.slice(0, 13) + "…" : s;
    const labelsCompletos = Object.keys(dataMap);
    const labels = labelsCompletos.map(acortar);
    const valores = Object.values(dataMap);
    STATE.charts[canvasId] = new Chart(ctx, {
      type: tipo,
      data: { labels, datasets: [{ data: valores, backgroundColor: "#2f6b4f", borderRadius: 3, maxBarThickness: 34 }] },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: (items) => labelsCompletos[items[0].dataIndex] } }
        },
        scales: {
          x: { ticks: { font: { size: 10 }, autoSkip: false, maxRotation: 32, minRotation: 0 }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } }, grid: { color: "#eef1ee" } }
        }
      }
    });
  },

  renderPrioridadAlta(casos) {
    const lista = casos.filter(c => c.prioridad === "ALTA" && c.estado_global === "PROCESO EN CURSO");
    const cont = UTIL.qs("#dashboard-prioridad-alta");
    if (lista.length === 0) { cont.innerHTML = `<p class="hint-text">No hay casos de prioridad alta en curso.</p>`; return; }
    cont.innerHTML = `<table class="data-table"><thead><tr><th>ID_INSPEC</th><th>Predio</th><th>Estado Actual</th><th></th></tr></thead><tbody>${
      lista.map(c => `<tr><td>${c.id_inspec}</td><td>${c.nombre_predio || "—"}</td><td>${c.estado_actual}</td>
        <td><button class="btn btn-sm btn-secondary" data-id="${c.id}">Ver</button></td></tr>`).join("")
    }</tbody></table>`;
    UTIL.qsa("button", cont).forEach(b => b.onclick = () => ROUTER.irADetalle(b.dataset.id));
  }
};

/* ============================================================================
   LISTADO DE CASOS
   ============================================================================ */
const LISTADO = {
  async render(filtroInicial, filtroLabel) {
    await TERRITORIOS.cargar();
    await CASOS.fetchTodos();
    LISTADO.llenarSelectsFiltro();
    if (filtroInicial) {
      STATE.filtros = { ...filtroInicial };
      STATE.filtroActivoLabel = filtroLabel;
    } else {
      STATE.filtros = {};
      STATE.filtroActivoLabel = null;
    }
    LISTADO.sincronizarControlesFiltro();
    LISTADO.pintarBannerFiltro();
    LISTADO.enlazarFiltros();
    LISTADO.pintarTabla();
  },

  sincronizarControlesFiltro() {
    const f = STATE.filtros || {};
    const setVal = (id, val) => { const el = UTIL.qs(id); if (el) el.value = val || ""; };
    setVal("#filtro-texto", f.texto);
    setVal("#filtro-departamento", f.departamento);
    setVal("#filtro-tipo-propiedad", f.tipo_propiedad);
    setVal("#filtro-clasificacion", f.clasificacion);
    setVal("#filtro-prioridad", f.prioridad);
    setVal("#filtro-estado-global", f.estado_global);
    setVal("#filtro-estado-actual", f.estado_actual);
    setVal("#filtro-estado-inspeccion", f.estado_inspeccion);
    setVal("#filtro-accion", f.accion);
    setVal("#filtro-gestion", f.gestion);
  },

  llenarSelectsFiltro() {
    const depSel = UTIL.qs("#filtro-departamento");
    depSel.innerHTML = `<option value="">Departamento</option>` + TERRITORIOS.departamentos().map(d => `<option value="${d}">${d}</option>`).join("");
    depSel.onchange = () => {
      const provSel = UTIL.qs("#filtro-provincia");
      provSel.innerHTML = `<option value="">Provincia</option>` + TERRITORIOS.provincias(depSel.value).map(p => `<option value="${p}">${p}</option>`).join("");
      UTIL.qs("#filtro-municipio").innerHTML = `<option value="">Municipio</option>`;
    };
    UTIL.qs("#filtro-provincia").onchange = () => {
      const dep = depSel.value, prov = UTIL.qs("#filtro-provincia").value;
      UTIL.qs("#filtro-municipio").innerHTML = `<option value="">Municipio</option>` + TERRITORIOS.municipios(dep, prov).map(m => `<option value="${m}">${m}</option>`).join("");
    };

    UTIL.qs("#filtro-clasificacion").innerHTML = `<option value="">Clasificación</option>` +
      ["DENUNCIA DE AVASALLAMIENTO", "IDENTIFICACION DE ACTIVIDAD ANTROPICA", "OTROS"].map(c => `<option value="${c}">${c}</option>`).join("");
    UTIL.qs("#filtro-tipo-propiedad").innerHTML = `<option value="">Tipo de propiedad</option>` +
      ["TIERRA FISCAL", "COMUNIDAD", "OTROS"].map(c => `<option value="${c}">${c}</option>`).join("");

    const ordenEstados = [
      "CON INSPECCION- PENDIENTE DE EMISION DE MEDIDAS PRECAUTORIAS",
      "CON MEDIDAS PRECAUTORIAS",
      "CON INTIMACION",
      "CON CARTA AL COMANDO",
      "POR DEFINIR",
      "DESALOJADO",
      "DENUNCIA DE AVASALLAMIENTO DESESTIMADA",
      "SE PROSIGUIO CON EL TRAMITE DE DOTACION"
    ];
    const existentes = [...new Set(STATE.casosCache.map(c => (c.estado_actual || "").trim()).filter(Boolean))];
    const todosEstados = [...ordenEstados];
    existentes.forEach(e => { if (!todosEstados.includes(e)) todosEstados.push(e); });
    UTIL.qs("#filtro-estado-actual").innerHTML = `<option value="">Estado actual</option>` + todosEstados.map(c => `<option value="${c}">${c}</option>`).join("");

    UTIL.qs("#filtro-accion").innerHTML = `<option value="">Acción a seguir</option>` +
      ["PROSEGUIR CON EL PROCESO DE DOTACION","MEDIDAS PRECAUTORIAS","DESESTIMAR LA DENUNCIA","POR DETERMINAR","REPROGRAMAR INSPECCION","SIN DEFINIR"].map(a => `<option value="${a}">${a}</option>`).join("");
  },

  enlazarFiltros() {
    const ids = ["filtro-texto","filtro-departamento","filtro-provincia","filtro-municipio","filtro-tipo-propiedad",
      "filtro-clasificacion","filtro-prioridad","filtro-estado-global","filtro-estado-actual","filtro-estado-inspeccion",
      "filtro-accion","filtro-gestion"];
    const leer = () => {
      STATE.filtros = {
        texto: UTIL.qs("#filtro-texto").value.trim(),
        departamento: UTIL.qs("#filtro-departamento").value,
        provincia: UTIL.qs("#filtro-provincia").value,
        municipio: UTIL.qs("#filtro-municipio").value,
        tipo_propiedad: UTIL.qs("#filtro-tipo-propiedad").value,
        clasificacion: UTIL.qs("#filtro-clasificacion").value,
        prioridad: UTIL.qs("#filtro-prioridad").value,
        estado_global: UTIL.qs("#filtro-estado-global").value,
        estado_actual: UTIL.qs("#filtro-estado-actual").value,
        estado_inspeccion: UTIL.qs("#filtro-estado-inspeccion").value,
        accion: UTIL.qs("#filtro-accion").value,
        gestion: UTIL.qs("#filtro-gestion").value
      };
      STATE.filtroActivoLabel = null;
      LISTADO.pintarBannerFiltro();
      LISTADO.pintarTabla();
    };
    ids.forEach(id => {
      const el = UTIL.qs("#" + id);
      el.oninput = UTIL.debounce(leer, 250);
      el.onchange = leer;
    });

    // La cascada departamento → provincia → municipio se asigna DESPUÉS del bucle genérico
    // (si no, el bucle de arriba pisa estos onchange y la cascada deja de funcionar).
    UTIL.qs("#filtro-departamento").onchange = () => {
      const dep = UTIL.qs("#filtro-departamento").value;
      UTIL.qs("#filtro-provincia").innerHTML = `<option value="">Provincia</option>` + TERRITORIOS.provincias(dep).map(p => `<option value="${p}">${p}</option>`).join("");
      UTIL.qs("#filtro-municipio").innerHTML = `<option value="">Municipio</option>`;
      leer();
    };
    UTIL.qs("#filtro-provincia").onchange = () => {
      const dep = UTIL.qs("#filtro-departamento").value, prov = UTIL.qs("#filtro-provincia").value;
      UTIL.qs("#filtro-municipio").innerHTML = `<option value="">Municipio</option>` + TERRITORIOS.municipios(dep, prov).map(m => `<option value="${m}">${m}</option>`).join("");
      leer();
    };

    UTIL.qs("#btn-reset-filtros").onclick = () => {
      ids.forEach(id => { const el = UTIL.qs("#" + id); if (el.tagName === "SELECT") el.selectedIndex = 0; else el.value = ""; });
      STATE.filtros = {};
      STATE.filtroActivoLabel = null;
      LISTADO.pintarBannerFiltro();
      LISTADO.pintarTabla();
    };
    UTIL.qs("#btn-clear-filter").onclick = UTIL.qs("#btn-reset-filtros").onclick;
    UTIL.qs("#btn-nuevo-caso").onclick = () => ROUTER.irANuevoCaso();
    UTIL.qs("#btn-exportar-csv-listado").onclick = async () => {
      await CASOS.fetchTodos();
      IMPORTAR.exportarCasosCSV(CASOS.aplicaFiltros(STATE.casosCache, STATE.filtros || {}));
    };
  },

  pintarBannerFiltro() {
    const banner = UTIL.qs("#active-filter-banner");
    if (STATE.filtroActivoLabel) {
      banner.classList.remove("hidden");
      UTIL.qs("#active-filter-text").textContent = `Filtro activo: ${STATE.filtroActivoLabel}`;
    } else {
      banner.classList.add("hidden");
    }
  },

  async refrescar() {
    await CASOS.fetchTodos();
    LISTADO.pintarTabla();
  },

  pintarTabla() {
    const lista = CASOS.aplicaFiltros(STATE.casosCache, STATE.filtros || {});
    const body = UTIL.qs("#tabla-casos-body");
    UTIL.qs("#listado-vacio").classList.toggle("hidden", lista.length > 0);
    body.innerHTML = lista.map(c => `
      <tr>
        <td>${c.nro}</td><td>${c.id_inspec}</td><td>${c.hoja_de_ruta || "—"}</td>
        <td>${UTIL.fechaCorta(c.fecha_ingreso)}</td><td>${c.gestion || "—"}</td>
        <td>${c.departamento || "—"}</td><td>${c.provincia || "—"}</td><td>${c.municipio || "—"}</td>
        <td>${c.nombre_predio || "—"}</td><td>${c.tipo_propiedad || "—"}</td><td>${c.clasificacion_caso || "—"}</td>
        <td>${c.denunciante || "—"}</td>
        <td>${LISTADO.badgePrioridad(c.prioridad)}</td>
        <td>${LISTADO.badgeEstadoGlobal(c.estado_global)}</td>
        <td>${c.estado_actual}</td><td>${c.estado_inspeccion || "—"}</td><td>${c.accion_a_seguir || "—"}</td>
        <td>${(c.actualizado_por && c.actualizado_por === STATE.user.id) ? "Yo" : "—"}</td>
        <td>${UTIL.fechaHora(c.actualizado_en)}</td>
        <td>
          <button class="btn btn-sm btn-secondary" data-accion="ver" data-id="${c.id}">Ver</button>
          <button class="btn btn-sm btn-secondary" data-accion="editar" data-id="${c.id}">Editar</button>
        </td>
      </tr>`).join("");
    UTIL.qsa("button[data-accion]", body).forEach(b => {
      b.onclick = () => b.dataset.accion === "ver" ? ROUTER.irADetalle(b.dataset.id) : ROUTER.irAEditar(b.dataset.id);
    });
  },

  badgePrioridad(p) {
    if (!p) return "—";
    const up = p.toUpperCase();
    const cls = (up === "ALTA" || up === "ALTO") ? "badge-alta" : (up === "MEDIA" || up === "MEDIO") ? "badge-media" : "badge-baja";
    return `<span class="badge ${cls}">${p}</span>`;
  },
  badgeEstadoGlobal(e) {
    if (!e) return "—";
    const concluido = e === "CONCLUIDO" || e === "PROCESO CONCLUIDO";
    return `<span class="badge ${concluido ? "badge-concluido" : "badge-curso"}">${e}</span>`;
  }
};

/* ============================================================================
   FORMULARIO (Nuevo / Editar)
   ============================================================================ */
const FORM = {
  modoEdicion: false,

  async render(casoId) {
    await TERRITORIOS.cargar();
    TERRITORIOS.enlazarSelects(UTIL.qs("#form-departamento"), UTIL.qs("#form-provincia"), UTIL.qs("#form-municipio"));
    UTIL.qs("#duplicado-warning").classList.add("hidden");

    if (STATE.territorios.length === 0) {
      UTIL.toast("Aún no hay departamentos/provincias/municipios cargados. Ve a Importar/Exportar para agregarlos.", "warning");
    }

    if (casoId) {
      FORM.modoEdicion = true;
      const caso = await CASOS.fetchPorId(casoId);
      STATE.casoActual = caso;
      UTIL.qs("#form-titulo").textContent = `Editar Caso · ${caso.id_inspec}`;
      UTIL.qs("#caso-id").value = caso.id;
      FORM.llenarCampos(caso);
      TERRITORIOS.setValores(UTIL.qs("#form-departamento"), UTIL.qs("#form-provincia"), UTIL.qs("#form-municipio"), caso.departamento, caso.provincia, caso.municipio);
    } else {
      FORM.modoEdicion = false;
      STATE.casoActual = null;
      UTIL.qs("#form-titulo").textContent = "Nuevo Caso";
      UTIL.qs("#form-caso").reset();
      UTIL.qs("#caso-id").value = "";
      TERRITORIOS.setValores(UTIL.qs("#form-departamento"), UTIL.qs("#form-provincia"), UTIL.qs("#form-municipio"), "", "", "");
    }

    FORM.actualizarBloqueoCampos();
    FORM.actualizarParte3Visibilidad();
    FORM.actualizarVisibilidadComunidad();
    FORM.recalcularEstadoInspeccion();
    FORM.actualizarProgreso();
    FORM.enlazarEventos();

    // Solo un administrador puede cancelar una inspección ya programada (reforzado también en la base de datos).
    const btnCancelarProg = UTIL.qs("#btn-cancelar-programacion");
    btnCancelarProg.classList.toggle("hidden", !AUTH.esAdmin());
  },

  llenarCampos(caso) {
    UTIL.qsa("[data-campo]").forEach(el => {
      const campo = el.dataset.campo;
      if (["departamento","provincia","municipio"].includes(campo)) return; // manejado por TERRITORIOS
      const v = caso[campo];
      el.value = v === null || v === undefined ? "" : v;
    });
    UTIL.qs("#form-gestion-inspeccion").value = caso.gestion_inspeccion || "";
  },

  // Marca visualmente (no bloquea del todo) los campos que ya tienen valor y
  // no son de edición libre, para avisar que un cambio requerirá aprobación.
  actualizarBloqueoCampos() {
    UTIL.qsa("[data-campo]").forEach(el => {
      const campo = el.dataset.campo;
      const original = STATE.casoActual ? STATE.casoActual[campo] : null;
      const protegido = FORM.modoEdicion && !UTIL.vacio(original) && !CAMPOS_LIBRES.includes(campo);
      el.classList.toggle("field-locked", !!protegido);
      el.title = protegido ? "Este dato ya está registrado. Cambiarlo generará una solicitud de aprobación." : "";
    });
  },

  recalcularEstadoInspeccion() {
    const accionEl = UTIL.qs("#form-accion-a-seguir");
    const inspEl = UTIL.qs("#form-estado-inspeccion") || UTIL.qs("#form-estado-inspeccion-hidden");
    const correspondeEl = UTIL.qs("#form-corresponde-atender");
    const panelReprogramar = UTIL.qs("#panel-reprogramar-inline");
    const badge = UTIL.qs("#badge-estado-inspeccion");
    const valorParte1 = UTIL.qs("#parte1-estado-inspeccion-valor");
    const cajaParte1 = UTIL.qs("#parte1-estado-inspeccion-box");

    const accion = accionEl ? accionEl.value : "";
    const estado = inspEl ? (inspEl.value || "PENDIENTE") : "PENDIENTE";

    if (badge) {
      badge.textContent = estado;
      badge.className = "badge " + (estado === "INSPECCIONADO" ? "badge-concluido" : (estado === "REPROGRAMAR" ? "badge-alta" : "badge-curso"));
    }
    if (valorParte1) valorParte1.textContent = estado;
    if (cajaParte1 && correspondeEl) cajaParte1.classList.toggle("hidden", correspondeEl.value !== "SI");
    if (panelReprogramar) panelReprogramar.style.display = (accion === "REPROGRAMAR INSPECCION") ? "block" : "none";
  },

  actualizarVisibilidadComunidad() {
    const val = UTIL.qs("#form-asociado-comunidad").value;
    UTIL.qs("#campo-nombre-comunidad-wrap").classList.toggle("hidden", val !== "SI");
  },

  actualizarParte3Visibilidad() {
    const accion = UTIL.qs('[data-campo="accion_a_seguir"]').value;
    const bloque = UTIL.qs("#bloque-parte3");
    const hint = UTIL.qs("#parte3-hint");
    const habilitada = accion === "EMITIR MEDIDAS PRECAUTORIAS" || accion === "MEDIDAS PRECAUTORIAS";
    bloque.style.opacity = habilitada ? "1" : ".55";
    hint.classList.toggle("hidden", habilitada);
    UTIL.qsa("#parte3-body [data-campo]").forEach(el => el.disabled = !habilitada);
    UTIL.qs("#estado-parte3").textContent = habilitada ? "EN PROCESO" : "NO APLICA";
  },

  actualizarProgreso() {
    const caso = FORM.leerFormularioComoObjeto();
    const p1 = CASOS.completitudParte(caso, CAMPOS_PARTE1);
    const p2 = CASOS.completitudParte(caso, CAMPOS_PARTE2);
    const p3 = (caso.accion_a_seguir === "EMITIR MEDIDAS PRECAUTORIAS" || caso.accion_a_seguir === "MEDIDAS PRECAUTORIAS") ? CASOS.completitudParte(caso, CAMPOS_PARTE3) : 0;
    UTIL.qs("#progreso-parte1").style.width = p1 + "%";
    UTIL.qs("#progreso-parte2").style.width = p2 + "%";
    UTIL.qs("#progreso-parte3").style.width = p3 + "%";
    UTIL.qs("#estado-parte1").textContent = p1 === 100 ? "COMPLETO" : p1 === 0 ? "PENDIENTE" : "EN PROCESO";
    UTIL.qs("#estado-parte2").textContent = p2 === 100 ? "COMPLETO" : p2 === 0 ? "PENDIENTE" : "EN PROCESO";
    const total = CASOS.completitud(caso);
    UTIL.qs("#form-completitud").textContent = `Completitud del caso: ${total}%`;
  },

  leerFormularioComoObjeto() {
    const obj = {};
    UTIL.qsa("[data-campo]").forEach(el => { obj[el.dataset.campo] = el.value === "" ? null : el.value; });
    return obj;
  },

  enlazarEventos() {
    UTIL.qsa(".parte-header").forEach(h => {
      h.onclick = () => UTIL.qs("#" + h.dataset.toggle).classList.toggle("collapsed");
    });

    // 1) Recalcular progreso en cualquier cambio de campo (regla general primero).
    UTIL.qsa("[data-campo]").forEach(el => { el.oninput = FORM.actualizarProgreso; el.onchange = FORM.actualizarProgreso; });

    // 2) Lógica especial de ciertos campos, encadenada con el recálculo de progreso
    //    (se asigna DESPUÉS del bucle genérico para que no quede sobrescrita).
    const encadenar = (selector, fn) => {
      const el = UTIL.qs(selector);
      if (el) el.onchange = () => { fn(); FORM.actualizarProgreso(); };
    };
    encadenar('[data-campo="accion_a_seguir"]', () => { FORM.actualizarParte3Visibilidad(); FORM.recalcularEstadoInspeccion(); });
    encadenar('[data-campo="estado_inspeccion"]', () => FORM.recalcularEstadoInspeccion());
    encadenar('[data-campo="corresponde_atender"]', () => FORM.recalcularEstadoInspeccion());
    encadenar('[data-campo="asociado_comunidad"]', () => FORM.actualizarVisibilidadComunidad());
    encadenar('[data-campo="fecha_programada_inspeccion"]', () => FORM.recalcularEstadoInspeccion());
    encadenar('[data-campo="fecha_informe"]', () => FORM.recalcularEstadoInspeccion());
    encadenar('[data-campo="estado_actual"]', () => {
      const eaEl = UTIL.qs('[data-campo="estado_actual"]');
      const egEl = UTIL.qs('[data-campo="estado_global"]');
      if (!eaEl || !egEl) return;
      const ea = (eaEl.value || "").trim();
      const concluidos = [
        "DESALOJADO",
        "DENUNCIA DE AVASALLAMIENTO DESESTIMADA",
        "SE PROSIGUIO CON EL TRAMITE DE DOTACION"
      ];
      const enCurso = [
        "CON INSPECCION- PENDIENTE DE EMISION DE MEDIDAS PRECAUTORIAS",
        "CON MEDIDAS PRECAUTORIAS",
        "CON INTIMACION",
        "CON CARTA AL COMANDO",
        "POR DEFINIR"
      ];
      if (concluidos.includes(ea)) {
        egEl.value = "PROCESO CONCLUIDO";
      } else if (enCurso.includes(ea)) {
        egEl.value = "PROCESO EN CURSO";
      }
    });

    // 3) Cascada departamento → provincia → municipio (también al final, por la misma razón).
    TERRITORIOS.reenlazarCascada(
      UTIL.qs("#form-departamento"), UTIL.qs("#form-provincia"), UTIL.qs("#form-municipio"),
      FORM.actualizarProgreso
    );

    UTIL.qs("#btn-form-volver").onclick = () => ROUTER.ir("listado");
    UTIL.qs("#btn-cancelar-programacion").onclick = () => FORM.abrirModalCancelarProgramacion();
    UTIL.qs("#btn-confirmar-reprogramacion").onclick = () => FORM.confirmarReprogramacion();
    UTIL.qs("#form-caso").onsubmit = FORM.guardar;
  },

  abrirModalCancelarProgramacion() {
    if (!FORM.modoEdicion) { UTIL.toast("Guarde el caso antes de programar la inspección.", "warning"); return; }
    const fechaActual = STATE.casoActual.fecha_programada_inspeccion;
    if (UTIL.vacio(fechaActual)) { UTIL.toast("Este caso no tiene una inspección programada.", "warning"); return; }
    MODAL.abrir(`
      <h3>Cancelar Programación de Inspección</h3>
      <p class="hint-text">Se cancelará la fecha programada (${UTIL.fechaCorta(fechaActual)}). El caso vuelve a quedar como "Inspección Pendiente".</p>
      <label>Motivo de la cancelación <textarea id="m-motivo" required></textarea></label>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="m-cancelar">Volver</button>
        <button class="btn btn-danger" id="m-confirmar">Cancelar Programación</button>
      </div>`);
    UTIL.qs("#m-cancelar").onclick = MODAL.cerrar;
    UTIL.qs("#m-confirmar").onclick = async () => {
      const motivo = UTIL.qs("#m-motivo").value.trim();
      if (!motivo) { UTIL.toast("Indique el motivo.", "error"); return; }
      try {
        await INSPECCIONES.registrarEvento(STATE.casoActual.id, "CANCELACION", { fechaAnterior: fechaActual, fechaNueva: null, motivo });
        await CASOS.actualizarDirecto(STATE.casoActual.id, { fecha_programada_inspeccion: null }, STATE.casoActual);
        UTIL.toast("Programación cancelada.", "success");
        MODAL.cerrar();
        await FORM.render(STATE.casoActual.id);
      } catch (e) { UTIL.toast(UTIL.errorAmigable(e), "error"); }
    };
  },

  // Se usa cuando, en el informe de inspección, la acción a seguir es "Reprogramar inspección"
  // (no se pudo ingresar al área). Registra el evento y deja el caso listo para el nuevo intento.
  async confirmarReprogramacion() {
    if (!FORM.modoEdicion) { UTIL.toast("Guarde el caso primero (con la acción a seguir en 'Reprogramar inspección').", "warning"); return; }
    const nuevaFecha = UTIL.qs("#reprog-nueva-fecha").value;
    const motivo = UTIL.qs("#reprog-motivo").value.trim();
    if (!nuevaFecha || !motivo) { UTIL.toast("Complete la nueva fecha y el motivo.", "error"); return; }
    try {
      const fechaAnterior = STATE.casoActual.fecha_programada_inspeccion;
      await INSPECCIONES.registrarEvento(STATE.casoActual.id, "REPROGRAMACION", { fechaAnterior, fechaNueva: nuevaFecha, motivo });
      // Vuelve el caso al estado de "nueva inspección programada": limpia el intento anterior
      // (queda igualmente conservado en el historial de cambios y en inspecciones_eventos).
      await CASOS.actualizarDirecto(STATE.casoActual.id, {
        fecha_programada_inspeccion: nuevaFecha,
        fecha_real_inspeccion: null,
        fecha_informe: null,
        informe_inspeccion: null,
        conclusion_informe_inspeccion: null,
        accion_a_seguir: "SIN DEFINIR"
      }, STATE.casoActual);
      UTIL.toast("Inspección reprogramada correctamente.", "success");
      await FORM.render(STATE.casoActual.id);
    } catch (e) { UTIL.toast(UTIL.errorAmigable(e), "error"); }
  },

  async guardar(ev) {
    ev.preventDefault();
    const casoId = UTIL.qs("#caso-id").value;
    const nuevos = FORM.leerFormularioComoObjeto();

    if (!casoId) {
      // NUEVO CASO
      const duplicados = await CASOS.verificarDuplicado({
        hoja_de_ruta: nuevos.hoja_de_ruta, codigo_expediente: nuevos.codigo_expediente, nombre_predio: nuevos.nombre_predio
      });
      if (duplicados.length > 0) {
        const banner = UTIL.qs("#duplicado-warning");
        banner.classList.remove("hidden");
        banner.innerHTML = `${ICONS.alert} <b>POSIBLE CASO DUPLICADO</b> — ya existe: ` + duplicados.map(d => `${d.id_inspec} (${d.nombre_predio || d.hoja_de_ruta || d.codigo_expediente})`).join(", ") +
          `. Revise antes de continuar. <button class="btn btn-sm btn-primary" id="btn-continuar-duplicado">Registrar de todos modos</button>`;
        UTIL.qs("#btn-continuar-duplicado").onclick = async () => { banner.classList.add("hidden"); await FORM.crearCasoNuevo(nuevos); };
        return;
      }
      await FORM.crearCasoNuevo(nuevos);
      return;
    }

    // EDICIÓN
    const original = STATE.casoActual;
    const { directos, protegidos } = CASOS.clasificarCambios(original, nuevos);

    try {
      if (Object.keys(directos).length > 0) {
        await CASOS.actualizarDirecto(casoId, directos, original);
      }
      if (Object.keys(protegidos).length > 0) {
        FORM.pedirMotivoYSolicitar(casoId, protegidos, original);
        return; // el guardado de solicitudes continúa dentro del modal
      }
      UTIL.toast("Caso actualizado correctamente.", "success");
      await ROUTER.irADetalle(casoId);
    } catch (e) {
      UTIL.toast(UTIL.errorAmigable(e), "error");
    }
  },

  async crearCasoNuevo(nuevos) {
    try {
      const limpio = { ...nuevos };
      const caso = await CASOS.crear(limpio);
      FORM.mostrarAvisoCodigoCaso(caso);
    } catch (e) {
      UTIL.toast(UTIL.errorAmigable(e), "error");
    }
  },

  // Aviso grande y llamativo para que el personal técnico no olvide cargar
  // el polígono del área a la GDB usando este mismo código.
  mostrarAvisoCodigoCaso(caso) {
    UTIL.qs("#modal-box").className = "modal-box modal-box-grande";
    MODAL.abrir(`
      <div class="modal-icono">${ICONS.pin}</div>
      <h3>Caso registrado correctamente</h3>
      <p>Código del caso:</p>
      <div class="modal-id-caso">${caso.id_inspec}</div>
      <div class="modal-instruccion">
        ${ICONS.alert} <b>Importante:</b> cargue el polígono del área en la GDB (base de datos gráfica) utilizando
        este mismo código <b>${caso.id_inspec}</b> como identificador (ID_INSPEC). Sin este paso,
        el caso no podrá vincularse con la información espacial.
      </div>
      <div class="modal-actions" style="justify-content:center;">
        <button class="btn btn-primary" id="m-continuar">Entendido, continuar</button>
      </div>`);
    UTIL.qs("#m-continuar").onclick = async () => {
      MODAL.cerrar();
      await ROUTER.irADetalle(caso.id);
    };
  },

  pedirMotivoYSolicitar(casoId, protegidos, original) {
    const campos = Object.keys(protegidos);
    MODAL.abrir(`
      <h3>Solicitar Modificación</h3>
      <p class="hint-text">Los siguientes campos ya tienen información registrada. El cambio quedará
      <b>pendiente de aprobación</b> por un administrador:</p>
      <ul>${campos.map(c => `<li><b>${c}</b>: "${original[c] ?? "—"}" → "${protegidos[c] ?? "—"}"</li>`).join("")}</ul>
      <label>Motivo del cambio <textarea id="m-motivo" required></textarea></label>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="m-cancelar">Cancelar</button>
        <button class="btn btn-primary" id="m-confirmar">Enviar Solicitud</button>
      </div>`);
    UTIL.qs("#m-cancelar").onclick = () => { MODAL.cerrar(); };
    UTIL.qs("#m-confirmar").onclick = async () => {
      const motivo = UTIL.qs("#m-motivo").value.trim();
      if (!motivo) { UTIL.toast("Indique el motivo del cambio.", "error"); return; }
      try {
        await SOLICITUDES.crearVarias(casoId, protegidos, original, motivo);
        UTIL.toast("Solicitud de modificación enviada. Queda pendiente de aprobación.", "success");
        MODAL.cerrar();
        await ROUTER.irADetalle(casoId);
      } catch (e) { UTIL.toast(UTIL.errorAmigable(e), "error"); }
    };
  }
};

/* ============================================================================
   MODAL GENÉRICO
   ============================================================================ */
const MODAL = {
  abrir(html) {
    UTIL.qs("#modal-box").innerHTML = html;
    UTIL.qs("#modal-overlay").classList.remove("hidden");
  },
  cerrar() {
    UTIL.qs("#modal-overlay").classList.add("hidden");
    UTIL.qs("#modal-box").innerHTML = "";
    UTIL.qs("#modal-box").className = "modal-box";
  }
};

/* ============================================================================
   DETALLE DEL CASO
   ============================================================================ */
const DETALLE = {
  async render(casoId) {
    const caso = await CASOS.fetchPorId(casoId);
    if (!caso) return;
    STATE.casoActual = caso;

    UTIL.qs("#detalle-header").innerHTML = `
      <div class="kv"><span class="k">ID_INSPEC</span><span class="v">${caso.id_inspec}</span></div>
      <div class="kv"><span class="k">Predio</span><span class="v">${caso.nombre_predio || "—"}</span></div>
      <div class="kv"><span class="k">Departamento</span><span class="v">${caso.departamento || "—"}</span></div>
      <div class="kv"><span class="k">Municipio</span><span class="v">${caso.municipio || "—"}</span></div>
      <div class="kv"><span class="k">Estado Global</span><span class="v">${LISTADO.badgeEstadoGlobal(caso.estado_global)}</span></div>
      <div class="kv"><span class="k">Estado Actual</span><span class="v">${caso.estado_actual}</span></div>
      <div class="kv"><span class="k">Prioridad</span><span class="v">${LISTADO.badgePrioridad(caso.prioridad)}</span></div>
      <div class="kv"><span class="k">Completitud</span><span class="v">${CASOS.completitud(caso)}%</span></div>`;

    UTIL.qs("#btn-detalle-editar").onclick = () => ROUTER.irAEditar(caso.id);
    UTIL.qs("#btn-detalle-volver").onclick = () => ROUTER.ir("listado");

    DETALLE.renderResumen(caso);
    await DETALLE.renderLineaTiempo(caso);
    await DETALLE.renderHistorial(caso);
    DETALLE.renderAlertasCaso(caso);

    UTIL.qsa(".tab-btn").forEach(btn => {
      btn.onclick = () => {
        UTIL.qsa(".tab-btn").forEach(b => b.classList.remove("active"));
        UTIL.qsa(".tab-panel").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        UTIL.qs("#" + btn.dataset.tab).classList.add("active");
      };
    });
  },

  bloque(titulo, campos, caso) {
    const filas = campos.map(c => `<div class="kv"><span class="k">${c.replace(/_/g," ")}</span><span class="v">${
      UTIL.vacio(caso[c]) ? "—" : (c.startsWith("fecha") ? UTIL.fechaCorta(caso[c]) : caso[c])
    }</span></div>`).join("");
    return `<div class="panel"><h3>${titulo}</h3><div class="detalle-header" style="border:none;padding:0;">${filas}</div></div>`;
  },

  renderResumen(caso) {
    let html = DETALLE.bloque("Parte 1 · Registro", CAMPOS_PARTE1, caso);
    html += DETALLE.bloque("Parte 2 · Inspección", CAMPOS_PARTE2, caso);
    if (caso.accion_a_seguir === "EMITIR MEDIDAS PRECAUTORIAS" || caso.accion_a_seguir === "MEDIDAS PRECAUTORIAS") {
      html += DETALLE.bloque("Parte 3 · Medidas Precautorias", CAMPOS_PARTE3, caso);
    }
    UTIL.qs("#tab-resumen").innerHTML = html;
  },

  async renderLineaTiempo(caso) {
    const etapas = [
      { titulo: "Registro", ok: true, fecha: caso.registrado_en, doc: caso.hoja_de_ruta },
      { titulo: "Informe de Atención", ok: !UTIL.vacio(caso.informe_atencion), fecha: null, doc: caso.informe_atencion },
      { titulo: "Decisión de Atención", ok: caso.corresponde_atender !== "PENDIENTE", fecha: null, doc: caso.corresponde_atender },
      { titulo: "Programación de Inspección", ok: !UTIL.vacio(caso.fecha_programada_inspeccion), fecha: caso.fecha_programada_inspeccion, doc: caso.tecnico_responsable },
      { titulo: "Inspección Realizada", ok: !UTIL.vacio(caso.fecha_real_inspeccion), fecha: caso.fecha_real_inspeccion, doc: null },
      { titulo: "Informe de Inspección", ok: !UTIL.vacio(caso.fecha_informe), fecha: caso.fecha_informe, doc: caso.informe_inspeccion },
      { titulo: "Medidas Precautorias", ok: !UTIL.vacio(caso.res_medidas_precautorias), fecha: caso.fecha_resolucion_medidas, doc: caso.res_medidas_precautorias },
      { titulo: "Intimación", ok: !UTIL.vacio(caso.intimacion), fecha: caso.fecha_intimacion, doc: caso.intimacion },
      { titulo: "Verificación", ok: !UTIL.vacio(caso.informe_verificacion_intimacion), fecha: caso.fecha_informe_verificacion, doc: caso.estado_verificacion },
      { titulo: "Carta al Comando", ok: !UTIL.vacio(caso.carta_comando), fecha: caso.fecha_carta_comando, doc: caso.carta_comando },
      { titulo: "Desalojo", ok: !UTIL.vacio(caso.fecha_desalojo), fecha: caso.fecha_desalojo, doc: caso.informe_acta_desalojo }
    ];
    UTIL.qs("#tab-linea-tiempo").innerHTML = `<ul class="timeline">${
      etapas.map(e => `<li class="${e.ok ? "completo" : "pendiente-etapa"}">
        <div class="t-titulo">${e.titulo} ${e.ok ? ICONS.check : ICONS.clock + " Pendiente"}</div>
        <div class="t-meta">${e.fecha ? UTIL.fechaCorta(e.fecha) : ""} ${e.doc ? "· " + e.doc : ""}</div>
      </li>`).join("")
    }</ul>`;
  },

  async renderHistorial(caso) {
    const hist = await HISTORIAL.fetchPorCaso(caso.id);
    const cont = UTIL.qs("#tab-historial");
    if (hist.length === 0) { cont.innerHTML = `<p class="hint-text">Sin cambios registrados.</p>`; return; }
    cont.innerHTML = hist.map(h => `
      <div class="hist-item">
        <div><b>${h.campo}</b>: ${h.valor_anterior ?? "vacío"} → ${h.valor_nuevo ?? "vacío"}</div>
        <div class="hist-meta">${UTIL.fechaHora(h.fecha)} · ${(h.perfiles && h.perfiles.nombre_completo) || "—"} · ${h.accion}${h.motivo ? " · " + h.motivo : ""}</div>
      </div>`).join("");
  },

  renderAlertasCaso(caso) {
    const pendientes = ALERTAS.pendientesDeCaso(caso);
    UTIL.qs("#tab-alertas-caso").innerHTML = pendientes.map(p =>
      `<div class="alert-line ${p.ok ? "ok" : "pend"}">${p.ok ? ICONS.check : ICONS.alert} ${p.texto}</div>`).join("");
  }
};

/* ============================================================================
   SEGUIMIENTO DE INSPECCIONES
   ============================================================================ */
const SEGUIMIENTO = {
  async render() {
    await CASOS.fetchTodos();
    await TERRITORIOS.cargar();
    const depSel = UTIL.qs("#seg-filtro-departamento");
    depSel.innerHTML = `<option value="">Departamento</option>` + TERRITORIOS.departamentos().map(d => `<option>${d}</option>`).join("");

    ["seg-filtro-mes","seg-filtro-gestion","seg-filtro-departamento","seg-filtro-tecnico","seg-filtro-estado"].forEach(id => {
      const el = UTIL.qs("#" + id);
      el.oninput = UTIL.debounce(SEGUIMIENTO.pintar, 250);
      el.onchange = SEGUIMIENTO.pintar;
    });
    UTIL.qs("#btn-seg-reset").onclick = () => {
      SEGUIMIENTO.filtroEspecial = null;
      ["seg-filtro-mes","seg-filtro-gestion","seg-filtro-departamento","seg-filtro-tecnico","seg-filtro-estado"].forEach(id => {
        const el = UTIL.qs("#" + id); if (el.tagName === "SELECT") el.selectedIndex = 0; else el.value = "";
      });
      SEGUIMIENTO.pintar();
    };
    SEGUIMIENTO.pintar();
  },

  filtrar() {
    const mes = UTIL.qs("#seg-filtro-mes").value;
    const gestion = UTIL.qs("#seg-filtro-gestion").value;
    const depto = UTIL.qs("#seg-filtro-departamento").value;
    const tecnico = UTIL.qs("#seg-filtro-tecnico").value.toLowerCase();
    const estado = UTIL.qs("#seg-filtro-estado").value;

    return STATE.casosCache.filter(c => {
      const tieneInspeccion = !UTIL.vacio(c.fecha_programada_inspeccion) || !UTIL.vacio(c.fecha_real_inspeccion) || c.estado_inspeccion;
      if (!tieneInspeccion) return false;
      if (mes) {
        const fechaRef = c.fecha_programada_inspeccion || c.fecha_real_inspeccion;
        if (!fechaRef || (new Date(fechaRef).getMonth() + 1) !== Number(mes)) return false;
      }
      if (gestion && String(c.gestion) !== String(gestion) && String(c.gestion_inspeccion) !== String(gestion)) return false;
      if (depto && c.departamento !== depto) return false;
      if (tecnico && !(c.tecnico_responsable || "").toLowerCase().includes(tecnico)) return false;
      if (estado) {
        const ce = (c.estado_inspeccion || "").trim().toUpperCase();
        const fe = estado.trim().toUpperCase();
        if (fe === "PENDIENTE DE INSPECCION" || fe === "PENDIENTE") {
          if (ce !== "PENDIENTE DE INSPECCION" && ce !== "PENDIENTE") return false;
        } else {
          if (ce !== fe) return false;
        }
      }
      if (SEGUIMIENTO.filtroEspecial === "con_informe" && UTIL.vacio(c.fecha_informe)) return false;
      if (SEGUIMIENTO.filtroEspecial === "esperando_informe" && (c.estado_inspeccion !== "INSPECCIONADO" || !UTIL.vacio(c.fecha_informe))) return false;
      return true;
    });
  },

  pintar() {
    const lista = SEGUIMIENTO.filtrar();
    const todos = STATE.casosCache;

    // Tarjetas: conteos sobre el total de la BD (sin filtros)
    const totalInsp = todos.filter(c => c.estado_inspeccion).length;
    const totalPendientes = todos.filter(c => c.estado_inspeccion === "PENDIENTE DE INSPECCION" || c.estado_inspeccion === "PENDIENTE").length;
    const totalProgramadas = todos.filter(c => c.estado_inspeccion === "PROGRAMADA").length;
    const totalInspeccionados = todos.filter(c => c.estado_inspeccion === "INSPECCIONADO").length;
    const totalConInforme = todos.filter(c => !UTIL.vacio(c.fecha_informe)).length;
    const totalEsperandoInforme = todos.filter(c => c.estado_inspeccion === "INSPECCIONADO" && UTIL.vacio(c.fecha_informe)).length;

    UTIL.qs("#seguimiento-cards").innerHTML = [
      { label: "Total de Inspecciones", val: totalInsp, click: () => { SEGUIMIENTO.filtroEspecial = null; UTIL.qs("#seg-filtro-estado").value = ""; SEGUIMIENTO.pintar(); } },
      { label: "Pendientes", val: totalPendientes, tipo: "alerta", click: () => { SEGUIMIENTO.filtroEspecial = null; UTIL.qs("#seg-filtro-estado").value = "PENDIENTE DE INSPECCION"; SEGUIMIENTO.pintar(); } },
      { label: "Programadas", val: totalProgramadas, tipo: "alerta", click: () => { SEGUIMIENTO.filtroEspecial = null; UTIL.qs("#seg-filtro-estado").value = "PROGRAMADA"; SEGUIMIENTO.pintar(); } },
      { label: "Inspeccionados", val: totalInspeccionados, tipo: "exito", click: () => { SEGUIMIENTO.filtroEspecial = null; UTIL.qs("#seg-filtro-estado").value = "INSPECCIONADO"; SEGUIMIENTO.pintar(); } },
      { label: "Con Informe Cargado", val: totalConInforme, tipo: "exito", click: () => { SEGUIMIENTO.filtroEspecial = "con_informe"; UTIL.qs("#seg-filtro-estado").value = ""; SEGUIMIENTO.pintar(); } },
      { label: "Esperando Informe", val: totalEsperandoInforme, tipo: "critico", click: () => { SEGUIMIENTO.filtroEspecial = "esperando_informe"; UTIL.qs("#seg-filtro-estado").value = ""; SEGUIMIENTO.pintar(); } }
    ].map((d, i) => `<div class="dash-card ${d.tipo || ""}" data-card-idx="${i}"><div class="num">${d.val}</div><div class="label">${d.label}</div></div>`).join("");

    UTIL.qsa("#seguimiento-cards .dash-card").forEach(el => {
      const idx = Number(el.dataset.cardIdx);
      const defs = [
        () => { SEGUIMIENTO.filtroEspecial = null; UTIL.qs("#seg-filtro-estado").value = ""; SEGUIMIENTO.pintar(); },
        () => { SEGUIMIENTO.filtroEspecial = null; UTIL.qs("#seg-filtro-estado").value = "PENDIENTE DE INSPECCION"; SEGUIMIENTO.pintar(); },
        () => { SEGUIMIENTO.filtroEspecial = null; UTIL.qs("#seg-filtro-estado").value = "PROGRAMADA"; SEGUIMIENTO.pintar(); },
        () => { SEGUIMIENTO.filtroEspecial = null; UTIL.qs("#seg-filtro-estado").value = "INSPECCIONADO"; SEGUIMIENTO.pintar(); },
        () => { SEGUIMIENTO.filtroEspecial = "con_informe"; UTIL.qs("#seg-filtro-estado").value = ""; SEGUIMIENTO.pintar(); },
        () => { SEGUIMIENTO.filtroEspecial = "esperando_informe"; UTIL.qs("#seg-filtro-estado").value = ""; SEGUIMIENTO.pintar(); }
      ];
      el.onclick = defs[idx];
    });

    const hoy = new Date();
    UTIL.qs("#tabla-seguimiento-body").innerHTML = lista.map(c => {
      const ref = c.fecha_real_inspeccion || c.fecha_programada_inspeccion;
      const dias = ref ? Math.floor((hoy - new Date(ref)) / 86400000) : "—";
      return `<tr>
        <td>${c.id_inspec}</td><td>${c.nombre_predio || c.hoja_de_ruta || "—"}</td>
        <td>${c.departamento || "—"}</td><td>${c.municipio || "—"}</td>
        <td>${UTIL.fechaCorta(c.fecha_programada_inspeccion)}</td><td>${UTIL.fechaCorta(c.fecha_real_inspeccion)}</td>
        <td>${c.tecnico_responsable || "—"}</td><td>${c.estado_inspeccion || "—"}</td>
        <td>${UTIL.vacio(c.informe_inspeccion) ? "—" : "Sí"}</td><td>${UTIL.fechaCorta(c.fecha_informe)}</td>
        <td>${dias}</td>
        <td><button class="btn btn-sm btn-secondary" data-id="${c.id}">Ver</button></td>
      </tr>`;
    }).join("");
    UTIL.qsa("#tabla-seguimiento-body button").forEach(b => b.onclick = () => ROUTER.irADetalle(b.dataset.id));
  }
};

/* ============================================================================
   ALERTAS Y PENDIENTES (módulo dedicado)
   ============================================================================ */
const ALERTAS_VIEW = {
  async render() {
    await CASOS.fetchTodos();
    const r = ALERTAS.resumenGeneral(STATE.casosCache);
    const defs = [
      { label: "Sin informe de atención", lista: r.sinInformeAtencion },
      { label: "Con inspección pendiente", lista: r.inspeccionPendiente, tipo: "alerta" },
      { label: "Inspecciones realizadas sin informe", lista: r.realizadasSinInforme, tipo: "critico" },
      { label: "Sin medidas precautorias emitidas", lista: r.sinMedidasPrecautorias, tipo: "critico" }
    ];
    UTIL.qs("#alertas-resumen-cards").innerHTML = defs.map((d, i) =>
      `<div class="dash-card ${d.tipo || ""}" data-idx="${i}"><div class="num">${d.lista.length}</div><div class="label">${d.label}</div></div>`).join("");
    UTIL.qsa("#alertas-resumen-cards .dash-card").forEach((el, i) => {
      el.onclick = () => ALERTAS_VIEW.pintarListado(defs[i].label, defs[i].lista);
    });
    ALERTAS_VIEW.pintarListado(null, STATE.casosCache.filter(c => c.estado_global === "PROCESO EN CURSO" && ALERTAS.pendientesDeCaso(c).some(p => !p.ok)));
  },

  pintarListado(titulo, lista) {
    const cont = UTIL.qs("#alertas-listado");
    cont.innerHTML = `<h3>${titulo || "Casos con pendientes"}</h3>` + (lista.length === 0
      ? `<p class="hint-text">No hay casos en esta categoría.</p>`
      : lista.map(c => {
          const pend = ALERTAS.pendientesDeCaso(c).filter(p => !p.ok);
          return `<div class="hist-item">
            <b>${c.id_inspec}</b> — ${c.nombre_predio || c.hoja_de_ruta || "—"}
            <button class="btn btn-sm btn-secondary" style="float:right" data-id="${c.id}">Ver caso</button>
            <div class="hist-meta">${pend.map(p => p.texto).join(" · ")}</div>
          </div>`;
        }).join(""));
    UTIL.qsa("#alertas-listado button[data-id]").forEach(b => b.onclick = () => ROUTER.irADetalle(b.dataset.id));
  }
};

/* ============================================================================
   SOLICITUDES DE CAMBIO (vista admin)
   ============================================================================ */
const SOLICITUDES_VIEW = {
  async render() {
    UTIL.qs("#sol-filtro-estado").onchange = SOLICITUDES_VIEW.pintar;
    await SOLICITUDES_VIEW.pintar();
  },

  async pintar() {
    const estado = UTIL.qs("#sol-filtro-estado").value;
    const lista = await SOLICITUDES.fetchTodas(estado || null);
    const body = UTIL.qs("#tabla-solicitudes-body");
    body.innerHTML = lista.map(s => `
      <tr>
        <td>${(s.casos && s.casos.id_inspec) || "—"}</td>
        <td>${s.campo}</td><td>${s.valor_anterior ?? "—"}</td><td>${s.valor_propuesto ?? "—"}</td>
        <td>${(s.sol && s.sol.nombre_completo) || "—"}</td>
        <td>${UTIL.fechaHora(s.fecha_solicitud)}</td>
        <td>${s.motivo}</td>
        <td><span class="badge ${s.estado === "APROBADO" ? "badge-concluido" : s.estado === "RECHAZADO" ? "badge-alta" : "badge-media"}">${s.estado}</span></td>
        <td>${s.estado === "PENDIENTE" ? `
            <button class="btn btn-sm btn-success" data-accion="aprobar" data-id="${s.id}">Aprobar</button>
            <button class="btn btn-sm btn-danger" data-accion="rechazar" data-id="${s.id}">Rechazar</button>`
          : (s.comentario_aprobacion || "—")}
        </td>
      </tr>`).join("");
    UTIL.qsa("button[data-accion]", body).forEach(btn => {
      btn.onclick = () => SOLICITUDES_VIEW.gestionar(lista.find(s => s.id === btn.dataset.id), btn.dataset.accion);
    });
  },

  gestionar(solicitud, accion) {
    MODAL.abrir(`
      <h3>${accion === "aprobar" ? "Aprobar" : "Rechazar"} Solicitud</h3>
      <p><b>${solicitud.campo}</b>: "${solicitud.valor_anterior ?? "—"}" → "${solicitud.valor_propuesto ?? "—"}"</p>
      <p class="hint-text">Motivo del solicitante: ${solicitud.motivo}</p>
      <label>Comentario (opcional) <textarea id="m-comentario"></textarea></label>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="m-cancelar">Cancelar</button>
        <button class="btn ${accion === "aprobar" ? "btn-success" : "btn-danger"}" id="m-confirmar">${accion === "aprobar" ? "Aprobar" : "Rechazar"}</button>
      </div>`);
    UTIL.qs("#m-cancelar").onclick = MODAL.cerrar;
    UTIL.qs("#m-confirmar").onclick = async () => {
      const comentario = UTIL.qs("#m-comentario").value;
      try {
        if (accion === "aprobar") await SOLICITUDES.aprobar(solicitud, comentario);
        else await SOLICITUDES.rechazar(solicitud, comentario);
        UTIL.toast("Solicitud actualizada.", "success");
        MODAL.cerrar();
        await SOLICITUDES_VIEW.pintar();
      } catch (e) { UTIL.toast(UTIL.errorAmigable(e), "error"); }
    };
  }
};

/* ============================================================================
   USUARIOS (vista admin)
   ============================================================================ */
const USUARIOS = {
  async render() {
    const { data, error } = await supa.from("perfiles").select("*").order("nombre_completo");
    if (error) { UTIL.toast("No se pudo cargar la lista de usuarios.", "error"); return; }
    UTIL.qs("#tabla-usuarios-body").innerHTML = data.map(p => `
      <tr>
        <td>${p.nombre_completo}</td>
        <td>${p.rol}</td>
        <td>${UTIL.fechaHora(p.creado_en)}</td>
        <td>
          ${p.id !== STATE.user.id ? `<button class="btn btn-sm btn-secondary" data-id="${p.id}" data-rol="${p.rol}">
            Cambiar a ${p.rol === "ADMINISTRADOR" ? "OPERADOR" : "ADMINISTRADOR"}
          </button>` : "<span class='hint-text'>(usted)</span>"}
        </td>
      </tr>`).join("");
    UTIL.qsa("#tabla-usuarios-body button").forEach(b => {
      b.onclick = async () => {
        const nuevoRol = b.dataset.rol === "ADMINISTRADOR" ? "OPERADOR" : "ADMINISTRADOR";
        const { error } = await supa.from("perfiles").update({ rol: nuevoRol }).eq("id", b.dataset.id);
        if (error) UTIL.toast(UTIL.errorAmigable(error), "error");
        else { UTIL.toast("Rol actualizado.", "success"); USUARIOS.render(); }
      };
    });
  }
};

/* ============================================================================
   IMPORTACIÓN / EXPORTACIÓN CSV
   ============================================================================ */
const IMPORTAR = {
  // Normaliza texto: recorta espacios y colapsa mayúsculas para comparación de catálogos.
  normalizarTexto(v) {
    if (v === undefined || v === null) return "";
    return v.toString().trim().replace(/\s+/g, " ").toUpperCase();
  },

  MAPEO_ACCION: {
    "PARA CONSIDERACION": "CONTINUAR TRAMITE DE DOTACION",
    "PARA CONSIDERACIÓN": "CONTINUAR TRAMITE DE DOTACION"
  },

  async leerArchivoTexto(file) {
    // Intenta UTF-8; si contiene caracteres de reemplazo, reintenta como Windows-1252/Latin-1.
    const buffer = await file.arrayBuffer();
    let texto = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    if (texto.includes("\uFFFD")) {
      try { texto = new TextDecoder("windows-1252").decode(buffer); }
      catch (e) { texto = new TextDecoder("iso-8859-1").decode(buffer); }
    }
    return texto;
  },

  parseCSV(texto, separador = ";") {
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      const next = texto[i + 1];
      if (c === '"') {
        if (inQuotes && next === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (c === separador && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') { i++; }
        row.push(cur.trim());
        cur = '';
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
          rows.push(row);
        }
        row = [];
      } else {
        cur += c;
      }
    }
    if (cur || row.length) {
      row.push(cur.trim());
      rows.push(row);
    }

    if (rows.length === 0) return { encabezados: [], filas: [] };
    const encabezados = rows[0].map(h => IMPORTAR.normalizarTexto(h).toLowerCase().replace(/\s+/g, "_"));
    const filas = rows.slice(1).map(valores => {
      const obj = {};
      encabezados.forEach((h, i) => obj[h] = (valores[i] || "").trim());
      return obj;
    });
    return { encabezados, filas };
  },

  async importarCasos(file) {
    const resultado = { procesados: 0, importados: 0, advertencias: [], errores: [] };
    const texto = await IMPORTAR.leerArchivoTexto(file);
    const { filas } = IMPORTAR.parseCSV(texto);

    const limpiarFecha = (d) => {
      if (!d) return null;
      const s = d.trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    };

    const mapearPrioridad = (p) => {
      if (!p) return null;
      const u = IMPORTAR.normalizarTexto(p);
      if (u === "ALTO") return "ALTA";
      if (u === "MEDIO") return "MEDIA";
      if (u === "BAJO") return "BAJA";
      return u;
    };

    const registros = [];
    filas.forEach((f, idx) => {
      resultado.procesados++;
      try {
        const tipoPropiedad = IMPORTAR.normalizarTexto(f.tipo_propiedad || f.tipo_de_propiedad);
        let idpredio = f.idpredio || f.id_predio || null;
        if (IMPORTAR.normalizarTexto(idpredio) === "TIERRA FISCAL" && tipoPropiedad === "TIERRA FISCAL") {
          resultado.advertencias.push(`Fila ${idx + 2}: IDPREDIO inválido ("TIERRA FISCAL"), se dejó vacío.`);
          idpredio = null;
        }
        let accion = IMPORTAR.normalizarTexto(f.accion_a_seguir);
        if (IMPORTAR.MAPEO_ACCION[accion]) accion = IMPORTAR.MAPEO_ACCION[accion];

        const reg = {
          hoja_de_ruta: f.hoja_de_ruta || null,
          fecha_ingreso: limpiarFecha(f.fecha_ingreso),
          gestion: f.gestion ? parseInt(f.gestion, 10) : (f.fecha_ingreso ? parseInt(f.fecha_ingreso.slice(0, 4), 10) : null),
          departamento: IMPORTAR.normalizarTexto(f.departamento) || null,
          provincia: IMPORTAR.normalizarTexto(f.provincia) || null,
          municipio: IMPORTAR.normalizarTexto(f.municipio) || null,
          nombre_predio: f.nombre_predio || f.predio || null,
          tipo_propiedad: tipoPropiedad || null,
          idpredio,
          codigo_expediente: f.codigo_expediente || null,
          clasificacion_caso: IMPORTAR.normalizarTexto(f.clasificacion_caso || f.clasificacion) || null,
          denunciante: f.denunciante || null,
          denunciados: f.denunciados || null,
          informe_atencion: f.informe_atencion || null,
          fecha_informe_atencion: limpiarFecha(f.fecha_informe_atencion),
          asociado_comunidad: f.asociado_comunidad ? IMPORTAR.normalizarTexto(f.asociado_comunidad) : null,
          nombre_comunidad: f.nombre_comunidad || null,
          corresponde_atender: ["SI","NO"].includes(IMPORTAR.normalizarTexto(f.corresponde_atender)) ? IMPORTAR.normalizarTexto(f.corresponde_atender) : "PENDIENTE",
          fundamento_determinacion: f.fundamento_determinacion || null,
          prioridad: mapearPrioridad(f.prioridad),
          informe_inspeccion: f.informe_inspeccion || null,
          fecha_informe: limpiarFecha(f.fecha_informe),
          gestion_inspeccion: f.gestion_inspeccion ? parseInt(f.gestion_inspeccion, 10) : (f.fecha_informe ? parseInt(f.fecha_informe.slice(0, 4), 10) : null),
          estado_inspeccion: IMPORTAR.normalizarTexto(f.estado_inspeccion) || "PENDIENTE",
          fecha_programada_inspeccion: limpiarFecha(f.fecha_programada_inspeccion),
          fecha_real_inspeccion: limpiarFecha(f.fecha_real_inspeccion),
          tecnico_responsable: f.tecnico_responsable || null,
          lugar_inspeccion: f.lugar_inspeccion || null,
          observaciones_programacion: f.observaciones_programacion || null,
          conclusion_informe_inspeccion: f.conclusion_informe_inspeccion || null,
          accion_a_seguir: accion || "SIN DEFINIR",
          observaciones_parte2: f.observaciones_parte2 || null,
          res_medidas_precautorias: f.res_medidas_precautorias || null,
          fecha_resolucion_medidas: limpiarFecha(f.fecha_resolucion_medidas),
          inf_medidas_precautorias: f.inf_medidas_precautorias || null,
          fecha_informe_medidas: limpiarFecha(f.fecha_informe_medidas),
          nota_remision_medidas: f.nota_remision_medidas || null,
          fecha_nota: limpiarFecha(f.fecha_nota),
          intimacion: f.intimacion || null,
          fecha_intimacion: limpiarFecha(f.fecha_intimacion),
          notificacion_intimacion: f.notificacion_intimacion || null,
          informe_verificacion_intimacion: f.informe_verificacion_intimacion || null,
          fecha_informe_verificacion: limpiarFecha(f.fecha_informe_verificacion),
          estado_verificacion: f.estado_verificacion || null,
          detalle_verificacion: f.detalle_verificacion || null,
          carta_comando: f.carta_comando || null,
          fecha_carta_comando: limpiarFecha(f.fecha_carta_comando),
          informe_acta_desalojo: f.informe_acta_desalojo || null,
          fecha_desalojo: limpiarFecha(f.fecha_desalojo),
          observaciones_parte3: f.observaciones_parte3 || null,
          estado_actual: f.estado_actual ? f.estado_actual.trim() : "REGISTRADO",
          estado_global: IMPORTAR.normalizarTexto(f.estado_global) || "PROCESO EN CURSO",
          creado_por: STATE.user ? STATE.user.id : null,
          actualizado_por: STATE.user ? STATE.user.id : null
        };

        if (f.id_inspec && f.id_inspec.trim()) {
          reg.id_inspec = f.id_inspec.trim();
        }

        registros.push(reg);
      } catch (e) {
        resultado.errores.push(`Fila ${idx + 2}: ${e.message}`);
      }
    });

    if (registros.length > 0) {
      const LOTE = 50;
      for (let i = 0; i < registros.length; i += LOTE) {
        const bloque = registros.slice(i, i + LOTE);
        const { data, error } = await supa.from("casos").upsert(bloque, { onConflict: "id_inspec", ignoreDuplicates: true }).select("id");
        if (error) {
          resultado.errores.push(`Error en lote ${Math.floor(i / LOTE) + 1} (filas ${i + 1}-${i + bloque.length}): ${error.message}`);
        } else {
          resultado.importados += (data ? data.length : 0);
        }
      }
    }
    return resultado;
  },

  async importarTerritorios(file) {
    const resultado = { procesados: 0, importados: 0, advertencias: [], errores: [] };
    const texto = await IMPORTAR.leerArchivoTexto(file);
    const { filas } = IMPORTAR.parseCSV(texto);
    const registros = [];
    filas.forEach((f, idx) => {
      resultado.procesados++;
      const dep = IMPORTAR.normalizarTexto(f.departamento);
      const prov = IMPORTAR.normalizarTexto(f.provincia);
      const mun = IMPORTAR.normalizarTexto(f.municipio);
      if (!dep || !prov || !mun) { resultado.advertencias.push(`Fila ${idx + 2}: datos incompletos, omitida.`); return; }
      registros.push({ departamento: dep, provincia: prov, municipio: mun });
    });
    if (registros.length > 0) {
      const { data, error } = await supa.from("unidades_territoriales").upsert(registros, { onConflict: "departamento,provincia,municipio", ignoreDuplicates: true }).select("id");
      if (error) resultado.errores.push(error.message);
      else resultado.importados = registros.length;
    }
    return resultado;
  },

  exportarCasosCSV(casos) {
    const columnas = [
      "nro","id_inspec","hoja_de_ruta","fecha_ingreso","gestion","departamento","provincia","municipio",
      "nombre_predio","tipo_propiedad","idpredio","codigo_expediente","clasificacion_caso",
      "denunciante","denunciados","informe_atencion","fecha_informe_atencion","asociado_comunidad","nombre_comunidad","corresponde_atender","fundamento_determinacion","prioridad",
      "informe_inspeccion","fecha_informe","gestion_inspeccion","estado_inspeccion","fecha_programada_inspeccion",
      "fecha_real_inspeccion","tecnico_responsable","conclusion_informe_inspeccion","accion_a_seguir",
      "res_medidas_precautorias","fecha_resolucion_medidas","intimacion","fecha_intimacion",
      "informe_verificacion_intimacion","estado_verificacion","carta_comando","fecha_carta_comando",
      "informe_acta_desalojo","fecha_desalojo","estado_global","estado_actual","registrado_en","actualizado_en"
    ];
    const escapar = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return /[;"\n]/.test(s) ? `"${s}"` : s;
    };
    const encabezado = columnas.join(";");
    const filas = casos.map(c => columnas.map(col => escapar(c[col])).join(";"));
    const csv = "\uFEFF" + [encabezado, ...filas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `casos_avasallamiento_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

const IMPORTACION_VIEW = {
  render() {
    const inputCasos = UTIL.qs("#input-csv");
    const btnCasos = UTIL.qs("#btn-importar-csv");
    inputCasos.onchange = () => btnCasos.disabled = !inputCasos.files.length;
    btnCasos.onclick = async () => {
      btnCasos.disabled = true;
      const r = await IMPORTAR.importarCasos(inputCasos.files[0]);
      const cont = UTIL.qs("#import-resultado");
      cont.classList.remove("hidden");
      cont.innerHTML = `Registros procesados: ${r.procesados}<br>Registros importados: ${r.importados}<br>
        Advertencias: ${r.advertencias.length}<br>${r.advertencias.map(a => `• ${a}`).join("<br>")}<br>
        Errores: ${r.errores.length}<br>${r.errores.map(a => `• ${a}`).join("<br>")}`;
      UTIL.toast(`Importación finalizada: ${r.importados}/${r.procesados} registros.`, r.errores.length ? "warning" : "success");
    };

    const inputTerr = UTIL.qs("#input-csv-territorios");
    const btnTerr = UTIL.qs("#btn-importar-territorios");
    inputTerr.onchange = () => btnTerr.disabled = !inputTerr.files.length;
    btnTerr.onclick = async () => {
      btnTerr.disabled = true;
      const r = await IMPORTAR.importarTerritorios(inputTerr.files[0]);
      const cont = UTIL.qs("#import-territorios-resultado");
      cont.classList.remove("hidden");
      cont.innerHTML = `Procesados: ${r.procesados} · Importados: ${r.importados} · Advertencias: ${r.advertencias.length} · Errores: ${r.errores.length}`;
      UTIL.toast("Catálogo territorial importado.", "success");
      await TERRITORIOS.cargar();
    };

    UTIL.qs("#btn-agregar-territorio").onclick = async () => {
      const dep = IMPORTAR.normalizarTexto(UTIL.qs("#terr-manual-dep").value);
      const prov = IMPORTAR.normalizarTexto(UTIL.qs("#terr-manual-prov").value);
      const mun = IMPORTAR.normalizarTexto(UTIL.qs("#terr-manual-mun").value);
      if (!dep || !prov || !mun) { UTIL.toast("Complete departamento, provincia y municipio.", "error"); return; }
      const { error } = await supa.from("unidades_territoriales").upsert(
        { departamento: dep, provincia: prov, municipio: mun },
        { onConflict: "departamento,provincia,municipio", ignoreDuplicates: true }
      );
      if (error) { UTIL.toast(UTIL.errorAmigable(error), "error"); return; }
      UTIL.toast(`Agregado: ${dep} / ${prov} / ${mun}`, "success");
      UTIL.qs("#terr-manual-dep").value = ""; UTIL.qs("#terr-manual-prov").value = ""; UTIL.qs("#terr-manual-mun").value = "";
      await TERRITORIOS.cargar();
    };

    UTIL.qs("#btn-exportar-csv").onclick = async () => {
      await CASOS.fetchTodos();
      IMPORTAR.exportarCasosCSV(STATE.casosCache);
    };
  }
};

/* ============================================================================
   ENRUTADOR
   ============================================================================ */
const ROUTER = {
  mostrarLogin() {
    UTIL.qs("#view-login").classList.remove("hidden");
    UTIL.qs("#app").classList.add("hidden");
  },

  async mostrarApp() {
    UTIL.qs("#view-login").classList.add("hidden");
    UTIL.qs("#app").classList.remove("hidden");
    const nameEl = UTIL.qs("#user-label-name");
    const roleEl = UTIL.qs("#user-label-role");
    if (nameEl) nameEl.textContent = (STATE.perfil && STATE.perfil.nombre_completo) || (STATE.user && STATE.user.email) || "Usuario";
    if (roleEl) roleEl.textContent = (STATE.perfil && STATE.perfil.rol) || "OPERADOR";
    const userLabelEl = UTIL.qs("#user-label");
    if (userLabelEl) userLabelEl.textContent = `${(STATE.perfil && STATE.perfil.nombre_completo) || ""} · ${(STATE.perfil && STATE.perfil.rol) || ""}`;

    UTIL.qs("#nav-solicitudes").classList.toggle("hidden", !AUTH.esAdmin());
    UTIL.qs("#nav-usuarios").classList.toggle("hidden", !AUTH.esAdmin());
    UTIL.qs("#nav-importacion").classList.toggle("hidden", !AUTH.esAdmin());
    UTIL.qs("#sidebar-admin-label").classList.toggle("hidden", !AUTH.esAdmin());
    await TERRITORIOS.cargar();
    ROUTER.ir("dashboard");
  },

  TITULOS: {
    dashboard: "Dashboard", listado: "Casos", seguimiento: "Seguimiento de Inspecciones",
    alertas: "Alertas y Pendientes", solicitudes: "Solicitudes de Cambio",
    usuarios: "Gestión de Usuarios", importacion: "Importación y Exportación"
  },

  async ir(vista) {
    UTIL.qsa(".view").forEach(v => v.classList.remove("active"));
    UTIL.qsa(".sidebar-nav a, .main-nav a").forEach(a => {
      const match = a.dataset.view === vista;
      a.classList.toggle("active", match);
    });
    const el = UTIL.qs("#view-" + vista);
    if (el) el.classList.add("active");
    window.location.hash = vista;
    UTIL.qs("#topheader-title").textContent = ROUTER.TITULOS[vista] || "Dashboard";
    UTIL.qs(".main-content").scrollTop = 0;

    if (vista === "dashboard") await DASHBOARD.render();
    else if (vista === "listado") await LISTADO.render();
    else if (vista === "seguimiento") await SEGUIMIENTO.render();
    else if (vista === "alertas") await ALERTAS_VIEW.render();
    else if (vista === "solicitudes") { if (!AUTH.esAdmin()) { UTIL.toast("Acceso restringido.", "error"); return ROUTER.ir("dashboard"); } await SOLICITUDES_VIEW.render(); }
    else if (vista === "usuarios") { if (!AUTH.esAdmin()) { UTIL.toast("Acceso restringido.", "error"); return ROUTER.ir("dashboard"); } await USUARIOS.render(); }
    else if (vista === "importacion") { if (!AUTH.esAdmin()) { UTIL.toast("Acceso restringido.", "error"); return ROUTER.ir("dashboard"); } IMPORTACION_VIEW.render(); }
  },

  async irAListadoConFiltro(filtro, label) {
    UTIL.qsa(".view").forEach(v => v.classList.remove("active"));
    UTIL.qs("#view-listado").classList.add("active");
    UTIL.qsa(".sidebar-nav a, .main-nav a").forEach(a => a.classList.toggle("active", a.dataset.view === "listado"));
    UTIL.qs("#topheader-title").textContent = "Casos";
    UTIL.qs(".main-content").scrollTop = 0;
    await LISTADO.render(filtro, label);
  },

  async irANuevoCaso() {
    UTIL.qsa(".view").forEach(v => v.classList.remove("active"));
    UTIL.qs("#view-formulario").classList.add("active");
    UTIL.qsa(".sidebar-nav a, .main-nav a").forEach(a => a.classList.remove("active"));
    UTIL.qs("#topheader-title").textContent = "Nuevo Caso";
    UTIL.qs(".main-content").scrollTop = 0;
    await FORM.render(null);
  },

  async irAEditar(casoId) {
    UTIL.qsa(".view").forEach(v => v.classList.remove("active"));
    UTIL.qs("#view-formulario").classList.add("active");
    UTIL.qsa(".sidebar-nav a, .main-nav a").forEach(a => a.classList.remove("active"));
    UTIL.qs("#topheader-title").textContent = "Editar Caso";
    UTIL.qs(".main-content").scrollTop = 0;
    await FORM.render(casoId);
  },

  async irADetalle(casoId) {
    UTIL.qsa(".view").forEach(v => v.classList.remove("active"));
    UTIL.qs("#view-detalle").classList.add("active");
    UTIL.qsa(".sidebar-nav a, .main-nav a").forEach(a => a.classList.remove("active"));
    UTIL.qs("#topheader-title").textContent = "Detalle del Caso";
    UTIL.qs(".main-content").scrollTop = 0;
    await DETALLE.render(casoId);
  }
};

/* ============================================================================
   ARRANQUE
   ============================================================================ */
document.addEventListener("DOMContentLoaded", () => {
  UTIL.qs("#form-login").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const email = UTIL.qs("#login-email").value.trim();
    const password = UTIL.qs("#login-password").value;
    const errEl = UTIL.qs("#login-error");
    errEl.textContent = "";
    try {
      await AUTH.login(email, password);
    } catch (e) {
      errEl.textContent = "Credenciales inválidas o error de conexión.";
    }
  });

  UTIL.qs("#btn-logout").addEventListener("click", () => AUTH.logout());

  UTIL.qsa(".sidebar-nav a, .main-nav a").forEach(a => {
    a.addEventListener("click", (ev) => { ev.preventDefault(); ROUTER.ir(a.dataset.view); });
  });

  UTIL.qs("#modal-overlay").addEventListener("click", (ev) => { if (ev.target.id === "modal-overlay") MODAL.cerrar(); });

  // Toggle visibilidad de contraseña (Ref: code.html)
  const toggleBtn = document.getElementById("togglePasswordBtn");
  const passwordInput = document.getElementById("login-password");
  const eyeIcon = document.getElementById("eyeIcon");
  if (toggleBtn && passwordInput && eyeIcon) {
    toggleBtn.addEventListener("click", () => {
      const isPassword = passwordInput.getAttribute("type") === "password";
      passwordInput.setAttribute("type", isPassword ? "text" : "password");
      eyeIcon.textContent = isPassword ? "visibility_off" : "visibility";
    });
  }

  // Reloj institucional hora Bolivia (Ref: code.html)
  function updateBoliviaClock() {
    const clockEl = document.getElementById("loginClock");
    if (!clockEl) return;
    const now = new Date();
    try {
      const timeString = new Intl.DateTimeFormat("es-BO", {
        timeZone: "America/La_Paz",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
      }).format(now);
      clockEl.textContent = `${timeString} BOT`;
    } catch (e) {
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      clockEl.textContent = `${h}:${m}:${s} BOT`;
    }
  }
  updateBoliviaClock();
  setInterval(updateBoliviaClock, 1000);

  AUTH.init();
});
