/**
 * Lógica Principal de la Aplicación (UI & Estado) - Versión NEXI Cloud Optimizada
 */

let insumos = [];
let modulos = { pan: [], relleno: [], betun: [] };
let Recetas = {};
let currentModule = 'pan';
let config = { 
    nombrePasteleria: "NEXI Bake", 
    moneda: "$", 
    porcentajeIndirectos: 0, 
    porcentajeMerma: 0, 
    urlNube: "", 
    correoUser: "", 
    tokenUser: "",
    isPremium: false
};

let syncQueue = Promise.resolve();

function ordenarInsumosAlfabeticamente() {
    insumos.sort((a, b) => {
        return (a.nombre || "").localeCompare(b.nombre || "", 'es', { sensitivity: 'base' });
    });
}

function redondearPrecioComercial(valor) {
    return Math.ceil(valor / 5) * 5; 
}

function cambiarBannerStatus(texto, exito) {
    const banner = document.getElementById('cloud-banner');
    if (!banner) return;
    banner.innerHTML = texto;
    
    if (exito === true) {
        banner.style.backgroundColor = "rgba(16, 185, 129, 0.1)"; 
        banner.style.color = "#10b981";
        banner.style.borderColor = "rgba(16, 185, 129, 0.2)";
    } else if (exito === false) {
        banner.style.backgroundColor = "rgba(239, 68, 68, 0.1)"; 
        banner.style.color = "#ef4444";
        banner.style.borderColor = "rgba(239, 68, 68, 0.2)";
    } else {
        banner.style.backgroundColor = "var(--bg-card)";
        banner.style.color = "var(--text-main)";
        banner.style.borderColor = "var(--border-card)";
    }
}

function evaluarEstadoVisualPremium() {
    const banner = document.getElementById('cloud-banner');
    const bloquePremium = document.getElementById('seccion-bloque-premium');
    const bloqueEstandar = document.getElementById('seccion-bloque-estandar');
    const txtBienvenida = document.getElementById('txt-bienvenida-premium');

    if (config.isPremium) {
        if(banner) {
            banner.style.backgroundColor = "rgba(16, 185, 129, 0.1)"; 
            banner.style.color = "#10b981";
            banner.style.borderColor = "rgba(16, 185, 129, 0.2)";
            banner.innerHTML = `☁️ Conectado: <strong>${config.correoUser}</strong> (NEXI Cloud)`;
        }
        if(txtBienvenida) txtBienvenida.innerHTML = `✓ Conectado exitosamente como: <strong>${config.correoUser}</strong>`;
        if(bloquePremium) bloquePremium.classList.remove('hidden');
        if(bloqueEstandar) bloqueEstandar.classList.add('hidden');
    } else {
        if(banner) {
            banner.style.backgroundColor = "var(--bg-card)";
            banner.style.color = "var(--text-main)";
            banner.style.borderColor = "var(--border-card)";
            banner.innerHTML = `☁️ Modo Local (Sin sincronizar)`;
        }
        if(bloquePremium) bloquePremium.classList.add('hidden');
        if(bloqueEstandar) bloqueEstandar.classList.remove('hidden');
    }
}

function togglePanelConfiguracion() {
    const cuerpo = document.getElementById('cuerpo-configuracion');
    const flecha = document.getElementById('btn-flecha-config');
    if (!cuerpo) return;
    if (cuerpo.style.display === 'none' || cuerpo.style.display === '') {
        cuerpo.style.display = 'block';
        if(flecha) flecha.style.transform = 'rotate(180deg)';
    } else {
        cuerpo.style.display = 'none';
        if(flecha) flecha.style.transform = 'rotate(0deg)';
    }
}

function cargarConfiguracion() {
    const local = localStorage.getItem('respaldo_config_pasteleria');
    if(local) {
        try { config = JSON.parse(local); } catch(e) { }
    }
    
    const inputUrl = document.getElementById('cfg-url-servidor');
    if (inputUrl && config.urlNube) {
        inputUrl.value = config.urlNube;
    } else if(inputUrl && !config.urlNube) {
        config.urlNube = inputUrl.value.trim();
    }

    document.getElementById('cfg-nombre').value = config.nombrePasteleria || "NEXI Bake";
    document.getElementById('cfg-moneda').value = config.moneda || "$";
    document.getElementById('cfg-indirectos').value = config.porcentajeIndirectos || 0;
    document.getElementById('cfg-merma').value = config.porcentajeMerma || 0;
    document.getElementById('cfg-correo-user').value = config.correoUser || "";
    document.getElementById('cfg-token-user').value = config.tokenUser || "";

    document.getElementById('lbl-nombre-pasteleria').textContent = config.nombrePasteleria || "NEXI Bake";
    document.getElementById('lbl-indirectos-porcentaje').textContent = `Gastos Indirectos (${config.porcentajeIndirectos || 0}%):`;
}

let isSavingConfig = false;

