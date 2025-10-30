// Limpiar datos del carrito después del pago exitoso
document.addEventListener('DOMContentLoaded', function() {
    console.log('Página de confirmación de pago cargada');
    
    // Limpiar el carrito y datos de checkout
    limpiarDatosCompra();
    
    // Mostrar mensaje en consola (opcional)
    console.log('¡Pago completado exitosamente!');
});

function limpiarDatosCompra() {
    try {
        // Limpiar todos los datos relacionados con la compra
        localStorage.removeItem('carrito');
        localStorage.removeItem('carritoCheckout');
        localStorage.removeItem('orderData');
        sessionStorage.removeItem('carritoCheckout');
        
        // Limpiar cookies si existen
        document.cookie = 'carritoCheckout=; max-age=0; path=/';
        document.cookie = 'carrito=; max-age=0; path=/';
        
        console.log('Datos de compra limpiados exitosamente');
    } catch (error) {
        console.error('Error al limpiar datos de compra:', error);
    }
}