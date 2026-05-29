/**
 * Lógica Principal de la Aplicación (UI & Estado) - NEXI Bake 2026
 */

let insumos = [];
let modulos = { pan: [], relleno: [], betun: [] };
let plantillasRecetas = {};
let currentModule = 'pan';
let plantillaSeleccionadaId = null;
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
    if (cuerpo.style.display === 'none') {
        cuerpo.style.display = 'block';
        flecha.style.transform = 'rotate(180deg)';
    } else {
        cuerpo.style.display = 'none';
        flecha.style.transform = 'rotate(0deg)';
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

    config.nombrePasteleria = document.getElementById('cfg-nombre').value.trim() || "NEXI Bake";
    config.moneda = document.getElementById('cfg-moneda').value.trim() || "$";
    config.porcentajeIndirectos = parseFloat(document.getElementById('cfg-indirectos').value) || 0;
    config.porcentajeMerma = parseFloat(document.getElementById('cfg-merma').value) || 0;
    config.urlNube = document.getElementById('cfg-url-servidor').value.trim();
    config.correoUser = document.getElementById('cfg-correo-user').value.trim().toLowerCase();
    config.tokenUser = document.getElementById('cfg-token-user').value.trim();

    document.getElementById('lbl-nombre-pasteleria').textContent = config.nombrePasteleria;
    document.getElementById('lbl-indirectos-porcentaje').textContent = `Gastos Indirectos (${config.porcentajeIndirectos}%):`;
    
    if (config.tokenUser && config.urlNube) {
        isSavingConfig = true; 
        config.isPremium = true;
        localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));
        
        evaluarEstadoVisualPremium();
        calcularTodo();

        Swal.fire({
            title: 'Sincronizando cuenta...',
            text: 'Por favor, espera un momento mientras validamos tus datos.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        cambiarBannerStatus("⏳ Sincronizando y activando cuenta Premium...", null);
        try {
            const insumosLocalesRaw = localStorage.getItem('respaldo_insumos');
            const plantillasLocalesRaw = localStorage.getItem('respaldo_plantillas');
            
            let insumosLocales = insumosLocalesRaw ? JSON.parse(insumosLocalesRaw) : [];
            let plantillasLocales = plantillasLocalesRaw ? JSON.parse(plantillasLocalesRaw) : {};
            
            const consultaNube = await apiGet(config.urlNube, config.correoUser, config.tokenUser);
            
            let datosFinalesInsumos = insumosLocales;
            let datosFinalesPlantillas = plantillasLocales;

            if (consultaNube && consultaNube.status !== "error") {
                let insumosNube = consultaNube.insumos || [];
                let plantillasNube = consultaNube.plantillas || {};

                if (consultaNube.nombrePasteleria) config.nombrePasteleria = consultaNube.nombrePasteleria;
                if (consultaNube.moneda) config.moneda = consultaNube.moneda;
                if (consultaNube.porcentajeIndirectos !== undefined) config.porcentajeIndirectos = consultaNube.porcentajeIndirectos;
                if (consultaNube.porcentajeMerma !== undefined) config.porcentajeMerma = consultaNube.porcentajeMerma;
                localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));

                if (insumosLocales.length > 0 && insumosNube.length > 0) {
                    Swal.close(); 
                    
                    const resultadoFusion = await Swal.fire({
                        title: '⚡ Datos Duplicados Detectados',
                        text: 'Detectamos insumos tanto en este teléfono como en tu cuenta NEXI Cloud. ¿Deseas unirlos todos de forma inteligente para no perder nada?',
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonColor: '#3b82f6',
                        cancelButtonColor: '#64748b',
                        confirmButtonText: 'Sí, fusionar datos',
                        cancelButtonText: 'No fusionar'
                    });
                    
                    if (resultadoFusion.isConfirmed) {
                        datosFinalesInsumos = fusionarListasInsumos(insumosLocales, insumosNube);
                        datosFinalesPlantillas = { ...plantillasNube, ...plantillasLocales };
                    } else {
                        const resultadoNube = await Swal.fire({
                            title: '¿Cómo deseas proceder?',
                            text: '¿Prefieres usar SOLAMENTE tus datos guardados en NEXI Cloud?',
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#3b82f6',
                            cancelButtonColor: '#e57373',
                            confirmButtonText: 'Usar solo la Nube',
                            cancelButtonText: 'Mantener locales'
                        });
                        if (resultadoNube.isConfirmed) {
                            datosFinalesInsumos = insumosNube;
                            datosFinalesPlantillas = plantillasNube;
                        }
                    }

                    Swal.fire({
                        title: 'Guardando cambios...',
                        allowOutsideClick: false,
                        didOpen: () => { Swal.showLoading(); }
                    });
                } else if (insumosNube.length > 0) {
                    datosFinalesInsumos = insumosNube;
                    datosFinalesPlantillas = plantillasNube;
                }
            }

            let datosAInyectar = {
                tieneDatosPrevios: datosFinalesInsumos.length > 0,
                insumos: datosFinalesInsumos,
                plantillas: datosFinalesPlantillas
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
                plantillasRecetas = datosFinalesPlantillas;

                localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
                localStorage.setItem('respaldo_plantillas', JSON.stringify(plantillasRecetas));
                
                document.getElementById('cfg-nombre').value = config.nombrePasteleria;
                document.getElementById('cfg-moneda').value = config.moneda;
                document.getElementById('cfg-indirectos').value = config.porcentajeIndirectos;
                document.getElementById('cfg-merma').value = config.porcentajeMerma;
                document.getElementById('lbl-nombre-pasteleria').textContent = config.nombrePasteleria;
                document.getElementById('lbl-indirectos-porcentaje').textContent = `Gastos Indirectos (${config.porcentajeIndirectos}%):`;

                evaluarEstadoVisualPremium();
                renderInsumos();
                renderModulos();
                rebuildSelectPlantillas();
                calcularTodo();

                Swal.fire({
                    title: '¡Conectado exitosamente! 🎉',
                    text: 'Tu cuenta Premium de NEXI Bake está activa. Datos sincronizados.',
                    icon: 'success',
                    confirmButtonColor: '#3b82f6'
                });
            } else {
                config.isPremium = false;
                localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));
                evaluarEstadoVisualPremium();
                cambiarBannerStatus("❌ Token o Correo Inválido", false);
                Swal.fire({ title: 'Atención ⚠️', text: `La nube rechazó el acceso: ${respuestaServidor.message}`, icon: 'warning', confirmButtonColor: '#3b82f6' });
            }
        } catch(e) { 
            console.error(e);
            cambiarBannerStatus("⚠️ Conectado en modo Local temporal", false);
            Swal.fire({ title: 'Modo Local Activado', text: 'Se guardó localmente, pero hubo un problema al conectar con NEXI Cloud.', icon: 'info', confirmButtonColor: '#3b82f6' });
        } finally {
            isSavingConfig = false;
        }
    } else {
        config.isPremium = false;
        localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));
        document.getElementById('lbl-nombre-pasteleria').textContent = config.nombrePasteleria;
        
        evaluarEstadoVisualPremium();
        renderInsumos();
        renderModulos();
        rebuildSelectPlantillas();
        calcularTodo();
        Swal.fire({ title: '¡Guardado!', text: 'Configuración local actualizada correctamente.', icon: 'success', confirmButtonColor: '#3b82f6' });
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
        title: '🚨 ¡ATENCIÓN!',
        html: 'Al cerrar sesión se borrarán las recetas y el inventario de la pantalla de este dispositivo.<br><br><strong>¿Estás completamente seguro?</strong>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e57373', 
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, cerrar sesión',
        cancelButtonText: 'Cancelar'
    });

    if (!resultadoCierre.isConfirmed) return;

    config.correoUser = ""; config.tokenUser = ""; config.isPremium = false;
    localStorage.removeItem('respaldo_config_pasteleria');
    localStorage.removeItem('respaldo_insumos');
    localStorage.removeItem('respaldo_plantillas');
    window.location.reload();
}

