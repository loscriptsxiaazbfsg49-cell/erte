// ===== Rounded Favicon from logo.png =====
(function () {
    // Skip canvas favicon on file:// protocol (CORS blocks canvas.toDataURL)
    // The static <link rel="icon" href="logo.png"> in HTML works fine as fallback
    if (window.location.protocol === 'file:') return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
        try {
            const size = 64;
            const radius = 14;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            // Draw rounded rect clip
            ctx.beginPath();
            ctx.moveTo(radius, 0);
            ctx.lineTo(size - radius, 0);
            ctx.quadraticCurveTo(size, 0, size, radius);
            ctx.lineTo(size, size - radius);
            ctx.quadraticCurveTo(size, size, size - radius, size);
            ctx.lineTo(radius, size);
            ctx.quadraticCurveTo(0, size, 0, size - radius);
            ctx.lineTo(0, radius);
            ctx.quadraticCurveTo(0, 0, radius, 0);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, 0, 0, size, size);
            // Set as favicon
            const link = document.getElementById('favicon') || document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/png';
            link.href = canvas.toDataURL('image/png');
            if (!link.id) { link.id = 'favicon'; document.head.appendChild(link); }
        } catch (e) {
            // CORS or canvas error – keep the static favicon
            console.warn('Favicon canvas skipped (CORS):', e.message);
        }
    };
    img.onerror = function () {
        // Image failed to load – keep the static favicon
    };
    img.src = 'logo.png';
})();

// ===== Splash Screen (runs immédiatement) =====
(function () {
    const splashScreen = document.getElementById('splashScreen');
    const splashLogo = document.getElementById('splashLogo');
    let pathLength = 0;

    if (splashLogo) {
        pathLength = splashLogo.getTotalLength();
        splashLogo.style.setProperty('--length', pathLength);
    }

    // Force textarea to cover everything invisibly at the start
    const textarea = document.getElementById('chatTextarea');
    if (textarea && window.innerWidth < 768) {
        textarea.classList.add('capturing-focus');
    }

    const SPLASH_DURATION = sessionStorage.getItem('skipSplash') ? 0 : 2850;
    if (sessionStorage.getItem('skipSplash')) {
        sessionStorage.removeItem('skipSplash');
    }

    let isFinished = false;
    let initialFocusRequested = false;

    // Helper to request focus ONLY ONCE on mobile
    const requestInitialFocus = () => {
        if (initialFocusRequested || window.innerWidth >= 768) return;
        const textarea = document.getElementById('chatTextarea');
        if (textarea) {
            // Keep the full-screen proxy for 300ms AFTER the click 
            // to make sure the mobile browser validates the user action.
            if (textarea.classList.contains('capturing-focus')) {
                initialFocusRequested = true;
                setTimeout(() => {
                    textarea.classList.remove('capturing-focus');
                    textarea.focus();
                    textarea.click();
                }, 300);
            } else {
                textarea.focus();
                textarea.click();
                initialFocusRequested = true;
            }
        }
    };

    const finishSplash = () => {
        if (isFinished) return;
        isFinished = true;

        // Final focus attempt if not done yet
        requestInitialFocus();

        const textarea = document.getElementById('chatTextarea');
        if (textarea) textarea.classList.remove('capturing-focus');

        const splash = document.getElementById('splashScreen');
        const main = document.getElementById('mainContent');
        if (!splash || !main) return;

        if (SPLASH_DURATION === 0) {
            splash.style.transition = 'none';
            splash.style.opacity = '0';
            splash.remove();
            main.style.transition = 'none';
            main.classList.add('content-visible');
            main.style.opacity = '1';
        } else {
            splash.classList.add('splash-fade-out');
            main.classList.add('content-visible');

            // If no user click happened during splash, we still want the cursor visually
            setTimeout(() => {
                if (!initialFocusRequested) requestInitialFocus();
                splash.remove();
            }, 500);
        }
    };

    // Timer automatique par défaut
    const autoTimer = setTimeout(finishSplash, SPLASH_DURATION);

    // --- INTERACTION DESSIN (Mobile & Desktop) ---
    if (splashLogo && splashScreen && SPLASH_DURATION > 0) {
        let drawing = false;
        let lastX = 0, lastY = 0;
        let totalMoved = 0;
        const targetMove = window.innerWidth < 768 ? 400 : 800; // Distance à parcourir pour "dessiner" le logo

        const startDrawing = (x, y) => {
            drawing = true;
            lastX = x;
            lastY = y;
            // On capture le clic pour le clavier sans stopper l'animation CSS si on ne bouge pas
            requestInitialFocus();
        };

        const moveDrawing = (x, y) => {
            if (!drawing) return;
            const dist = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));
            if (dist > 0) {
                // On stoppe l'animation CSS automatique uniquement si on bouge réellement
                splashLogo.style.animation = 'none';
            }
            totalMoved += dist;
            lastX = x;
            lastY = y;

            const progress = Math.min(totalMoved / targetMove, 1);
            // On met à jour le tracé manuellement
            splashLogo.style.strokeDashoffset = pathLength * (1 - progress);

            // Effet de remplissage progressif vers la fin
            if (progress > 0.8) {
                const fillAlpha = (progress - 0.8) / 0.2;
                splashLogo.style.fill = `rgba(0, 0, 0, ${fillAlpha})`;
            }

            if (progress >= 1) {
                drawing = false;
                clearTimeout(autoTimer);
                // On laisse un petit délai pour voir le logo complet avant de foncer
                setTimeout(finishSplash, 300);
            }
        };

        splashScreen.addEventListener('mousedown', e => {
            requestInitialFocus();
            startDrawing(e.clientX, e.clientY);
        });
        window.addEventListener('mousemove', e => moveDrawing(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => {
            requestInitialFocus();
            drawing = false;
        });

        splashScreen.addEventListener('touchstart', e => {
            requestInitialFocus();
            const touch = e.touches[0];
            startDrawing(touch.clientX, touch.clientY);
        }, { passive: false });

        window.addEventListener('touchmove', e => {
            if (!drawing) return;
            const touch = e.touches[0];
            moveDrawing(touch.clientX, touch.clientY);
            e.preventDefault();
        }, { passive: false });

        window.addEventListener('touchend', () => {
            requestInitialFocus();
            drawing = false;
        });
    }

    // Gestion des polices (facultatif ici car non bloquant pour le dessin)
    if (document.fonts) {
        document.fonts.ready.then(() => {
            // Polices prêtes
        });
    }
})();
