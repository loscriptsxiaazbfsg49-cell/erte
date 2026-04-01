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
                // Only focus on desktop — on mobile this causes keyboard bugs
                if (window.innerWidth >= 768) {
                    const textarea = document.getElementById('chatTextarea');
                    if (textarea) textarea.focus();
                }
            }, 500);
        }
    };

    // Timer automatique par défaut
    const autoTimer = setTimeout(finishSplash, SPLASH_DURATION);

    // --- L'INTERACTION DESSIN MANUELLE A ÉTÉ RETIRÉE CAR ELLE COUPAIT L'ANIMATION LORS D'UN CLIC ---

    // Gestion des polices (facultatif ici car non bloquant pour le dessin)
    if (document.fonts) {
        document.fonts.ready.then(() => {
            // Polices prêtes
        });
    }
})();