async function guardarConfiguracion() {
    if (isSavingConfig) return;

    const nuevoNombre = document.getElementById('cfg-nombre').value.trim() || "NEXI Bake";
    const nuevaMoneda = document.getElementById('cfg-moneda').value.trim() || "$";
    const nuevosIndirectos = parseFloat(document.getElementById('cfg-indirectos').value) || 0;
    const nuevaMerma = parseFloat(document.getElementById('cfg-merma').value) || 0;
    const urlNubeInput = document.getElementById('cfg-url-servidor').value.trim();
    const correoInput = document.getElementById('cfg-correo-user').value.trim().toLowerCase();
    const tokenInput = document.getElementById('cfg-token-user').value.trim();

    const esPrimerLogueo = (!config.isPremium && tokenInput && urlNubeInput) || 
                           (config.correoUser !== correoInput || config.tokenUser !== tokenInput);

    config.nombrePasteleria = nuevoNombre;
    config.moneda = nuevaMoneda;
    config.porcentajeIndirectos = nuevosIndirectos;
    config.porcentajeMerma = nuevaMerma;
    config.urlNube = urlNubeInput;
    config.correoUser = correoInput;
    config.tokenUser = tokenInput;

    document.getElementById('lbl-nombre-pasteleria').textContent = config.nombrePasteleria;
    document.getElementById('lbl-indirectos-porcentaje').textContent = `Gastos Indirectos (${config.porcentajeIndirectos}%):`;
    
    if (config.tokenUser && config.urlNube) {
        isSavingConfig = true; 
        config.isPremium = true;
        localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));
        
        evaluarEstadoVisualPremium();
        calcularTodo();

        Swal.fire({
            title: 'Sincronizando con NEXI Cloud...',
            text: 'Por favor, espera un momento mientras procesamos los cambios.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        cambiarBannerStatus("⏳ Sincronizando datos del negocio...", null);
        
        try {
            const insumosLocalesRaw = localStorage.getItem('respaldo_insumos');
            const recetasLocalesRaw = localStorage.getItem('respaldo_recetas');
            let insumosLocales = insumosLocalesRaw ? JSON.parse(insumosLocalesRaw) : [];
            let recetasLocales = recetasLocalesRaw ? JSON.parse(recetasLocalesRaw) : {};

            let datosFinalesInsumos = [...insumosLocales];
            let datosFinalesRecetas = { ...recetasLocales };
            let ejecutarMigracionLote = false;

            if (esPrimerLogueo) {
                const consultaNube = await apiFetch(config.urlNube, {
                    correo: config.correoUser,
                    token: config.tokenUser,
                    accion: "obtenerConfiguracion"
                });

                if (consultaNube && consultaNube.status !== "error") {
                    let insumosNube = consultaNube.insumos || [];
                    let recetasNube = consultaNube.plantillas || {};
                    Object.keys(recetasNube).forEach(key => {
                        if (typeof recetasNube[key] === 'string') {
                            try { recetasNube[key] = JSON.parse(recetasNube[key]); } catch(e){ }
                        }
                    });

                    if (consultaNube.nombrePasteleria) config.nombrePasteleria = consultaNube.nombrePasteleria;
                    if (consultaNube.moneda) config.moneda = consultaNube.moneda;
                    if (consultaNube.porcentajeIndirectos !== undefined) config.porcentajeIndirectos = consultaNube.porcentajeIndirectos;
                    if (consultaNube.porcentajeMerma !== undefined) config.porcentajeMerma = consultaNube.porcentajeMerma;
                    localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));

                    if (insumosLocales.length > 0 && insumosNube.length > 0) {
                        Swal.close(); 
                        const resultadoFusion = await Swal.fire({
                            title: '⚡ Datos Duplicados Detectados',
                            text: 'Detectamos recetas o insumos tanto locales como en NEXI Cloud. ¿Deseas unirlos?',
                            icon: 'question',
                            showCancelButton: true,
                            confirmButtonColor: '#3b82f6',
                            cancelButtonColor: '#64748b',
                            confirmButtonText: 'Sí, fusionar datos'
                        });
                        
                        if (resultadoFusion.isConfirmed) {
                            datosFinalesInsumos = fusionarListasInsumos(insumosLocales, insumosNube);
                            datosFinalesRecetas = { ...recetasNube, ...recetasLocales };
                            ejecutarMigracionLote = true; 
                        } else {
                            datosFinalesInsumos = insumosNube;
                            datosFinalesRecetas = recetasNube;
                            ejecutarMigracionLote = false;
                        }
                    } else {
                        datosFinalesInsumos = insumosNube.length > 0 ? insumosNube : insumosLocales;
                        datosFinalesRecetas = Object.keys(recetasNube).length > 0 ? recetasNube : recetasLocales;
                        ejecutarMigracionLote = insumosLocales.length > 0 || Object.keys(recetasLocales).length > 0;
                    }
                } else if (consultaNube && consultaNube.status === "error") {
                    throw new Error(consultaNube.message);
                }
            }

            let datosAInyectar = {
                ejecutarMigracion: ejecutarMigracionLote,
                insumos: datosFinalesInsumos,
                plantillas: datosFinalesRecetas
            };

            const respuestaServidor = await apiFetch(config.urlNube, {
                correo: config.correoUser,
                token: config.tokenUser,
                accion: "guardarConfiguracion",
                nombrePasteleria: config.nombrePasteleria,
                moneda: config.moneda, 
                porcentajeIndirectos: config.porcentajeIndirectos,
                porcentajeMerma: config.porcentajeMerma,
                migracion: datosAInyectar
            });
            
            if(respuestaServidor.status === "success") {
                insumos = datosFinalesInsumos;
                Recetas = datosFinalesRecetas;

                ordenarInsumosAlfabeticamente();
                localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
                localStorage.setItem('respaldo_recetas', JSON.stringify(Recetas));
                localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));
                
                document.getElementById('cfg-nombre').value = config.nombrePasteleria;
                document.getElementById('cfg-moneda').value = config.moneda;
                document.getElementById('cfg-indirectos').value = config.porcentajeIndirectos;
                document.getElementById('cfg-merma').value = config.porcentajeMerma;
                document.getElementById('lbl-nombre-pasteleria').textContent = config.nombrePasteleria;

                evaluarEstadoVisualPremium();
                renderInsumos();
                renderModulos();
                rebuildSelect();
                calcularTodo();

                Swal.fire({ title: '¡Sincronizado! ☁️', text: 'Sesión activa y recetas descargadas.', icon: 'success', confirmButtonColor: '#3b82f6' });
            } else {
                Swal.fire({ title: 'Atención ⚠️', text: `La nube rechazó la actualización: ${respuestaServidor.message}`, icon: 'warning', confirmButtonColor: '#3b82f6' });
            }
        } catch(e) { 
            console.error(e);
            cambiarBannerStatus("⚠️ Error al sincronizar configuración remota", false);
            Swal.fire({ title: 'Aviso', text: 'Error de acceso o conexión: ' + e.message, icon: 'info', confirmButtonColor: '#3b82f6' });
        } finally {
            isSavingConfig = false;
        }
        
    } else {
        config.isPremium = false;
        config.correoUser = "";
        config.tokenUser = "";
        
        localStorage.removeItem('respaldo_insumos');
        localStorage.removeItem('respaldo_recetas');
        localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));
        
        insumos = [];
        Recetas = {};
        modulos = { pan: [], relleno: [], betun: [] };
        
        evaluarEstadoVisualPremium();
        renderInsumos();
        renderModulos();
        rebuildSelect();
        calcularTodo();

        Swal.fire({ title: 'Modo Local Vacío', text: 'Se ha salido del entorno premium. Los datos locales han sido limpiados.', icon: 'info', confirmButtonColor: '#3b82f6' });
        isSavingConfig = false; 
    }
}

