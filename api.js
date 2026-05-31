async function apiFetch(url, datos) {
    // Añadimos un número aleatorio al final de la URL para obligar al navegador a no usar caché
    const urlLimpia = url.includes('?') ? `${url}&_cb=${Date.now()}` : `${url}?_cb=${Date.now()}`;

    const respuesta = await fetch(urlLimpia, {
        method: "POST",
        mode: "cors", // Forzamos modo CORS explícito
        headers: { 
            "Content-Type": "text/plain;charset=UTF-8" 
        },
        body: JSON.stringify(datos) // Enviamos JSON puro
    });
    
    if (!respuesta.ok) {
        throw new Error(`Error en el servidor: ${respuesta.status}`);
    }
    
    return await respuesta.json();
}
