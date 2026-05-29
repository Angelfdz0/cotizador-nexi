/**
 * Capa de Abstracción de Red (API Client) - Optimizado para Google Apps Script
 */

async function apiFetch(url, payload) {
    const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',           
        redirect: 'follow',     
        headers: { 
            "Content-Type": "text/plain" 
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
        redirect: 'follow'      
    });
    return await response.json();
}
