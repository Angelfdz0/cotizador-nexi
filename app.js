/**
 * Lógica Principal de la Aplicación (UI & Estado)
 */

let insumos = [];
let modulos = { pan: [], relleno: [], betun: [] };
let plantillasRecetas = {};
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

    // Capturamos los datos del formulario de inmediato
    config.nombrePasteleria = document.getElementById('cfg-nombre').value.trim() || "NEXI Bake";
    config.moneda = document.getElementById('cfg-moneda').value.trim() || "$";
    config.porcentajeIndirectos = parseFloat(document.getElementById('cfg-indirectos').value) || 0;
    config.porcentajeMerma = parseFloat(document.getElementById('cfg-merma').value) || 0;
    config.urlNube = document.getElementById('cfg-url-servidor').value.trim();
    config.correoUser = document.getElementById('cfg-correo-user').value.trim().toLowerCase();
    config.tokenUser = document.getElementById('cfg-token-user').value.trim();

    // Actualización visual express inicial
    document.getElementById('lbl-nombre-pasteleria').textContent = config.nombrePasteleria;
    document.getElementById('lbl-indirectos-porcentaje').textContent = `Gastos Indirectos (${config.porcentajeIndirectos}%):`;
    
    if (config.tokenUser && config.urlNube) {
        isSavingConfig = true; // Bloqueamos re-clics
        config.isPremium = true;
        localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));
        
        evaluarEstadoVisualPremium();
        calcularTodo();

        // 🌟 AGREGADO: Loading de SweetAlert2 previo al flujo de la nube
        Swal.fire({
            title: 'Sincronizando cuenta...',
            text: 'Por favor, espera un momento mientras validamos tus datos.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
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

                // Si la nube tiene un nombre guardado anterior, se respeta, de lo contrario se usa el del input
                if (consultaNube.nombrePasteleria) {
                    config.nombrePasteleria = consultaNube.nombrePasteleria;
                }
                if (consultaNube.moneda) config.moneda = consultaNube.moneda;
                if (consultaNube.porcentajeIndirectos !== undefined) config.porcentajeIndirectos = consultaNube.porcentajeIndirectos;
                if (consultaNube.porcentajeMerma !== undefined) config.porcentajeMerma = consultaNube.porcentajeMerma;
                localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));

                if (insumosLocales.length > 0 && insumosNube.length > 0) {
                    // Cerramos el loading temporalmente si requiere interacción del usuario
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
                    const deseaFusionar = resultadoFusion.isConfirmed;
                    
                    if (deseaFusionar) {
                        datosFinalesInsumos = fusionarListasInsumos(insumosLocales, insumosNube);
                        datosFinalesPlantillas = { ...plantillasNube, ...plantillasLocales };
                    } else {
                        const resultadoNube = await Swal.fire({
                            title: '¿Cómo deseas proceder?',
                            text: '¿Prefieres usar SOLAMENTE tus datos guardados en NEXI Cloud? (Se borrarán los insumos actuales de la pantalla).',
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

                    // Volvemos a poner el loading para la fase de inyección final
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

                // 🟢 REFUERZO DE ACTUALIZACIÓN VISUAL POST-SINK
                document.getElementById('lbl-nombre-pasteleria').textContent = config.nombrePasteleria;
                document.getElementById('lbl-indirectos-porcentaje').textContent = `Gastos Indirectos (${config.porcentajeIndirectos}%):`;

                evaluarEstadoVisualPremium();
                renderInsumos();
                renderModulos();
                rebuildSelectPlantillas();
                calcularTodo();

                // Aquí sobreescribimos el loading con el éxito 🎉
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
                Swal.fire({
                    title: 'Atención ⚠️',
                    text: `La nube rechazó el acceso: ${respuestaServidor.message}`,
                    icon: 'warning',
                    confirmButtonColor: '#3b82f6'
                });
            }
        } catch(e) { 
            console.error(e);
            cambiarBannerStatus("⚠️ Conectado en modo Local temporal", false);
            Swal.fire({
                title: 'Modo Local Activado',
                text: 'Se guardó localmente, pero hubo un problema al conectar con NEXI Cloud.',
                icon: 'info',
                confirmButtonColor: '#3b82f6'
            });
        } finally {
            isSavingConfig = false;
        }
        
    } else {
        // Guardado local normal (instantáneo)
        config.isPremium = false;
        localStorage.setItem('respaldo_config_pasteleria', JSON.stringify(config));
        
        // 🟢 Aseguramos actualización local
        document.getElementById('lbl-nombre-pasteleria').textContent = config.nombrePasteleria;
        
        evaluarEstadoVisualPremium();
        renderInsumos();
        renderModulos();
        rebuildSelectPlantillas();
        calcularTodo();
        Swal.fire({
            title: '¡Guardado!',
            text: 'Configuración local actualizada correctamente.',
            icon: 'success',
            confirmButtonColor: '#3b82f6'
        });
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
        html: 'Al cerrar sesión se borrarán las recetas y el inventario de la pantalla de este dispositivo.<br><br>Si trabajaste sin internet, asegúrate de que tus datos se hayan subido por completo a la nube.<br><br><strong>¿Estás completamente seguro de que deseas cerrar sesión?</strong>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e57373', 
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, cerrar sesión',
        cancelButtonText: 'Cancelar'
    });

    if (!resultadoCierre.isConfirmed) return;

    config.correoUser = "";
    config.tokenUser = "";
    config.isPremium = false;
    
    localStorage.removeItem('respaldo_config_pasteleria');
    localStorage.removeItem('respaldo_insumos');
    localStorage.removeItem('respaldo_plantillas');
    
    insumos = [];
    modulos = { pan: [], relleno: [], betun: [] };
    plantillasRecetas = {};
    
    window.location.reload();
}