function fusionarListasInsumos(locales, nube) {
    let unificados = JSON.parse(JSON.stringify(nube));

    locales.forEach(local => {
        const existe = unificados.find(n => 
            String(n.nombre || '').toLowerCase().trim() === String(local.nombre || '').toLowerCase().trim() &&
            String(n.marca || '').toLowerCase().trim() === String(local.marca || '').toLowerCase().trim()
        );

        if (!existe) {
            unificados.push(local);
        } else {
            existe.precio = local.precio;
            existe.cantidad = local.cantidad;
            existe.unidad = local.unidad;
            existe.tamano = local.tamano;
        }
    });

    return unificados;
}

async function cerrarSesionNexi() {
    const resultadoCierre = await Swal.fire({
        title: '🚨 ¡CERRAR SESIÓN!',
        html: 'Al salir, se eliminarán todas las recetas e insumos de la pantalla de este dispositivo por seguridad.<br><br><strong>¿Estás seguro de que deseas desconectarte?</strong>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e57373', 
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, borrar y salir',
        cancelButtonText: 'Cancelar'
    });

    if (!resultadoCierre.isConfirmed) return;

    config = { 
        nombrePasteleria: "NEXI Bake", 
        moneda: "$", 
        porcentajeIndirectos: 0, 
        porcentajeMerma: 0, 
        urlNube: config.urlNube, 
        correoUser: "", 
        tokenUser: "",
        isPremium: false
    };
    
    localStorage.removeItem('respaldo_config_pasteleria');
    localStorage.removeItem('respaldo_insumos');
    localStorage.removeItem('respaldo_recetas');

    insumos = [];
    modulos = { pan: [], relleno: [], betun: [] };
    Recetas = {};

    setTimeout(() => {
        window.location.reload();
    }, 100);
}