function renderInsumos() {
    const tbody = document.getElementById('tabla-insumos');
    if(!tbody) return;
    tbody.innerHTML = '';
    const m = config.moneda || "$";

    const inputBuscar = document.getElementById('buscador-inventario');
    const textoBusqueda = inputBuscar ? inputBuscar.value.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';

    let insumosFiltrados = insumos.filter(insumo => {
        const nombre = insumo.nombre ? String(insumo.nombre).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        const marca = insumo.marca ? String(insumo.marca).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        return nombre.includes(textoBusqueda) || marca.includes(textoBusqueda);
    });

    insumosFiltrados.sort((a, b) => (a.nombre || "").trim().localeCompare((b.nombre || "").trim(), 'es', { sensitivity: 'base' }));

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

    if (!nombre || isNaN(cantidad) || cantidad <= 0 || isNaN(precio) || precio < 0) {
        Swal.fire({ title: 'Datos incorrectos', text: 'Por favor, revise los campos numéricos y el nombre.', icon: 'error' });
        return;
    }

    insumos.push({ id: 'id_' + Date.now(), nombre, marca, tamano, cantidad, unidad, precio });
    localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
    document.getElementById('form-insumo').reset();
    renderInsumos();
    calcularTodo();
    Swal.fire({ title: '¡Añadido!', text: 'Insumo guardado localmente.', icon: 'success', timer: 1500, showConfirmButton: false });
}

