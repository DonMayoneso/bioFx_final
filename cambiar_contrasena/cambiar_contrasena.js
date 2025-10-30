document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('passwordForm');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const passwordError = document.getElementById('passwordError');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    const submitButton = form.querySelector('.btn');
    const toggleButtons = document.querySelectorAll('.toggle-password');

    // Función para mostrar/ocultar contraseña
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    // Validar fortaleza de contraseña en tiempo real
    newPasswordInput.addEventListener('input', function() {
        const password = newPasswordInput.value;
        const strength = checkPasswordStrength(password);
        
        updateStrengthIndicator(strength);
        validatePasswords();
    });

    // Validar que las contraseñas coincidan
    confirmPasswordInput.addEventListener('input', validatePasswords);

    // Manejar envío del formulario
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (validateForm()) {
            // Simular envío exitoso
            submitButton.disabled = true;
            submitButton.textContent = 'Cambiando contraseña...';
            
            setTimeout(function() {
                alert('Contraseña cambiada exitosamente');
                window.location.href = '../index.html';
            }, 1500);
        }
    });

    function validateForm() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!currentPassword) {
            alert('Por favor ingresa tu contraseña actual');
            return false;
        }

        if (!validatePasswords()) {
            return false;
        }

        return true;
    }

    function validatePasswords() {
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Limpiar mensaje de error
        passwordError.textContent = '';
        
        // Validar longitud mínima
        if (newPassword.length > 0 && newPassword.length < 8) {
            passwordError.textContent = 'La contraseña debe tener al menos 8 caracteres';
            return false;
        }
        
        // Validar coincidencia
        if (confirmPassword && newPassword !== confirmPassword) {
            passwordError.textContent = 'Las contraseñas no coinciden';
            return false;
        }
        
        return true;
    }

    function checkPasswordStrength(password) {
        let strength = 0;
        
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]+/)) strength++;
        if (password.match(/[A-Z]+/)) strength++;
        if (password.match(/[0-9]+/)) strength++;
        if (password.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/)) strength++;
        
        return strength;
    }

    function updateStrengthIndicator(strength) {
        const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#27ae60'];
        const texts = ['Muy Débil', 'Débil', 'Moderada', 'Fuerte', 'Muy Fuerte'];
        
        strengthBar.style.width = (strength * 20) + '%';
        strengthBar.style.backgroundColor = colors[strength - 1] || colors[0];
        strengthText.textContent = 'Seguridad: ' + (texts[strength - 1] || texts[0]);
    }
});