function renderInsumos() {
    const tbody = document.getElementById('tabla-insumos');
    if(!tbody) return;
    tbody.innerHTML = '';
    const m = config.moneda || "$";

    const inputBuscar = document.getElementById('buscador-inventario');
    const textoBusqueda = inputBuscar ? inputBuscar.value.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';

    const insumosFiltrados = insumos.filter(insumo => {
        const nombre = insumo.nombre ? String(insumo.nombre).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        const marca = insumo.marca ? String(insumo.marca).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        return nombre.includes(textoBusqueda) || marca.includes(textoBusqueda); 
    });

    insumosFiltrados.forEach(insumo => {
        const cantidadVal = parseFloat(insumo.cantidad) || 1;
        const precioVal = parseFloat(insumo.precio) || 0;
        const unidadStr = insumo.unidad || 'g';
        const costoUnidad = precioVal / cantidadVal;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${insumo.nombre}</strong></td>
            <td><input type="text" class="table-input" style="width:75px;" value="${insumo.marca||''}" onchange="actualizarDatoInsumo('${insumo.id}', 'marca', this.value)"></td>
            <td><input type="text" class="table-input" style="width:80px;" value="${insumo.tamano || 'N/A'}" onchange="actualizarDatoInsumo('${insumo.id}', 'tamano', this.value)"></td>
            <td>
                <div style="display:flex; align-items:center; gap:2px;">
                    <input type="number" class="table-input" value="${cantidadVal}" style="width:50px;" step="any" min="0.01" required onchange="actualizarDatoInsumo('${insumo.id}', 'cantidad', this.value, this)">
                    <span style="font-size:11px; color:var(--instruction-text); font-weight:600;">${insumo.unidad}</span>
                </div>
            </td>
            <td><input type="number" class="table-input" value="${precioVal}" style="width:65px;" step="any" min="0.01" required onchange="actualizarDatoInsumo('${insumo.id}', 'precio', this.value, this)"></td>
            <td>${m}${costoUnidad.toFixed(2)}/${unidadStr}</td>
            <td class="text-right"><button type="button" class="btn btn-danger btn-small" onclick="eliminarInsumo('${insumo.id}')">×</button></td>
        `;
        tbody.appendChild(tr);
    });
    actualizarSelectReceta();
}

function agregarInsumoManejador() {
    if (config.isPremium && config.urlNube) {
        agregarNuevoInsumoNube();
    } else {
        agregarInsumoLocal();
    }
}

function agregarInsumoLocal() {
    const nombre = document.getElementById('insumo-nombre').value.trim();
    const marca = document.getElementById('insumo-marca').value.trim();
    const tamano = document.getElementById('insumo-tamano').value.trim();
    const cantidad = parseFloat(document.getElementById('insumo-cantidad').value);
    const unidad = document.getElementById('insumo-unidad').value;
    const precio = parseFloat(document.getElementById('insumo-precio').value);

    if (!nombre) { 
        Swal.fire({ title: 'Campo requerido', text: 'El nombre del ingrediente es obligatorio.', icon: 'error', confirmButtonColor: '#3b82f6' });
        return; 
    }
    if (isNaN(cantidad) || cantidad <= 0) { 
        Swal.fire({ title: 'Cantidad no válida', text: 'La cantidad del paquete debe ser un número mayor a 0.', icon: 'error', confirmButtonColor: '#3b82f6' });
        return; 
    }
    if (isNaN(precio) || precio < 0) { 
        Swal.fire({ title: 'Precio no válido', text: 'El precio no puede ser un número negativo o vacío.', icon: 'error', confirmButtonColor: '#3b82f6' });
        return; 
    }

    const nuevoInsumo = {
        id: 'id_' + Date.now(),
        nombre: nombre,
        marca: marca,
        tamano: tamano,
        cantidad: cantidad,
        unidad: unidad,
        precio: precio
    };

    insumos.push(nuevoInsumo);
    ordenarInsumosAlfabeticamente(); 
    localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
    document.getElementById('form-insumo').reset();
    renderInsumos();
    calcularTodo();
    Swal.fire({ title: '¡Añadido!', text: 'Insumo guardado localmente.', icon: 'success', confirmButtonColor: '#3b82f6' });
    
    if (typeof gtag === 'function') gtag('event', 'insumo_creado', { 'alojamiento': 'Local' });
}

let isSavingInsumo = false; 

async function agregarNuevoInsumoNube() {
    if (isSavingInsumo) return;

    const nombreInsumo = document.getElementById('insumo-nombre').value.trim();
    const marcaInsumo = document.getElementById('insumo-marca').value.trim();
    const tamanoInsumo = document.getElementById('insumo-tamano').value.trim();
    const cantidadInsumo = parseFloat(document.getElementById('insumo-cantidad').value);
    const unidadInsumo = document.getElementById('insumo-unidad').value;
    const precioInsumo = parseFloat(document.getElementById('insumo-precio').value);

    if (!nombreInsumo) { 
        Swal.fire({ title: 'Campo requerido', text: 'El nombre del ingrediente es obligatorio.', icon: 'error', confirmButtonColor: '#3b82f6' });
        return; 
    }
    if (isNaN(cantidadInsumo) || cantidadInsumo <= 0) { 
        Swal.fire({ title: 'Cantidad no válida', text: 'La cantidad del paquete debe ser un número mayor a 0.', icon: 'error', confirmButtonColor: '#3b82f6' });
        return; 
    }
    if (isNaN(precioInsumo) || precioInsumo < 0) { 
        Swal.fire({ title: 'Precio no válido', text: 'El precio no puede ser un número negativo o vacío.', icon: 'error', confirmButtonColor: '#3b82f6' });
        return; 
    }

    isSavingInsumo = true;
    const idInsumo = Date.now().toString();
    cambiarBannerStatus("⏳ Sincronizando insumo...", true);

    Swal.fire({
        title: 'Guardando ingrediente...',
        text: 'Subiendo datos a NEXI Cloud.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const resultado = await apiFetch(config.urlNube, {
            correo: config.correoUser,
            token: config.tokenUser,
            accion: "guardarInsumo",
            id: idInsumo,
            nombre: nombreInsumo,
            marca: marcaInsumo,
            tamano: tamanoInsumo, 
            cantidad: cantidadInsumo,
            unidad: unidadInsumo,
            precio: precioInsumo
        });
        
        if (resultado.status === "success") {
            const nuevoInsumoLocal = {
                id: idInsumo,
                nombre: nombreInsumo,
                marca: marcaInsumo,
                tamano: tamanoInsumo,
                cantidad: cantidadInsumo,
                unidad: unidadInsumo,
                precio: precioInsumo
            };

            insumos.push(nuevoInsumoLocal);
            if (typeof gtag === 'function') gtag('event', 'insumo_creado', { 'alojamiento': 'NEXI_Cloud' });
            ordenarInsumosAlfabeticamente(); 
            
            localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
            document.getElementById('form-insumo').reset();
            renderInsumos();
            calcularTodo();
            evaluarEstadoVisualPremium();
            
            Swal.fire({ title: '¡Sincronizado!', text: 'Insumo guardado y alojado en NEXI Cloud.', icon: 'success', confirmButtonColor: '#3b82f6' });
        } else {
            Swal.fire({ title: 'Error de servidor', text: resultado.message, icon: 'error', confirmButtonColor: '#3b82f6' });
            cambiarBannerStatus("❌ Error: " + resultado.message, false);
        }
    } catch(e) {
        Swal.fire({ title: 'Fallo de Red', text: 'Error de conexión. El insumo no se guardó de forma remota.', icon: 'error', confirmButtonColor: '#3b82f6' });
        cambiarBannerStatus("❌ Error de conexión remota", false);
    } finally {
        isSavingInsumo = false;
    }
}

function actualizarDatoInsumo(id, campo, valor, inputElement = null) {
    const insumo = insumos.find(i => String(i.id) === String(id));
    if (!insumo) return;

    if (campo === 'precio' || campo === 'cantidad') { 
        let valorLimpio = String(valor).replace(/,/g, '.').replace(/[^0-9.]/g, '');
        const valorNumerico = parseFloat(valorLimpio);
        
        if (isNaN(valorNumerico) || valorNumerico <= 0) {
            if (inputElement) inputElement.value = insumo[campo];
            return; 
        }
        insumo[campo] = valorNumerico; 
    } else { 
        insumo[campo] = valor.trim(); 
        if (campo === 'nombre') {
            ordenarInsumosAlfabeticamente();
        }
    }

    localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
    renderModulos();
    calcularTodo();
    
    if(config.isPremium && config.urlNube) {
        syncQueue = syncQueue.then(async () => {
            try {
                const data = await apiFetch(config.urlNube, {
                    correo: config.correoUser, token: config.tokenUser, accion: "guardarInsumo",
                    id: insumo.id, nombre: insumo.nombre, marca: insumo.marca, tamano: insumo.tamano,
                    cantidad: insumo.cantidad, unidad: insumo.unidad, precio: insumo.precio
                });
                if(data.status !== "success") console.error("Error en sincronización deferred:", data.message);
            } catch(err) {
                console.error("Fallo crítico de red en background:", err);
                cambiarBannerStatus("⚠️ Cambios guardados localmente (Pendiente sincronizar)", false);
            }
        });
    }
}

async function eliminarInsumo(id) {
    const insumoEncontrado = insumos.find(i => String(i.id) === String(id));
    const nombreInsumo = insumoEncontrado ? insumoEncontrado.nombre : "este insumo";

    const confirmacion = await Swal.fire({
        title: '¿Eliminar insumo?',
        text: `¿Seguro que deseas borrar "${nombreInsumo}" de tu inventario?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e57373',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    if (config.isPremium && config.urlNube) {
        cambiarBannerStatus("⏳ Eliminando insumo de la nube...", true);

        Swal.fire({
            title: 'Eliminando ingrediente...',
            text: 'Removiendo datos de NEXI Cloud. Por favor espera.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            const resultado = await apiFetch(config.urlNube, {
                correo: config.correoUser,
                token: config.tokenUser,
                accion: "eliminarInsumo",
                id: id
            });
            if (resultado.status !== "success") {
                Swal.fire({ title: 'Error', text: 'Error en la nube: ' + resultado.message, icon: 'error', confirmButtonColor: '#3b82f6' });
                cambiarBannerStatus("❌ Error al eliminar en nube", false);
                return;
            }
        } catch(e) {
            Swal.fire({ title: 'Error de Red', text: 'No se pudo conectar para eliminar el insumo de la nube.', icon: 'error', confirmButtonColor: '#3b82f6' });
            cambiarBannerStatus("❌ Error de conexión remota", false);
            return;
        }
    }

    insumos = insumos.filter(i => String(i.id) !== String(id));
    for(let key in modulos) { modulos[key] = modulos[key].filter(r => String(r.insumoId) !== String(id)); }
    localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
    renderInsumos();
    renderModulos();
    calcularTodo();
    evaluarEstadoVisualPremium();

    Swal.fire({ title: 'Eliminado', text: 'El insumo ha sido eliminado correctamente.', icon: 'success', confirmButtonColor: '#3b82f6' });
}

