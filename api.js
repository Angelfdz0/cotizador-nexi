/**
 * Capa de Abstracción de Red (API Client) - Optimizado para Google Apps Script
 */

async function apiFetch(url, payload) {
    const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',           // 1. Forzar el modo CORS
        redirect: 'follow',     // 2. Seguir las redirecciones 302 de Google
        headers: { 
            "Content-Type": "text/plain" // Mantener como text/plain para evitar solicitudes "preflight" de CORS
        },
        body: JSON.stringify(payload)
    });
    return await response.json();
}

async function apiGet(url, correo, token) {
    const urlConParametros = `${url}?correo=${encodeURIComponent(correo)}&token=${encodeURIComponent(token)}&_=${Date.now()}`;
    const response = await fetch(urlConParametros, { 
        method: 'GET',
        mode: 'cors',
        redirect: 'follow'      // Seguir redirecciones también en lecturas
    });
    return await response.json();
}