function renderInsumos() {
    const tbody = document.getElementById('tabla-insumos');
    if(!tbody) return;
    tbody.innerHTML = '';
    const m = config.moneda || "$";

    const inputBuscar = document.getElementById('buscador-inventario');
    const textoBusqueda = inputBuscar ? inputBuscar.value.toLowerCase().trim() : '';

    const insumosFiltrados = insumos.filter(insumo => {
        const nombre = insumo.nombre ? String(insumo.nombre).toLowerCase() : '';
        const marca = insumo.marca ? String(insumo.marca).toLowerCase() : '';
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
    localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
    document.getElementById('form-insumo').reset();
    renderInsumos();
    calcularTodo();
    Swal.fire({ title: '¡Añadido!', text: 'Insumo guardado localmente.', icon: 'success', confirmButtonColor: '#3b82f6' });
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

    // 🌟 AGREGADO: Pantalla de carga para guardar ingrediente
    Swal.fire({
        title: 'Guardando ingrediente...',
        text: 'Subiendo datos a NEXI Cloud.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
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
            localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
            document.getElementById('form-insumo').reset();
            renderInsumos();
            calcularTodo();
            evaluarEstadoVisualPremium();
            
            // Reemplazamos el loading por Éxito
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

    // 🛡️ FILTRO DE SEGURIDAD AVANZADO PARA CANTIDAD Y PRECIO
    if (campo === 'precio' || campo === 'cantidad') { 
        // Convertimos a string por seguridad, limpiamos letras/espacios y cambiamos comas por puntos
        let valorLimpio = String(valor).replace(/,/g, '.').replace(/[^0-9.]/g, '');
        const valorNumerico = parseFloat(valorLimpio);
        
        // Si no es un número real, o es menor/igual a cero, disparamos alerta y restauramos
        if (isNaN(valorNumerico) || valorNumerico <= 0) {
            Swal.fire({
                title: 'Valor inválido ⚠️',
                text: 'Por favor, introduce un número válido y mayor a cero.',
                icon: 'warning',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3500
            });
            
            // Si tenemos la referencia del input, le regresamos el valor que tenía guardado el objeto
            if (inputElement) {
                inputElement.value = insumo[campo];
            }
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
    // Buscamos el insumo localmente para obtener su nombre y hacerlo más personalizado
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

        // Pantalla de carga inmediata tras confirmar
        Swal.fire({
            title: 'Eliminando ingrediente...',
            text: 'Removiendo datos de NEXI Cloud. Por favor espera.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
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

    // Código de limpieza local existente
    insumos = insumos.filter(i => String(i.id) !== String(id));
    for(let key in modulos) { modulos[key] = modulos[key].filter(r => String(r.insumoId) !== String(id)); }
    localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
    renderInsumos();
    renderModulos();
    calcularTodo();
    evaluarEstadoVisualPremium();

    // ÉXITO: Sobreescribe la carga con el mensaje final
    Swal.fire({ 
        title: 'Eliminado', 
        text: 'El insumo ha sido eliminado correctamente.', 
        icon: 'success', 
        confirmButtonColor: '#3b82f6' 
    });
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
    const t = texto.toLowerCase().trim();
    const select = document.getElementById('receta-insumo-select');
    select.innerHTML = '<option value="" disabled selected>🔹 Seleccione un insumo...</option>';
    
    const filtrados = insumos.filter(i => i.nombre.toLowerCase().includes(t) || (i.marca && i.marca.toLowerCase().includes(t)));
    
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
    document.getElementById('buscador-receta').value = "";
    actualizarSelectReceta();
    document.getElementById('form-receta').reset();
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
    
    // 1. Costo base solo de los ingredientes consumidos
    const subtotalInsumos = costoPan + costoRelleno + costoBetun; 
    
    // 2. Calcular indirectos sobre los insumos
    const porcentajeId = (config.porcentajeIndirectos !== undefined ? config.porcentajeIndirectos : 0) / 100;
    const indirectos = subtotalInsumos * porcentajeId; 
    
    // Costo de Alimento Total (Food Cost + Indirectos)
    const costoAlimentoTotal = subtotalInsumos + indirectos;

    // 3. Calcular Mano de Obra por separado
    const horasMOInput = document.getElementById('mo-horas').value;
    // 2. Convertimos comas a puntos (por si usan teclados en español "2,5") y pasamos a decimal
    const horasMO = parseFloat(String(horasMOInput).replace(',', '.')) || 0;

    const precioHoraMO = parseFloat(document.getElementById('mo-precio-hora').value) || 0;
    const totalManoObra = horasMO * precioHoraMO;

    // El costo real de producción física real
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
    
    // --- 🎯 AJUSTE DE MÁRGENES PROFESIONALES ---
    // Multiplicamos la materia prima por el factor de diseño (para cubrir desperdicios invisibles, local y utilidad de empresa)
    // Y le SUMAMOS la mano de obra al final para que no se multiplique exponencialmente.
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

function rebuildSelectPlantillas() {
    const select = document.getElementById('select-plantillas');
    if(!select) return;
    select.innerHTML = '<option value="">-- Cargar Receta Guardada --</option>';
    Object.keys(plantillasRecetas).forEach(k => {
        const opt = document.createElement('option'); opt.value = k; opt.textContent = k; select.appendChild(opt);
    });
}

async function guardarPlantillaNube() {
    const nombre = document.getElementById('nombre-plantilla').value.trim();
    if (!nombre) {
        Swal.fire({ title: 'Falta nombre', text: 'Por favor, ingresa un nombre para guardar la receta.', icon: 'warning', confirmButtonColor: '#3b82f6' });
        return;
    }
    
    if (modulos.pan.length === 0 && modulos.relleno.length === 0 && modulos.betun.length === 0) {
        Swal.fire({ title: 'Receta Vacía', text: 'No puedes guardar una plantilla sin ingredientes. Agrega componentes al pan, relleno o betún primero.', icon: 'warning', confirmButtonColor: '#3b82f6' });
        return;
    }
    
    plantillasRecetas[nombre] = JSON.parse(JSON.stringify(modulos));
    localStorage.setItem('respaldo_plantillas', JSON.stringify(plantillasRecetas));
    rebuildSelectPlantillas();
    document.getElementById('nombre-plantilla').value = "";

    if (config.isPremium && config.urlNube) {
        cambiarBannerStatus("⏳ Respaldando receta en la nube...", true);

        // 🌟 AGREGADO: Pantalla de carga para guardar la receta completa
        Swal.fire({
            title: 'Subiendo receta...',
            text: 'Guardando composición del pastel en tu cuenta remota.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const resultado = await apiFetch(config.urlNube, {
                correo: config.correoUser,
                token: config.tokenUser,
                accion: "guardarPlantilla",
                nombreReceta: nombre,
                estructuraJson: JSON.stringify(modulos)
            });
            if (resultado.status === "success") {
                evaluarEstadoVisualPremium();
                // Éxito reemplaza loading
                Swal.fire({ title: '¡Guardada!', text: 'Receta guardada y sincronizada en NEXI Cloud.', icon: 'success', confirmButtonColor: '#3b82f6' });
            } else {
                Swal.fire({ title: 'Error', text: 'Error de almacenamiento: ' + resultado.message, icon: 'error', confirmButtonColor: '#3b82f6' });
            }
        } catch(e) {
            Swal.fire({ title: 'Error de Red', text: 'No hay conexión remota disponible. La receta se mantendrá guardada de forma local.', icon: 'warning', confirmButtonColor: '#3b82f6' });
        }
    } else {
        // Éxito instantáneo para usuarios locales
        Swal.fire({ title: '¡Guardada!', text: 'Receta guardada localmente.', icon: 'success', confirmButtonColor: '#3b82f6' });
    }
}

function cargarPlantilla(nombre) {
    if(!nombre || !plantillasRecetas[nombre]) return;
    modulos = JSON.parse(JSON.stringify(plantillasRecetas[nombre]));
    renderModulos();
    calcularTodo();
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

        // 🌟 AGREGADO: Pantalla de carga para la eliminación de receta
        Swal.fire({
            title: 'Borrando receta...',
            text: 'Eliminando composición de NEXI Cloud. Por favor espera.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
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

    // Código de limpieza local existente
    delete plantillasRecetas[nombre];
    localStorage.setItem('respaldo_plantillas', JSON.stringify(plantillasRecetas));
    rebuildSelectPlantillas();
    limpiarComposicionCompleta();
    evaluarEstadoVisualPremium();

    // 🌟 ÉXITO: Quita el loader y avisa al usuario de la eliminación correcta
    Swal.fire({ 
        title: 'Receta Eliminada', 
        text: `La receta "${nombre}" fue eliminada correctamente.`, 
        icon: 'success', 
        confirmButtonColor: '#3b82f6' 
    });
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
        const data = await apiGet(config.urlNube, config.correoUser, config.tokenUser);

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
            
            localStorage.setItem('respaldo_insumos', JSON.stringify(insumos));
        }
        
        if (data.plantillas) {
            const plantillasLocalesRaw = localStorage.getItem('respaldo_plantillas');
            let plantillasLocales = plantillasLocalesRaw ? JSON.parse(plantillasLocalesRaw) : {};
            
            plantillasRecetas = { ...data.plantillas, ...plantillasLocales };
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

        cambiarBannerStatus(`☁️ Conectado como: ${config.correoUser} (NEXI Cloud Activo)`, true);
    } catch(e) {
        cambiarBannerStatus("❌ Error de conexión con el servidor NEXI", false);
    }
}

// Inicialización de la App al cargar la ventana
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
    
    // 🟢 CORRECCIÓN: Validamos si explícitamente está en "block" o si está vacío (por defecto inicial)
    // Si ya está abierto, lo ocultamos.
    if (cuerpo.style.display === "block" || cuerpo.style.display === "") {
        cuerpo.style.display = "none";
        if(flecha) flecha.style.transform = 'rotate(0deg)';
    } else {
        // Si estaba en "none", lo mostramos al primer toque.
        cuerpo.style.display = "block";
        if(flecha) flecha.style.transform = 'rotate(180deg)';
    }
}