function actualizarSelectReceta() {
    const select = document.getElementById('receta-insumo-select');
    if(!select) return;
    select.innerHTML = '<option value="" disabled selected>🔹 Seleccione un insumo...</option>';
    insumos.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.id;
        opt.textContent = `${i.nombre} (${i.marca || 'S/M'})`;
        select.appendChild(opt);
    });
}

function filtrarInsumosReceta(texto) {
    const t = texto.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const select = document.getElementById('receta-insumo-select');
    select.innerHTML = '<option value="" disabled selected>🔹 Seleccione un insumo...</option>';
    
    const filtrados = insumos.filter(i => {
        const nombreInsumo = (i.nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const marcaInsumo = (i.marca || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nombreInsumo.includes(t) || marcaInsumo.includes(t);
    });
    
    if(filtrados.length === 0 && t === "") {
        actualizarSelectReceta();
        return;
    }
    
    filtrados.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.id; 
        opt.textContent = `${i.nombre} (${i.marca || 'S/M'})`; 
        select.appendChild(opt);
    });

    if (filtrados.length > 0) {
        select.selectedIndex = 1; 
        actualizarLabelUnidadReceta();
    }
}

function actualizarLabelUnidadReceta() {
    const id = document.getElementById('receta-insumo-select').value;
    const insumo = insumos.find(i => String(i.id) === String(id));
    const selectUnidad = document.getElementById('receta-unidad');
    
    if(insumo && selectUnidad) { 
        selectUnidad.innerHTML = ''; 
        if(insumo.unidad === 'kg' || insumo.unidad === 'g') {
            selectUnidad.innerHTML = '<option value="g">g</option><option value="kg">kg</option>';
            selectUnidad.value = "g";
        } else if(insumo.unidad === 'L' || insumo.unidad === 'ml') {
            selectUnidad.innerHTML = '<option value="ml">ml</option><option value="L">L</option>';
            selectUnidad.value = "ml";
        } else {
            selectUnidad.innerHTML = `<option value="${insumo.unidad}">${insumo.unidad}</option>`;
            selectUnidad.value = insumo.unidad;
        }
    }
}

function agregarIngredienteRecetaManejador() {
    const id = document.getElementById('receta-insumo-select').value;
    const cant = parseFloat(document.getElementById('receta-cantidad').value);
    const uni = document.getElementById('receta-unidad').value;
    if(!id || !cant) return;

    modulos[currentModule].push({ insumoId: id, cantidadUsada: cant, unidadUsada: uni });
    
    // CORRECCIÓN 1: Limpia el buscador e inmediatamente regenera el select completo
    document.getElementById('buscador-receta').value = "";
    document.getElementById('form-receta').reset();
    actualizarSelectReceta();
    
    renderModulos();
    calcularTodo();
}

