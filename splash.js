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

    const SPLASH_DURATION = sessionStorage.getItem('skipSplash') ? 0 : 2850;
    if (sessionStorage.getItem('skipSplash')) {
        sessionStorage.removeItem('skipSplash');
    }

    let isFinished = false;
    const finishSplash = () => {
        if (isFinished) return;
        isFinished = true;
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
            const textarea = document.getElementById('chatTextarea');
            if (textarea) textarea.focus();
        } else {
            splash.classList.add('splash-fade-out');
            main.classList.add('content-visible');
            setTimeout(() => {
                splash.remove();
                const textarea = document.getElementById('chatTextarea');
                if (textarea) {
                    // On mobile, focus and click can sometimes trigger the keyboard if called 
                    // right after a user interaction (like drawing or the end of a transition)
                    textarea.focus();
                    textarea.click();

                    // Trick for some mobile browsers: create a virtual tap
                    const event = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    textarea.dispatchEvent(event);
                }
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
            // On stoppe l'animation CSS automatique pour prendre le contrôle manuel
            splashLogo.style.animation = 'none';

            // User hit the screen, perfect moment to request focus for the keyboard
            const textarea = document.getElementById('chatTextarea');
            if (textarea) textarea.focus();
        };

        const moveDrawing = (x, y) => {
            if (!drawing) return;
            const dist = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));
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

        splashScreen.addEventListener('mousedown', e => startDrawing(e.clientX, e.clientY));
        window.addEventListener('mousemove', e => moveDrawing(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => drawing = false);

        splashScreen.addEventListener('touchstart', e => {
            const touch = e.touches[0];
            startDrawing(touch.clientX, touch.clientY);
        }, { passive: false });

        window.addEventListener('touchmove', e => {
            if (!drawing) return;
            const touch = e.touches[0];
            moveDrawing(touch.clientX, touch.clientY);
            e.preventDefault(); // Bloque le scroll pendant le dessin
        }, { passive: false });

        window.addEventListener('touchend', () => drawing = false);
    }

    // Gestion des polices (facultatif ici car non bloquant pour le dessin)
    if (document.fonts) {
        document.fonts.ready.then(() => {
            // Polices prêtes
        });
    }
})();
