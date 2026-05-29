/**
 * Capa de Abstracción de Red (API Client) - Optimizado para Google Apps Script
 */
async function apiFetch(url, payload) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors',           
            redirect: 'follow',     
            headers: { 
                "Content-Type": "text/plain" 
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Error en servidor: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("Error en apiFetch:", error);
        throw error;
    }
}