function renderModulos() {
    const m = config.moneda || "$";
    const factorMerma = 1 + ((config.porcentajeMerma || 0) / 100);

    ['pan', 'relleno', 'betun'].forEach(key => {
        const tbody = document.getElementById(`tabla-${key}`);
        if(!tbody) return;
        tbody.innerHTML = '';
        modulos[key].forEach((item, index) => {
            if (item.esPlantilla) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>📋 [Receta] ${item.nombrePlantilla}</strong></td>
                    <td>1 Unidad</td>
                    <td>${m}${item.costoFijo.toFixed(2)}</td>
                    <td><button type="button" class="btn btn-danger btn-small" onclick="eliminarDeModulo('${key}', ${index})">×</button></td>
                `;
                tbody.appendChild(tr);
            } 
            else {
                const insumo = insumos.find(i => String(i.id) === String(item.insumoId));
                const tr = document.createElement('tr');
                if(!insumo) {
                    tr.innerHTML = `<td>⚠️ Insumo Eliminado</td><td>${item.cantidadUsada}</td><td>${m}0.00</td><td><button type="button" class="btn btn-danger btn-small" onclick="eliminarDeModulo('${key}', ${index})">×</button></td>`;
                } else {
                    let cantPaquete = insumo.cantidad;
                    if(insumo.unidad === 'kg' && item.unidadUsada === 'g') cantPaquete *= 1000;
                    if(insumo.unidad === 'g' && item.unidadUsada === 'kg') cantPaquete /= 1000;
                    if(insumo.unidad === 'L' && item.unidadUsada === 'ml') cantPaquete *= 1000;
                    if(insumo.unidad === 'ml' && item.unidadUsada === 'L') cantPaquete /= 1000;
                    
                    const costoBase = (insumo.precio / cantPaquete) * item.cantidadUsada;
                    const costoConMerma = costoBase * factorMerma;

                    tr.innerHTML = `<td>${insumo.nombre}</td><td>${item.cantidadUsada} ${item.unidadUsada}</td><td>${m}${costoConMerma.toFixed(2)}</td><td><button type="button" class="btn btn-danger btn-small" onclick="eliminarDeModulo('${key}', ${index})">×</button></td>`;
                }
                tbody.appendChild(tr);
            }
        });
    });
}

function eliminarDeModulo(moduloKey, index) {
    modulos[moduloKey].splice(index, 1);
    renderModulos();
    calcularTodo();
}

function calcularCostoModulo(key) {
    let total = 0;
    const factorMerma = 1 + ((config.porcentajeMerma || 0) / 100);

    modulos[key].forEach(item => {
        if (item.esPlantilla) {
            total += item.costoFijo;
        } 
        else {
            const insumo = insumos.find(i => String(i.id) === String(item.insumoId));
            if (insumo) {
                let cantPaquete = insumo.cantidad;
                if(insumo.unidad === 'kg' && item.unidadUsada === 'g') cantPaquete *= 1000;
                if(insumo.unidad === 'g' && item.unidadUsada === 'kg') cantPaquete /= 1000;
                if(insumo.unidad === 'L' && item.unidadUsada === 'ml') cantPaquete *= 1000;
                if(insumo.unidad === 'ml' && item.unidadUsada === 'L') cantPaquete /= 1000;
                
                total += ((insumo.precio / cantPaquete) * item.cantidadUsada) * factorMerma;
            }
        }
    });
    return total;
}

function calcularTodo() {
    const costoPan = calcularCostoModulo('pan'); 
    const costoRelleno = calcularCostoModulo('relleno'); 
    const costoBetun = calcularCostoModulo('betun');
    const subtotalInsumos = costoPan + costoRelleno + costoBetun; 
    
    const porcentajeId = (config.porcentajeIndirectos !== undefined ? config.porcentajeIndirectos : 0) / 100;
    const indirectos = subtotalInsumos * porcentajeId; 
    const costoAlimentoTotal = subtotalInsumos + indirectos;

    const horasMOInput = document.getElementById('mo-horas').value;
    const horasMO = parseFloat(String(horasMOInput).replace(',', '.')) || 0;

    const precioHoraMO = parseFloat(document.getElementById('mo-precio-hora').value) || 0;
    const totalManoObra = horasMO * precioHoraMO;

    const totalProduc = costoAlimentoTotal + totalManoObra;
    const m = config.moneda || "$";
    
    document.getElementById('txt-costo-pan').textContent = `${m}${costoPan.toFixed(2)}`; 
    document.getElementById('txt-costo-relleno').textContent = `${m}${costoRelleno.toFixed(2)}`; 
    document.getElementById('txt-costo-betun').textContent = `${m}${costoBetun.toFixed(2)}`; 
    document.getElementById('txt-costo-indirectos').textContent = `${m}${indirectos.toFixed(2)}`; 
    document.getElementById('txt-costo-manodeobra').textContent = `${m}${totalManoObra.toFixed(2)}`; 
    document.getElementById('costo-produccion-total').textContent = `${m}${totalProduc.toFixed(2)}`;
    
    const inputPorciones = parseFloat(document.getElementById('porciones-totales').value) || 0; 
    const multiplicador = parseFloat(document.getElementById('margen-ganancia').value) || 3;
    
    let basePrecioVenta = (costoAlimentoTotal * multiplicador) + totalManoObra;
    let baseCostoPorcion = inputPorciones > 0 ? (totalProduc / inputPorciones) : 0;
    let basePrecioPorcion = inputPorciones > 0 ? (basePrecioVenta / inputPorciones) : 0;

    document.getElementById('res-costo-porcion').textContent = `${m}${baseCostoPorcion.toFixed(2)}`; 
    document.getElementById('res-precio-venta').textContent = `${m}${redondearPrecioComercial(basePrecioVenta)}`; 
    document.getElementById('res-precio-porcion').textContent = `${m}${redondearPrecioComercial(basePrecioPorcion)}`;
}

function switchTab(e, moduloId) {
    currentModule = moduloId;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    e.currentTarget.classList.add('active');
    document.getElementById(`tab-${moduloId}`).classList.add('active');
}

function rebuildSelect() {
    const select = document.getElementById('select-plantillas'); 
    if(!select) return;
    select.innerHTML = '<option value="">-- Cargar Receta Guardada --</option>';
    Object.keys(Recetas).forEach(k => {
        const opt = document.createElement('option'); opt.value = k; opt.textContent = k; select.appendChild(opt);
    });
}

async function guardarPlantillaNube() {
    const nombreInput = document.getElementById('nombre-plantilla').value.trim();
    const select = document.getElementById('select-plantillas');
    const nombreSeleccionado = select ? select.value : "";

    if (!nombreInput) {
        Swal.fire({ title: 'Falta nombre', text: 'Por favor, ingresa un nombre para guardar la receta.', icon: 'warning', confirmButtonColor: '#3b82f6' });
        return;
    }
    
    if (modulos.pan.length === 0 && modulos.relleno.length === 0 && modulos.betun.length === 0) {
        Swal.fire({ title: 'Receta Vacía', text: 'No puedes guardar una plantilla sin ingredientes. Agrega componentes al pan, relleno o betún primero.', icon: 'warning', confirmButtonColor: '#3b82f6' });
        return;
    }

    let nombreFinal = nombreInput;

    if (nombreSeleccionado && nombreSeleccionado !== nombreInput && Recetas[nombreSeleccionado]) {
        const confirmarRenombrar = await Swal.fire({
            title: '¿Renombrar Receta?',
            text: `¿Deseas cambiar el nombre de "${nombreSeleccionado}" a "${nombreInput}" conservando los ingredientes actuales?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3b82f6',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Sí, renombrar',
            cancelButtonText: 'Guardar como nueva'
        });

        if (confirmarRenombrar.isConfirmed) {
            if (config.isPremium && config.urlNube) {
                try {
                    await apiFetch(config.urlNube, {
                        correo: config.correoUser, token: config.tokenUser,
                        accion: "eliminarPlantilla", nombreReceta: nombreSeleccionado
                    });
                } catch(e) { console.error("Error al limpiar nombre anterior en nube", e); }
            }
            delete Recetas[nombreSeleccionado];
        }
    }

    Recetas[nombreFinal] = JSON.parse(JSON.stringify(modulos));
    localStorage.setItem('respaldo_recetas', JSON.stringify(Recetas));
    rebuildSelect();
    
    if(select) select.value = nombreFinal;
    document.getElementById('nombre-plantilla').value = "";

    if (config.isPremium && config.urlNube) {
        cambiarBannerStatus("⏳ Respaldando receta en la nube...", true);

        Swal.fire({
            title: 'Subiendo receta...',
            text: 'Guardando composición del pastel en tu cuenta remota.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            const resultado = await apiFetch(config.urlNube, {
                correo: config.correoUser,
                token: config.tokenUser,
                accion: "guardarPlantilla",
                nombreReceta: nombreFinal,
                estructuraJson: JSON.stringify(modulos) 
            });
            if (resultado.status === "success") {
                evaluarEstadoVisualPremium();
                Swal.fire({ title: '¡Guardada!', text: 'Receta actualizada y sincronizada en NEXI Cloud.', icon: 'success', confirmButtonColor: '#3b82f6' });
            } else {
                Swal.fire({ title: 'Error', text: 'Error de almacenamiento: ' + resultado.message, icon: 'error', confirmButtonColor: '#3b82f6' });
            }
        } catch(e) {
            Swal.fire({ title: 'Error de Red', text: 'No hay conexión remota disponible. La receta se mantendrá guardada de forma local.', icon: 'warning', confirmButtonColor: '#3b82f6' });
        }
    } else {
        if (typeof gtag === 'function') gtag('event', 'receta_guardada', { 'alojamiento': 'Local' });
        Swal.fire({ title: '¡Guardada!', text: 'Receta actualizada localmente.', icon: 'success', confirmButtonColor: '#3b82f6' });
    }
}