let isSavingInsumo = false; 
async function agregarNuevoInsumoNube() {
    if (isSavingInsumo) return;

    const nombre = document.getElementById('insumo-nombre').value.trim();
    const marca = document.getElementById('insumo-marca').value.trim();
    const tamano = document.getElementById('insumo-tamano').value.trim();
    const cantidad = parseFloat(document.getElementById('insumo-cantidad').value);
    const unidad = document.getElementById('insumo-unidad').value;
    const precio = parseFloat(document.getElementById('insumo-precio').value);

    if (!nombre || isNaN(cantidad) || cantidad <= 0 || isNaN(precio) || precio < 0) {
        Swal.fire({ title: 'Datos incorrectos', text: 'Por favor verifique su formulario.', icon: 'error' });
        return;
    }

    isSavingInsumo = true;
    const id = Date.now().toString();
    cambiarBannerStatus("⏳ Sincronizando insumo...", true);

    Swal.fire({ title: 'Guardando ingrediente...', text: 'Subiendo datos a NEXI Cloud.', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        const resultado = await apiFetch(config.urlNube, { correo: config.correoUser, token: config.tokenUser, accion: "guardarInsumo", id, nombre, marca, tamano, cantidad, unidad, precio });
        if (resultado.status === "success") {
            insumos.push({ id, nombre, marca, tamano, cantidad, unidad, precio });
            localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
            document.getElementById('form-insumo').reset();
            renderInsumos();
            calcularTodo();
            Swal.fire({ title: '¡Sincronizado!', text: 'Insumo alojado en NEXI Cloud.', icon: 'success' });
        } else {
            Swal.fire({ title: 'Error', text: resultado.message, icon: 'error' });
        }
    } catch(e) {
        Swal.fire({ title: 'Fallo de Red', text: 'No se pudo guardar remotamente.', icon: 'error' });
    } finally {
        isSavingInsumo = false;
        evaluarEstadoVisualPremium();
    }
}

function actualizarDatoInsumo(id, campo, valor, inputElement = null) {
    const insumo = insumos.find(i => String(i.id) === String(id));
    if (!insumo) return;

    if (campo === 'precio' || campo === 'cantidad') { 
        let valorLimpio = String(valor).replace(/,/g, '.').replace(/[^0-9.]/g, '');
        const valorNumerico = parseFloat(valorLimpio);
        
        if (isNaN(valorNumerico) || valorNumerico <= 0) {
            Swal.fire({ title: 'Valor inválido ⚠️', text: 'Introduce un número real mayor a cero.', icon: 'warning', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            if (inputElement) inputElement.value = insumo[campo];
            return; 
        }
        insumo[campo] = valorNumerico; 
    } else { 
        insumo[campo] = valor.trim(); 
    }

    localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
    renderModulos();
    calcularTodo();
    
    if(config.isPremium && config.urlNube) {
        syncQueue = syncQueue.then(async () => {
            try {
                await apiFetch(config.urlNube, { correo: config.correoUser, token: config.tokenUser, accion: "guardarInsumo", id: insumo.id, nombre: insumo.nombre, marca: insumo.marca, tamano: insumo.tamano, cantidad: insumo.cantidad, unidad: insumo.unidad, precio: insumo.precio });
            } catch(err) {
                cambiarBannerStatus("⚠️ Cambios pendientes de sincronización", false);
            }
        });
    }
}

async function eliminarInsumo(id) {
    const insumoEncontrado = insumos.find(i => String(i.id) === String(id));
    if (!insumoEncontrado) return;

    const confirmacion = await Swal.fire({
        title: '¿Eliminar insumo?',
        text: `¿Seguro que deseas borrar "${insumoEncontrado.nombre}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e57373',
        confirmButtonText: 'Sí, eliminar'
    });

    if (!confirmacion.isConfirmed) return;

    if (config.isPremium && config.urlNube) {
        Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        try {
            const res = await apiFetch(config.urlNube, { correo: config.correoUser, token: config.tokenUser, accion: "eliminarInsumo", id });
            if (res.status !== "success") {
                Swal.fire({ title: 'Error', text: res.message, icon: 'error' });
                return;
            }
        } catch(e) {
            Swal.fire({ title: 'Fallo de Red', text: 'Error de conexión remota.', icon: 'error' });
            return;
        }
    }

    insumos = insumos.filter(i => String(i.id) !== String(id));
    for(let key in modulos) { modulos[key] = modulos[key].filter(r => String(r.insumoId) !== String(id)); }
    localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
    renderInsumos();
    renderModulos();
    calcularTodo();
    Swal.fire({ title: 'Eliminado', icon: 'success', timer: 1000, showConfirmButton: false });
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
    
    let filtrados = insumos.filter(i => {
        const n = i.nombre ? String(i.nombre).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        const m = i.marca ? String(i.marca).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        return n.includes(t) || m.includes(t);
    });
    
    if(filtrados.length === 0 && t === "") {
        actualizarSelectReceta();
        return;
    }

    filtrados.sort((a, b) => (a.nombre || "").trim().localeCompare((b.nombre || "").trim(), 'es', { sensitivity: 'base' }));
    
    filtrados.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.id; opt.textContent = `${i.nombre} (${i.marca || 'S/M'})`; select.appendChild(opt);
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
    if(!id || isNaN(cant) || cant <= 0) return;

    modulos[currentModule].push({ insumoId: id, cantidadUsada: cant, unidadUsada: uni });
    
    document.getElementById('form-receta').reset();
    document.getElementById('buscador-receta').value = ""; 
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
        const insumo = insumos.find(i => String(i.id) === String(item.insumoId));
        if (insumo) {
            let cantPaquete = insumo.cantidad;
            if(insumo.unidad === 'kg' && item.unidadUsada === 'g') cantPaquete *= 1000;
            if(insumo.unidad === 'g' && item.unidadUsada === 'kg') cantPaquete /= 1000;
            if(insumo.unidad === 'L' && item.unidadUsada === 'ml') cantPaquete *= 1000;
            if(insumo.unidad === 'ml' && item.unidadUsada === 'L') cantPaquete /= 1000;
            
            total += ((insumo.precio / cantPaquete) * item.cantidadUsada) * factorMerma;
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
    
    const horasMO = parseFloat(document.getElementById('mo-horas').value) || 0;
    const precioHour = parseFloat(document.getElementById('mo-precio-hora').value) || 0;
    const totalManoObra = horasMO * precioHour;

    const totalProduc = subtotalInsumos + indirectos + totalManoObra;
    const m = config.moneda || "$";
    
    document.getElementById('txt-costo-pan').textContent = `${m}${costoPan.toFixed(2)}`; 
    document.getElementById('txt-costo-relleno').textContent = `${m}${costoRelleno.toFixed(2)}`; 
    document.getElementById('txt-costo-betun').textContent = `${m}${costoBetun.toFixed(2)}`; 
    document.getElementById('txt-costo-indirectos').textContent = `${m}${indirectos.toFixed(2)}`; 
    document.getElementById('txt-costo-manodeobra').textContent = `${m}${totalManoObra.toFixed(2)}`; 
    document.getElementById('costo-produccion-total').textContent = `${m}${totalProduc.toFixed(2)}`;
    
    const inputPorciones = parseFloat(document.getElementById('porciones-totales').value) || 0; 
    const multiplicador = parseFloat(document.getElementById('margen-ganancia').value) || 3;
    
    let basePrecioVenta = ((subtotalInsumos + indirectos) * multiplicador) + totalManoObra;
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

function rebuildSelectPlantillas() {
    const select = document.getElementById('select-plantillas');
    if(!select) return;
    select.innerHTML = '<option value="">-- Cargar Receta Guardada --</option>';
    
    const nombresOrdenados = Object.keys(plantillasRecetas).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    nombresOrdenados.forEach(k => {
        const opt = document.createElement('option'); opt.value = k; opt.textContent = k; select.appendChild(opt);
    });
}

function cargarPlantilla(nombrePlantilla) {
    if (!nombrePlantilla || !plantillasRecetas[nombrePlantilla]) {
        plantillaSeleccionadaId = null;
        return;
    }
    plantillaSeleccionadaId = nombrePlantilla;
    const receta = plantillasRecetas[nombrePlantilla];
    
    modulos.pan = receta.pan ? JSON.parse(JSON.stringify(receta.pan)) : [];
    modulos.relleno = receta.relleno ? JSON.parse(JSON.stringify(receta.relleno)) : [];
    modulos.betun = receta.betun ? JSON.parse(JSON.stringify(receta.betun)) : [];
    
    document.getElementById('nombre-plantilla').value = nombrePlantilla;
    renderModulos();
    calcularTodo();
}

function guardarPlantillaNube() {
    const nombreInput = document.getElementById('nombre-plantilla').value.trim();
    if (!nombreInput) {
        Swal.fire('¡Atención!', 'Por favor, escribe un nombre para la receta.', 'warning');
        return;
    }

    if (plantillaSeleccionadaId && plantillaSeleccionadaId !== nombreInput) {
        Swal.fire({
            title: '¿Deseas renombrar esta receta?',
            text: `Detectamos un cambio de nombre de "${plantillaSeleccionadaId}" a "${nombreInput}".`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, renombrar',
            cancelButtonText: 'Guardar como copia'
        }).then((result) => {
            if (result.isConfirmed) {
                ejecutarGuardadoReceta(nombreInput, plantillaSeleccionadaId, true); 
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                ejecutarGuardadoReceta(nombreInput, null, false);
            }
        });
    } else {
        ejecutarGuardadoReceta(nombreInput, null, false);
    }
}

function ejecutarGuardadoReceta(nombreNuevo, nombreAntiguo, esRenombrado) {
    const datosComposicion = { pan: modulos.pan, relleno: modulos.relleno, betun: modulos.betun };
    Swal.fire({ title: 'Guardando receta...', text: 'Sincronizando con NEXI Cloud.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    if (config.isPremium && config.urlNube) {
        apiFetch(config.urlNube, { correo: config.correoUser, token: config.tokenUser, accion: "guardarPlantilla", nombreReceta: nombreNuevo, composicion: datosComposicion })
        .then(async (resultado) => {
            if (resultado.status === "success") {
                if (esRenombrado && nombreAntiguo) {
                    try {
                        await apiFetch(config.urlNube, { correo: config.correoUser, token: config.tokenUser, accion: "eliminarPlantilla", nombreReceta: nombreAntiguo });
                        delete plantillasRecetas[nombreAntiguo];
                    } catch(e) { console.error(e); }
                }
                plantillasRecetas[nombreNuevo] = datosComposicion;
                localStorage.setItem('respaldo_plantillas', JSON.stringify(plantillasRecetas));
                plantillaSeleccionadaId = nombreNuevo;
                rebuildSelectPlantillas();
                document.getElementById('select-plantillas').value = nombreNuevo;
                Swal.fire({ title: '¡Éxito! 🎉', text: 'Receta sincronizada.', icon: 'success' });
            } else {
                Swal.fire('Error', resultado.message, 'error');
            }
        }).catch(() => Swal.fire('Error', 'Problema de red.', 'error'));
    } else {
        if (esRenombrado && nombreAntiguo) delete plantillasRecetas[nombreAntiguo];
        plantillasRecetas[nombreNuevo] = datosComposicion;
        localStorage.setItem('respaldo_plantillas', JSON.stringify(plantillasRecetas));
        plantillaSeleccionadaId = nombreNuevo;
        rebuildSelectPlantillas();
        document.getElementById('select-plantillas').value = nombreNuevo;
        Swal.fire({ title: '¡Guardado local!', text: 'Receta guardada en el dispositivo.', icon: 'success' });
    }
}

async function eliminarPlantillaActual() {
    const select = document.getElementById('select-plantillas');
    const nombre = select.value;
    if(!nombre) {
        Swal.fire({ title: 'Selección vacía', text: 'Selecciona una receta primero.', icon: 'info' });
        return;
    }

    const confirmacion = await Swal.fire({ title: '¿Eliminar receta?', text: `¿Seguro de borrar "${nombre}"?`, icon: 'warning', showCancelButton: true });
    if(!confirmacion.isConfirmed) return;

    if (config.isPremium && config.urlNube) {
        Swal.fire({ title: 'Borrando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        try {
            const res = await apiFetch(config.urlNube, { correo: config.correoUser, token: config.tokenUser, accion: "eliminarPlantilla", nombreReceta: nombre });
            if (res.status !== "success") { Swal.fire({ title: 'Error', text: res.message, icon: 'error' }); return; }
        } catch(e) { Swal.fire({ title: 'Error de Red', icon: 'error' }); return; }
    }

    delete plantillasRecetas[nombre];
    localStorage.setItem('respaldo_plantillas', JSON.stringify(plantillasRecetas));
    rebuildSelectPlantillas();
    limpiarComposicionCompleta();
    Swal.fire({ title: 'Receta Eliminada', icon: 'success', timer: 1000, showConfirmButton: false });
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
        Swal.fire({ title: 'Faltan datos', text: 'Por favor introduce porciones e insumos válidos.', icon: 'warning' });
        return;
    }

    const mensaje = `¡Hola! ✨ Te saluda *${pasteleria}*.\n\n` +
                    `Aquí tienes el presupuesto detallado para tu pedido:\n` +
                    `🎂 *Porciones solicitadas:* ${porciones} rebanadas\n` +
                    `🎨 *Tipo de acabado/Diseño:* ${dificultad}\n` +
                    `💵 *Precio por rebanada:* ${precioRebanada}\n` +
                    `----------------------------------------\n` +
                    `💰 *TOTAL NETO:* ${precioTotal}\n\n` +
                    `¿Te gustaría agendar tu fecha con nosotros? 👩‍🍳🍰`;

    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
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
        const data = await apiGet(config.urlNube, config.correoUser, config.tokenUser);
        if (data.status === "error") {
            config.isPremium = false;
            localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));
            cambiarBannerStatus("❌ " + data.message, false);
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
            insumos = (insumosLocales.length > 0 && data.insumos.length > 0) ? fusionarListasInsumos(insumosLocales, data.insumos) : (data.insumos.length > 0 ? data.insumos : insumosLocales);
            localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
        }
        
        if (data.plantillas) {
            const plantillasLocalesRaw = localStorage.getItem('respaldo_plantillas');
            plantillasRecetas = { ...data.plantillas, ...(plantillasLocalesRaw ? JSON.parse(plantillasLocalesRaw) : {}) };
            localStorage.setItem('respaldo_plantillas', JSON.stringify(plantillasRecetas));
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
        rebuildSelectPlantillas();
        calcularTodo();
    } catch(e) {
        cambiarBannerStatus("❌ Error de conexión con el servidor NEXI", false);
    }
}

window.onload = async function() {
    cargarConfiguracion(); 
    const localInsumos = localStorage.getItem('respaldo_insumos');
    if(localInsumos) { try { insumos = JSON.parse(localInsumos); } catch(e){} }
    const localPlantillas = localStorage.getItem('respaldo_plantillas');
    if(localPlantillas) { try { plantillasRecetas = JSON.parse(localPlantillas); } catch(e){} }

    evaluarEstadoVisualPremium();
    if (config.isPremium && config.urlNube) {
        await descargarDeNube();
    } else {
        renderInsumos();
        renderModulos();
        rebuildSelectPlantillas();
        calcularTodo();
    }
};

function toggleAcordeonTotales() {
    const cuerpo = document.getElementById('cuerpo-acordeon-totales');
    const flecha = document.getElementById('flecha-acordeon');
    if (!cuerpo) return;
    
    if (cuerpo.style.display === "none") {
        cuerpo.style.display = "block";
        if(flecha) flecha.style.transform = 'rotate(180deg)';
    } else {
        cuerpo.style.display = "none";
        if(flecha) flecha.style.transform = 'rotate(0deg)';
    }
}
