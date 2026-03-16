// ===== Rounded Favicon from logo.png =====
(function () {
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
            const link = document.getElementById('favicon') || document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/png';
            link.href = canvas.toDataURL('image/png');
            if (!link.id) { link.id = 'favicon'; document.head.appendChild(link); }
        } catch (e) {
            console.warn('Favicon canvas skipped (CORS):', e.message);
        }
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
                if (textarea) textarea.focus();
            }, 500);
        }
    };

    const autoTimer = setTimeout(finishSplash, SPLASH_DURATION);

    // --- KEYBOARD & INTERACTION LOGIC ---
    if (splashScreen && SPLASH_DURATION > 0) {

        // Function to request keyboard focus
        const requestKeyboard = () => {
            const textarea = document.getElementById('chatTextarea');
            const main = document.getElementById('mainContent');
            if (textarea) {
                // Make mainContent "visible" to the browser focus engine
                if (main && getComputedStyle(main).opacity === '0') {
                    main.style.opacity = '1';
                }
                textarea.focus();
            }
        };

        // Capture ANY click/touch on the splash screen to open keyboard
        splashScreen.addEventListener('mousedown', requestKeyboard);
        splashScreen.addEventListener('touchstart', (e) => {
            requestKeyboard();
        }, { passive: true });

        // --- PWA AUTO-FOCUS (Method 2) ---
        // PWAs have looser restrictions. Try focusing immediately.
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (isPWA) {
            // Attempt multiple times during the animation
            setTimeout(requestKeyboard, 100);
            setTimeout(requestKeyboard, 1000);
        }

        // --- DRAWING PROGRESS (Optional interaction) ---
        let drawing = false;
        let lastX = 0, lastY = 0;
        let totalMoved = 0;
        const targetMove = window.innerWidth < 768 ? 400 : 800;

        const handleStart = (x, y) => {
            drawing = true;
            lastX = x;
            lastY = y;
            if (splashLogo) splashLogo.style.animation = 'none';
        };

        const handleMove = (x, y) => {
            if (!drawing || !splashLogo) return;
            const dist = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));
            totalMoved += dist;
            lastX = x;
            lastY = y;
            const progress = Math.min(totalMoved / targetMove, 1);
            splashLogo.style.strokeDashoffset = pathLength * (1 - progress);
            if (progress > 0.8) {
                const fillAlpha = (progress - 0.8) / 0.2;
                splashLogo.style.fill = `rgba(0, 0, 0, ${fillAlpha})`;
            }
            if (progress >= 1) {
                drawing = false;
                clearTimeout(autoTimer);
                setTimeout(finishSplash, 300);
            }
        };

        splashScreen.addEventListener('mousedown', e => handleStart(e.clientX, e.clientY));
        window.addEventListener('mousemove', e => handleMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => drawing = false);

        splashScreen.addEventListener('touchstart', e => {
            const touch = e.touches[0];
            handleStart(touch.clientX, touch.clientY);
        }, { passive: true });

        window.addEventListener('touchmove', e => {
            if (!drawing) return;
            const touch = e.touches[0];
            handleMove(touch.clientX, touch.clientY);
            // Only prevent default if we are drawing significantly to avoid blocking scroll if any
            if (totalMoved > 10 && e.cancelable) e.preventDefault();
        }, { passive: false });

        window.addEventListener('touchend', () => drawing = false);
    }

    if (document.fonts) {
        document.fonts.ready.then(() => { });
    }
})();