function cargarPlantilla(nombre) {
    if(!nombre || !Recetas[nombre]) return;
    
    const inputNombre = document.getElementById('nombre-plantilla');
    if(inputNombre) inputNombre.value = nombre;

    modulos = JSON.parse(JSON.stringify(Recetas[nombre]));
    renderModulos();
    calcularTodo();

    const select = document.getElementById('select-plantillas');
    if (select) select.blur();
}

function cargarRecetaBaseComoInsumo() {
    if (!Recetas || Object.keys(Recetas).length === 0) {
        Swal.fire({
            title: 'No hay recetas',
            text: 'Primero debes tener recetas guardadas en tu catálogo para poder importarlas como componente.',
            icon: 'info',
            confirmButtonColor: '#3b82f6'
        });
        return;
    }

    let opcionesHTML = `<select id="swal-select-receta-base" class="table-input" style="width: 100%; padding: 10px; font-size: 16px; background-color: var(--bg-main); color: var(--text-main); border: 1px solid var(--border-card);">
        <option value="" disabled selected> Selecciona una receta base...</option>`;
    
    Object.keys(Recetas).forEach(nombre => {
        opcionesHTML += `<option value="${nombre}">${nombre}</option>`;
    });
    opcionesHTML += `</select>`;

    Swal.fire({
        title: `📂 Cargar Receta Base en: ${currentModule.toUpperCase()}`,
        html: opcionesHTML,
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Añadir al módulo',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const select = document.getElementById('swal-select-receta-base');
            if (!select || !select.value) {
                Swal.showValidationMessage('Debes seleccionar una receta base obligatoriamente');
            }
            return select.value;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const nombreReceta = result.value;
            const estructuraReceta = Recetas[nombreReceta];

            if (!estructuraReceta) {
                Swal.fire({ title: 'Error', text: 'No se pudo leer la estructura de la receta seleccionada.', icon: 'error' });
                return;
            }

            let costoTotalReceta = 0;
            const factorMerma = 1 + ((config.porcentajeMerma || 0) / 100);

            ['pan', 'relleno', 'betun'].forEach(key => {
                if (estructuraReceta[key] && Array.isArray(estructuraReceta[key])) {
                    estructuraReceta[key].forEach(item => {
                        if (item.esPlantilla) {
                            costoTotalReceta += parseFloat(item.costoFijo) || 0;
                        } else {
                            const insumo = insumos.find(i => String(i.id) === String(item.insumoId));
                            if (insumo) {
                                let cantPaquete = parseFloat(insumo.cantidad) || 1;
                                if(insumo.unidad === 'kg' && item.unidadUsada === 'g') cantPaquete *= 1000;
                                if(insumo.unidad === 'g' && item.unidadUsada === 'kg') cantPaquete /= 1000;
                                if(insumo.unidad === 'L' && item.unidadUsada === 'ml') cantPaquete *= 1000;
                                if(insumo.unidad === 'ml' && item.unidadUsada === 'L') cantPaquete /= 1000;
                                
                                const precioInsumo = parseFloat(insumo.precio) || 0;
                                const cantUsada = parseFloat(item.cantidadUsada) || 0;
                                
                                costoTotalReceta += ((precioInsumo / cantPaquete) * cantUsada) * factorMerma;
                            }
                        }
                    });
                }
            });

            modulos[currentModule].push({
                esPlantilla: true,
                nombrePlantilla: nombreReceta,
                costoFijo: costoTotalReceta
            });

            renderModulos();
            calcularTodo();

            if (typeof gtag === 'function') {
                gtag('event', 'receta_base_importada', { 'modulo': currentModule });
            }

            Swal.fire({
                title: '¡Añadida!',
                text: `"${nombreReceta}" se integró con éxito como componente base.`,
                icon: 'success',
                confirmButtonColor: '#3b82f6',
                timer: 1500
            });
        }
    });
}

