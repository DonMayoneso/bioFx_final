document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('recoveryForm');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const submitButton = form.querySelector('.btn');
    const successMessage = document.getElementById('successMessage');

    // Validar email en tiempo real
    emailInput.addEventListener('input', function() {
        validateEmail();
    });

    // Manejar envío del formulario
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (validateForm()) {
            // Simular envío del correo
            submitButton.disabled = true;
            submitButton.textContent = 'Enviando...';
            
            setTimeout(function() {
                // Mostrar mensaje de éxito
                form.style.display = 'none';
                successMessage.style.display = 'block';
                
                // Opcional: Redirigir después de un tiempo
                setTimeout(function() {
                    window.location.href = '../index.html';
                }, 5000);
            }, 2000);
        }
    });

    function validateForm() {
        const email = emailInput.value.trim();
        
        if (!email) {
            showError('Por favor ingresa tu correo electrónico');
            return false;
        }
        
        if (!isValidEmail(email)) {
            showError('Por favor ingresa un correo electrónico válido');
            return false;
        }
        
        return true;
    }

    function validateEmail() {
        const email = emailInput.value.trim();
        
        if (!email) {
            clearError();
            return false;
        }
        
        if (!isValidEmail(email)) {
            showError('Por favor ingresa un correo electrónico válido');
            return false;
        }
        
        clearError();
        return true;
    }

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function showError(message) {
        emailError.textContent = message;
        emailInput.style.borderColor = 'var(--error)';
    }

    function clearError() {
        emailError.textContent = '';
        emailInput.style.borderColor = '#ddd';
    }
});