async function eliminarPlantillaActual() {
    const select = document.getElementById('select-plantillas');
    const nombre = select.value;
    if(!nombre) {
        Swal.fire({ title: 'Selección vacía', text: 'Por favor, selecciona primero una receta para eliminar.', icon: 'info', confirmButtonColor: '#3b82f6' });
        return;
    }

    const confirmacion = await Swal.fire({
        title: '¿Eliminar receta?',
        text: `¿Seguro que deseas eliminar definitivamente la receta "${nombre}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e57373',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if(!confirmacion.isConfirmed) return;

    if (config.isPremium && config.urlNube) {
        cambiarBannerStatus("⏳ Eliminando receta de la nube...", true);

        Swal.fire({
            title: 'Borrando receta...',
            text: 'Eliminando composición de NEXI Cloud. Por favor espera.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            const resultado = await apiFetch(config.urlNube, {
                correo: config.correoUser,
                token: config.tokenUser,
                accion: "eliminarPlantilla",
                nombreReceta: nombre
            });
            if (resultado.status !== "success") {
                Swal.fire({ title: 'Error', text: 'Error en la nube: ' + resultado.message, icon: 'error', confirmButtonColor: '#3b82f6' });
                cambiarBannerStatus("❌ Error al eliminar receta en nube", false);
                return;
            }
        } catch(e) {
            Swal.fire({ title: 'Error de Red', text: 'No se pudo conectar a la nube para borrar la receta remota.', icon: 'error', confirmButtonColor: '#3b82f6' });
            cambiarBannerStatus("❌ Error de conexión remota", false);
            return;
        }
    }

    delete Recetas[nombre];
    localStorage.setItem('respaldo_recetas', JSON.stringify(Recetas));
    rebuildSelect();
    limpiarComposicionCompleta();
    evaluarEstadoVisualPremium();

    Swal.fire({ title: 'Receta Eliminada', text: `La receta "${nombre}" fue eliminada correctamente.`, icon: 'success', confirmButtonColor: '#3b82f6' });
}

function limpiarComposicionCompleta() {
    modulos = { pan: [], relleno: [], betun: [] };
    renderModulos();
    calcularTodo();
    actualizarSelectReceta(); 
}

function enviarCotizacionWhatsApp() {
    const pasteleria = config.nombrePasteleria || "NEXI Bake";
    const porciones = document.getElementById('porciones-totales').value || "0";
    const precioTotal = document.getElementById('res-precio-venta').textContent;
    const precioRebanada = document.getElementById('res-precio-porcion').textContent;
    const dificultadSelect = document.getElementById('margen-ganancia');
    const dificultad = dificultadSelect.options[dificultadSelect.selectedIndex].text.split("(")[0].trim();

    if (porciones === "0" || precioTotal === "$0" || precioTotal === "$0.00") {
        Swal.fire({ title: 'Faltan datos', text: 'Por favor introduce un número válido de porciones e insumos antes de exportar el presupuesto.', icon: 'warning', confirmButtonColor: '#3b82f6' });
        return;
    }

    const mensaje = `¡Hola! ✨ Te saluda *${pasteleria}*.\n\n` +
                    `Aquí tienes el presupuesto detallado para tu pedido:\n` +
                    `🎂 *Porciones solicitadas:* ${porciones} rebanadas\n` +
                    `🎨 *Tipo de acabado/Diseño:* ${dificultad}\n` +
                    `💵 *Precio por rebanada:* ${precioRebanada}\n` +
                    `----------------------------------------\n` +
                    `💰 *TOTAL NETO:* ${precioTotal}\n\n` +
                    `*Nota:* Esta cotización incluye pan base premium, rellenos artesanales y coberturas personalizadas. ¿Te gustaría agendar tu fecha con nosotros? 👩‍🍳🍰`;

    const urlWhatsapp = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    if (typeof gtag === 'function') gtag('event', 'cotizacion_exportada_whatsapp');
    window.open(urlWhatsapp, '_blank');
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const iconRender = document.getElementById('icon-render');
    if (currentTheme === 'dark') {
        document.documentElement.removeAttribute('data-theme');
        iconRender.textContent = 'dark_mode';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        iconRender.textContent = 'light_mode';
    }
}

async function descargarDeNube() {
    if (!config.urlNube || !config.tokenUser) return;

    cambiarBannerStatus("⏳ Validando credenciales en NEXI Cloud...", null);

    try {
        const data = await apiFetch(config.urlNube, {
            correo: config.correoUser,
            token: config.tokenUser,
            accion: "obtenerConfiguracion"
        });

        if (data.status === "error") {
            config.isPremium = false;
            localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));
            cambiarBannerStatus("❌ " + data.message, false);
            Swal.fire({ title: 'Sesión Expirada', text: `Error de acceso en la nube: ${data.message}`, icon: 'error', confirmButtonColor: '#3b82f6' });
            evaluarEstadoVisualPremium();
            return;
        }

        config.isPremium = true;
        if (data.nombrePasteleria) config.nombrePasteleria = data.nombrePasteleria;
        if (data.moneda) config.moneda = data.moneda; 
        if (data.porcentajeIndirectos !== undefined) config.porcentajeIndirectos = data.porcentajeIndirectos;
        if (data.porcentajeMerma !== undefined) config.porcentajeMerma = data.porcentajeMerma;
        
        localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));

        if (data.insumos) {
            const insumosLocalesRaw = localStorage.getItem('respaldo_insumos');
            let insumosLocales = insumosLocalesRaw ? JSON.parse(insumosLocalesRaw) : [];
            
            if (insumosLocales.length > 0 && data.insumos.length > 0) {
                insumos = fusionarListasInsumos(insumosLocales, data.insumos);
            } else {
                insumos = data.insumos.length > 0 ? data.insumos : insumosLocales;
            }
            
            ordenarInsumosAlfabeticamente();
            localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
        }
        
        if (data.plantillas) {
            let recetasProcesadas = { ...data.plantillas };
            
            Object.keys(recetasProcesadas).forEach(key => {
                if (typeof recetasProcesadas[key] === 'string') {
                    try {
                        recetasProcesadas[key] = JSON.parse(recetasProcesadas[key]);
                    } catch(e) { console.error("Error parseando receta remota:", key); }
                }
            });

            Recetas = recetasProcesadas;
            localStorage.setItem('respaldo_recetas', JSON.stringify(Recetas));
        } else {
            Recetas = {};
            localStorage.removeItem('respaldo_recetas');
        }

        document.getElementById('cfg-nombre').value = config.nombrePasteleria;
        document.getElementById('cfg-moneda').value = config.moneda; 
        document.getElementById('cfg-indirectos').value = config.porcentajeIndirectos;
        document.getElementById('cfg-merma').value = config.porcentajeMerma;
        
        document.getElementById('lbl-nombre-pasteleria').textContent = config.nombrePasteleria;
        document.getElementById('lbl-indirectos-porcentaje').textContent = `Gastos Indirectos (${config.porcentajeIndirectos}%):`;

        evaluarEstadoVisualPremium();
        renderInsumos();
        renderModulos();
        rebuildSelect();
        calcularTodo();

        cambiarBannerStatus(`☁️ Conectado como: ${config.correoUser} (NEXI Cloud Activo)`, true);
    } catch(e) {
        console.error(e);
        cambiarBannerStatus("❌ Error de conexión con el servidor NEXI", false);
    }
}

window.onload = async function() {
    cargarConfiguracion(); 
    
    const localInsumos = localStorage.getItem('respaldo_insumos');
    if(localInsumos) { try { insumos = JSON.parse(localInsumos); } catch(e){} }
    
    const local = localStorage.getItem('respaldo_recetas');
    if(local) { try { Recetas = JSON.parse(local); } catch(e){} }

    ordenarInsumosAlfabeticamente();
    evaluarEstadoVisualPremium();

    if (config.isPremium && config.urlNube) {
        await descargarDeNube();
    } else {
        renderInsumos();
        renderModulos();
        rebuildSelect();
        calcularTodo();
    }
};

function toggleAcordeonTotales() {
    const cuerpo = document.getElementById('cuerpo-acordeon-totales');
    const flecha = document.getElementById('flecha-acordeon');
    if (!cuerpo) return;
    
    // CORRECCIÓN 2: Obtiene el display inline real o por defecto y conmuta de manera segura
    if (cuerpo.style.display === "block") {
        cuerpo.style.display = "none";
        if(flecha) flecha.style.transform = 'rotate(0deg)';
    } else {
        cuerpo.style.display = "block";
        if(flecha) flecha.style.transform = 'rotate(180deg)';
    }
}

function toggleMostrarToken() {
    const inputToken = document.getElementById('cfg-token-user');
    const icono = document.getElementById('ojo-icono');
    if (!inputToken || !icono) return;

    if (inputToken.type === 'password') {
        inputToken.type = 'text';
        icono.textContent = 'visibility_off'; 
    } else {
        inputToken.type = 'password';
        icono.textContent = 'visibility';     
    }
}