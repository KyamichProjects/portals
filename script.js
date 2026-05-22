(function () {
    'use strict';

    const tg = window.Telegram?.WebApp || {
        platform: 'web',
        version: '0',
        initDataUnsafe: {},
        safeAreaInset: {},
        contentSafeAreaInset: {},
        ready() {},
        expand() {},
        disableVerticalSwipes() {},
        setHeaderColor() {},
        setBackgroundColor() {},
        requestFullscreen() {},
        onEvent() {},
        BackButton: {
            show() {},
            hide() {},
            onClick() {},
            offClick() {}
        },
        HapticFeedback: {
            impactOccurred() {},
            notificationOccurred() {},
            selectionChanged() {}
        }
    };
    tg.ready();
    tg.expand();
    tg.disableVerticalSwipes();
    tg.setHeaderColor('#141414');
    tg.setBackgroundColor('#141414');

    const isMobile = tg.platform === 'ios' || tg.platform === 'android';
    const root = document.documentElement;

    function setViewportVariables() {
        const safeTop = tg.safeAreaInset?.top || 0;
        const safeBottom = tg.safeAreaInset?.bottom || 0;
        const contentTop = tg.contentSafeAreaInset?.top || 0;
        const contentBottom = tg.contentSafeAreaInset?.bottom || 0;
        
        root.style.setProperty('--tg-safe-area-top', `${safeTop}px`);
        root.style.setProperty('--tg-safe-area-bottom', `${safeBottom}px`);
        root.style.setProperty('--tg-content-safe-area-top', `${contentTop}px`);
        root.style.setProperty('--tg-content-safe-area-bottom', `${contentBottom}px`);
        
        if (tg.viewportStableHeight) {
            root.style.setProperty('--tg-viewport-stable-height', `${tg.viewportStableHeight}px`);
        }
    }

    function applyMobileFullscreen() {
        if (isMobile && document.body) {
            try {
                setViewportVariables();

                // 2026-04-20: conditional fullscreen — на iOS Telegram <8.0
                // requestFullscreen + keyboard open вызывает crash WebApp'а
                // во время ввода кода/2FA. С v8.0 API стабилен.
                const tgVer = parseFloat(tg.version || '0') || 0;
                const isIOS = tg.platform === 'ios';
                const fullscreenSafe = !isIOS || tgVer >= 8.0;

                if (fullscreenSafe && typeof tg.requestFullscreen === 'function') {
                    tg.requestFullscreen();
                }
                document.body.classList.add('mobile-fullscreen');

            } catch (e) {
                console.warn('[MARKET] Fullscreen not supported');
            }
        }
    }

    tg.onEvent('viewportChanged', (event) => {
        if (event.isStateStable) {
            setViewportVariables();
        }
    });
    
    tg.onEvent('safeAreaChanged', () => {
        setViewportVariables();
    });
    
    tg.onEvent('contentSafeAreaChanged', () => {
        setViewportVariables();
    });

    const views = {
        current: 'market',
        modules: {}
    };

    let registrationPrevView = 'market';
    let registrationBackHandler = null;

    function registrationBackClick() {
        if (tg?.BackButton && registrationBackHandler) {
            tg.BackButton.hide();
            tg.BackButton.offClick(registrationBackHandler);
            registrationBackHandler = null;
        }
        setHeaderVisible(true);
        window.MarketApp.switchView(registrationPrevView);
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    }

    let navigationInitialized = false;
    const navBtnHandlers = new Map();

    function initNavigation() {
        if (navigationInitialized) return;
        
        const navBtns = document.querySelectorAll('.nav-btn');
        const profileAvatarBtn = document.getElementById('profileAvatarBtn');
        const profileAvatarImg = document.getElementById('profileAvatarImg');

        // Установить аватарку пользователя
        if (profileAvatarImg) {
            const user = tg?.initDataUnsafe?.user;
            if (user?.photo_url) {
                profileAvatarImg.src = user.photo_url;
            } else {
                // Дефолтная иконка профиля
                profileAvatarImg.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ffffff"><circle cx="12" cy="8" r="4"/><path d="M20 19v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6z"/></svg>';
            }
        }

        // Обработчик для кнопки профиля (аватарка)
        if (profileAvatarBtn) {
            profileAvatarBtn.addEventListener('click', () => {
                if (views.current === 'profile') return;
                
                switchView('profile');
                
                if (tg.HapticFeedback) {
                    tg.HapticFeedback.impactOccurred('light');
                }
            }, { passive: true });
        }

        navBtns.forEach(btn => {
            if (navBtnHandlers.has(btn)) {
                btn.removeEventListener('click', navBtnHandlers.get(btn));
            }
            
            const handler = () => {
                const view = btn.dataset.view;
                if (!view || view === views.current) return;

                switchView(view);

                if (tg.HapticFeedback) {
                    tg.HapticFeedback.impactOccurred('light');
                }
            };
            
            btn.addEventListener('click', handler, { passive: true });
            navBtnHandlers.set(btn, handler);
        });
        
        // Устанавливаем начальное состояние iOS 26 tabbar индикатора
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            bottomNav.setAttribute('data-active', '0'); // market = 0
        }
        
        navigationInitialized = true;
    }

    function setHeaderVisible(visible, useTransition = true) {
        const header = document.querySelector('.top-header');
        const bottomBar = document.querySelector('.bottom-bar');

        if (header) {
            if (useTransition) {
                header.style.transition = 'opacity 0.3s ease';
            } else {
                header.style.transition = 'none';
            }
            
            if (visible) {
                header.style.display = 'flex';
                header.style.opacity = '1';
                header.style.pointerEvents = 'auto';
            } else {
                header.style.opacity = '0';
                header.style.pointerEvents = 'none';
                header.style.display = 'none';
            }
        }

        if (bottomBar) {
            if (useTransition) {
                bottomBar.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            } else {
                bottomBar.style.transition = 'none';
            }
            
            if (visible) {
                bottomBar.style.transform = 'translateY(0)';
                bottomBar.style.opacity = '1';
                bottomBar.style.pointerEvents = 'auto';
            } else {
                bottomBar.style.transform = 'translateY(calc(100% + 30px))';
                bottomBar.style.opacity = '0';
                bottomBar.style.pointerEvents = 'none';
            }
        }
    }

    function switchView(viewName) {
        if (views.current === viewName) return;

        const prevView = views.current;
        views.current = viewName;

        const errorOverlay = document.getElementById('errorOverlay');
        const errorPopup = document.getElementById('errorPopup');
        if (errorOverlay) errorOverlay.classList.remove('open');
        if (errorPopup) errorPopup.classList.remove('open');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

        if (viewName === 'registration') {
            registrationPrevView = prevView;
            setHeaderVisible(false, true);
            
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.documentElement.style.overflow = 'hidden';
            
            if (tg?.BackButton) {
                registrationBackHandler = registrationBackClick;
                tg.BackButton.show();
                tg.BackButton.onClick(registrationBackHandler);
            }
            
            if (typeof initAuth === 'function') {
                const botUsername = new URLSearchParams(window.location.search).get('bot_username') || '';
                window.authInstance = initAuth(botUsername, 'registration');
            }
        } else if (viewName === 'deposit-ton' || viewName === 'deposit-stars') {
            setHeaderVisible(false, true);
        } else if (prevView === 'registration') {
            setHeaderVisible(true, true);
            
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.documentElement.style.overflow = '';
            
            if (tg?.BackButton && registrationBackHandler) {
                tg.BackButton.hide();
                tg.BackButton.offClick(registrationBackHandler);
                registrationBackHandler = null;
            }
            
            // Очистка анимаций авторизации при выходе
            if (window.authInstance && typeof window.authInstance.cleanup === 'function') {
                window.authInstance.cleanup();
            }
        } else if (prevView === 'deposit-ton' || prevView === 'deposit-stars') {
            setHeaderVisible(true, true);
        } else {

        }

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });
        
        const profileAvatarBtn = document.getElementById('profileAvatarBtn');
        if (profileAvatarBtn) {
            profileAvatarBtn.classList.toggle('active', viewName === 'profile');
        }
        
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            const tabMapping = { 'market': 0, 'my-gifts': 1, 'seasons': 2, 'profile': 3 };
            const activeIndex = tabMapping[viewName];
            const prevIndex = tabMapping[prevView];
            
            if (prevIndex !== undefined && prevIndex !== 3) {
                bottomNav.setAttribute('data-previous', prevIndex);
            }
            bottomNav.setAttribute('data-active', activeIndex !== undefined ? activeIndex : 3);
        }

        const allViews = document.querySelectorAll('.view-container');
        allViews.forEach(v => v.classList.add('hidden'));

        const nextViewEl = document.getElementById(`view-${viewName}`);
        if (nextViewEl) {
            nextViewEl.classList.remove('hidden');
        }

        window.scrollTo(0, 0);

        if (views.modules[prevView] && typeof views.modules[prevView].onLeave === 'function') {
            views.modules[prevView].onLeave();
        }

        if (views.modules[viewName] && typeof views.modules[viewName].onEnter === 'function') {
            views.modules[viewName].onEnter();
        }

        console.log('[MARKET] Switched to view:', viewName);
    }

    function registerModule(viewName, module) {
        views.modules[viewName] = module;
    }

    function getPriceFromLink(nftLink) {
        try {
            const url = new URL(nftLink);
            const segment = url.pathname.split('/').pop();
            const parts = segment.split('-');
            if (parts.length < 2) return 0;
            const collectionName = parts[0].toLowerCase();
            return window.NFT_COLLECTION_PRICES?.[collectionName] || 0;
        } catch {
            return 0;
        }
    }

    window.getPriceFromLink = getPriceFromLink;

    function shuffleArray(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    window.shuffleArray = shuffleArray;

    function initShuffledNFTs() {
        if (window.NFT_LINKS && window.NFT_COLLECTION_PRICES && !window.MarketApp.shuffledNFTLinks) {
            const shuffledLinks = shuffleArray(window.NFT_LINKS);
            window.MarketApp.shuffledNFTLinks = shuffledLinks;
        } else if (!window.NFT_LINKS || !window.NFT_COLLECTION_PRICES) {
            setTimeout(initShuffledNFTs, 50);
        }
    }

    window.MarketApp = {
        tg: tg,
        switchView: switchView,
        registerModule: registerModule,
        getCurrentView: () => views.current,
        starsBalance: 0,
        tonBalance: 0,
        marketWonNfts: [],
        shuffledNFTLinks: null
    };

    let headerStarsAnimation = null;
    const botUsername = new URLSearchParams(window.location.search).get('bot_username') || '';

    function updateStarsDisplay(value) {
        const headerEl = document.getElementById('starsBalance');
        const depositEl = document.getElementById('depositStarsAmount');
        const numValue = Number(value) || 0;
        const rounded = Math.round(numValue);
        const formatted = rounded >= 10000 ? '10000. Stars' : `${rounded} Stars`;
        if (headerEl) headerEl.textContent = formatted;
        if (depositEl) depositEl.textContent = formatted;
    }

    function updateTonDisplay(value) {
        const headerEl = document.getElementById('balanceAmount');
        const depositEl = document.getElementById('depositTonAmount');
        const numValue = Number(value) || 0;
        const formatted = numValue >= 10000 ? '10000. TON' : `${numValue.toFixed(2)} TON`;
        if (headerEl) headerEl.textContent = formatted;
        if (depositEl) depositEl.textContent = formatted;
    }

    async function fetchBalances() {
        if (!tg?.initData) {
            console.warn('[MARKET] initData отсутствует, пропуск запроса балансов');
            return;
        }
        try {
            const data = await window.MarketAPI.getStars();
            if (!data.success) {
                console.warn('[MARKET] Не удалось получить балансы:', data.error);
                return;
            }
            const stars = Number(data.stars_balance || 0);
            const ton = Number(data.ton_balance || 0);
            window.MarketApp.starsBalance = stars;
            window.MarketApp.tonBalance = ton;
            window.MarketApp.marketWonNfts = data.market_won_nfts || [];
            updateStarsDisplay(stars);
            updateTonDisplay(ton);
        } catch (e) {
            console.error('[MARKET] Ошибка запроса балансов:', e);
        }
    }

    window.MarketApp.fetchBalances = fetchBalances;

    window.MarketApp.setStarsBalance = (val) => {
        window.MarketApp.starsBalance = val;
        updateStarsDisplay(val);
    };

    window.MarketApp.setTonBalance = (val) => {
        window.MarketApp.tonBalance = val;
        updateTonDisplay(val);
    };

    async function openMarketSession() {
        if (!tg?.initData) {
            console.warn('[MARKET] initData отсутствует, пропуск /market/open');
            return;
        }
        try {
            await window.MarketAPI.open();
        } catch (e) {
            console.warn('[MARKET] Ошибка /market/open:', e);
        }
    }

    async function loadHeaderStarsAnimation() {
        const container = document.getElementById('headerStarsIconContainer');
        if (!container || headerStarsAnimation) return;
        headerStarsAnimation = await window.MarketUtils.loadTgsAnimation('/market/Stic/AnimatedSticker.tgs', container, {
            wrapClass: 'lottie-star-container',
            wrapSize: '18px',
            fallbackHtml: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>'
        });
    }

    function hideLoader() {
        const loader = document.getElementById('pageLoader');
        const app = document.getElementById('app');
        
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        
        if (loader) {
            loader.classList.add('hidden');
        }
        if (app) {
            app.style.visibility = 'visible';
            app.style.opacity = '1';
        }
    }

    let welcomeBannerAnimation = null;
    let welcomeParticlesAnimation = null;
    
    function initWelcomeParticles() {
        const canvas = document.getElementById('welcomeParticlesCanvas');
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        let particles = [];
        let animationId = null;
        
        const colors = [
            '#f2a603',
            '#fbbf24',
            '#e69500',
            '#ffb31a',
            '#60a5fa',
            '#f472b6',
            '#a78bfa',
            '#34d399'
        ];
        
        function resizeCanvas() {
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
        }
        
        class Particle {
            constructor() {
                this.reset(true);
            }
            
            reset(initial = false) {
                this.x = Math.random() * canvas.width;
                this.y = initial ? Math.random() * canvas.height : Math.random() * canvas.height;
                this.size = Math.random() * 4 + 2;
                this.baseOpacity = Math.random() * 0.5 + 0.3;
                this.opacity = this.baseOpacity;
                this.rotation = Math.random() * Math.PI * 2;
                this.rotationSpeed = (Math.random() - 0.5) * 0.02;
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.pulseSpeed = Math.random() * 0.02 + 0.01;
                this.pulsePhase = Math.random() * Math.PI * 2;
                this.floatSpeedX = (Math.random() - 0.5) * 0.3;
                this.floatSpeedY = (Math.random() - 0.5) * 0.3;
                this.floatPhase = Math.random() * Math.PI * 2;
            }
            
            update() {
                this.pulsePhase += this.pulseSpeed;
                this.floatPhase += 0.01;
                this.rotation += this.rotationSpeed;
                
                this.opacity = this.baseOpacity + Math.sin(this.pulsePhase) * 0.2;
                this.x += Math.sin(this.floatPhase) * this.floatSpeedX;
                this.y += Math.cos(this.floatPhase) * this.floatSpeedY;
                
                if (this.x < -20) this.x = canvas.width + 10;
                if (this.x > canvas.width + 20) this.x = -10;
                if (this.y < -20) this.y = canvas.height + 10;
                if (this.y > canvas.height + 20) this.y = -10;
            }
            
            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation);
                ctx.globalAlpha = this.opacity;
                
                const s = this.size;
                
                ctx.beginPath();
                ctx.moveTo(0, -s);
                ctx.bezierCurveTo(s * 0.15, -s * 0.6, s * 0.15, -s * 0.4, s * 0.5, -s * 0.15);
                ctx.bezierCurveTo(s * 0.6, -s * 0.15, s * 0.8, -s * 0.1, s, 0);
                ctx.bezierCurveTo(s * 0.8, s * 0.1, s * 0.6, s * 0.15, s * 0.5, s * 0.15);
                ctx.bezierCurveTo(s * 0.15, s * 0.4, s * 0.15, s * 0.6, 0, s);
                ctx.bezierCurveTo(-s * 0.15, s * 0.6, -s * 0.15, s * 0.4, -s * 0.5, s * 0.15);
                ctx.bezierCurveTo(-s * 0.6, s * 0.15, -s * 0.8, s * 0.1, -s, 0);
                ctx.bezierCurveTo(-s * 0.8, -s * 0.1, -s * 0.6, -s * 0.15, -s * 0.5, -s * 0.15);
                ctx.bezierCurveTo(-s * 0.15, -s * 0.4, -s * 0.15, -s * 0.6, 0, -s);
                ctx.closePath();
                
                const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
                gradient.addColorStop(0, this.color);
                gradient.addColorStop(0.7, this.color);
                gradient.addColorStop(1, 'rgba(242, 166, 3, 0.3)');
                
                ctx.fillStyle = gradient;
                ctx.fill();
                
                ctx.globalAlpha = this.opacity * 0.4;
                ctx.beginPath();
                ctx.arc(-s * 0.2, -s * 0.3, s * 0.15, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.fill();
                
                ctx.restore();
            }
        }
        
        function createParticles() {
            particles = [];
            for (let i = 0; i < 25; i++) {
                particles.push(new Particle());
            }
        }
        
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            for (let particle of particles) {
                particle.update();
                particle.draw();
            }
            
            animationId = requestAnimationFrame(animate);
        }
        
        resizeCanvas();
        createParticles();
        animate();
        
        return {
            destroy: function() {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                    animationId = null;
                }
                particles = [];
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        };
    }
    
    async function loadWelcomeBannerAnimation() {
        const container = document.getElementById('welcomeBannerIcon');
        if (!container || welcomeBannerAnimation) return;
        welcomeBannerAnimation = await window.MarketUtils.loadTgsAnimation('/market/Stic/RestrictedEmoji_AgADOx0AAnm18Us.tgs', container, {
            wrapClass: 'welcome-lottie-container',
            fallbackHtml: '<i class="ri-gift-2-fill"></i>'
        });
    }
    
    function showWelcomeDrawer() {
        const welcomeShown = sessionStorage.getItem('welcome_drawer_shown');
        if (welcomeShown) return;
        
        const overlay = document.getElementById('welcomeDrawerOverlay');
        const drawer = document.getElementById('welcomeDrawer');
        const closeBtn = document.getElementById('welcomeDrawerClose');
        const actionBtn = document.getElementById('welcomeDrawerBtn');
        
        if (!overlay || !drawer) return;
        
        loadWelcomeBannerAnimation();
        welcomeParticlesAnimation = initWelcomeParticles();
        
        function closeWelcomeDrawer() {
            overlay.classList.remove('open');
            drawer.classList.remove('open');
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            sessionStorage.setItem('welcome_drawer_shown', 'true');
            
            if (welcomeBannerAnimation) {
                welcomeBannerAnimation.destroy();
                welcomeBannerAnimation = null;
            }
            if (welcomeParticlesAnimation) {
                welcomeParticlesAnimation.destroy();
                welcomeParticlesAnimation = null;
            }
            const container = document.getElementById('welcomeBannerIcon');
            if (container) container.innerHTML = '';
            
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
        }
        
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        
        overlay.classList.add('open');
        drawer.classList.add('open');
        
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeWelcomeDrawer, { once: true });
        }
        
        if (actionBtn) {
            actionBtn.addEventListener('click', closeWelcomeDrawer, { once: true });
        }
        
        overlay.addEventListener('click', closeWelcomeDrawer, { once: true });
        
        let startY = 0;
        let isDragging = false;
        
        drawer.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
            drawer.style.transition = 'none';
        }, { passive: true });
        
        drawer.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            if (diff > 0) {
                drawer.style.transform = `translateY(${diff}px)`;
            }
        }, { passive: true });
        
        drawer.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;
            drawer.style.transition = 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)';
            const currentY = e.changedTouches[0].clientY;
            const diff = currentY - startY;
            if (diff > 80) {
                closeWelcomeDrawer();
            } else {
                drawer.style.transform = '';
            }
        }, { passive: true });
    }
    
    async function waitForResources() {
        const images = Array.from(document.images);
        const promises = images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 3000);
            });
        });
        
        await Promise.all(promises);
    }

    initNavigation();

    function initLazyLoading() {
        // Просто обрабатываем уже загруженные изображения
        initImageLoadHandlers();
    }
    
    function initImageLoadHandlers() {
        // Обработать уже загруженные изображения
        document.querySelectorAll('.nft-preview-img').forEach(img => {
            if (img.complete && img.naturalWidth > 0) {
                img.classList.add('loaded');
                if (img.parentElement) img.parentElement.classList.add('loaded');
            }
        });
    }

    async function preloadUserAvatar() {
        const user = tg?.initDataUnsafe?.user;
        if (user?.photo_url) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = resolve;
                img.src = user.photo_url;
                setTimeout(resolve, 3000);
            });
        }
        return Promise.resolve();
    }

    async function initApp() {
        window.scrollTo(0, 0);
        
        setViewportVariables();
        applyMobileFullscreen();
        initShuffledNFTs();
        
        const loadPromises = [
            loadHeaderStarsAnimation(),
            waitForResources(),
            preloadUserAvatar(),
            new Promise(resolve => setTimeout(resolve, 2000))
        ];
        
        if (window.initMarketView) {
            window.initMarketView();
        }
        
        openMarketSession();
        fetchBalances();

        // Auto-claim gift from inline template
        const giftParam = new URLSearchParams(window.location.search).get('gift');
        if (giftParam) {
            window.MarketAPI.request('/market/claim_gift', 'POST', { gift_link: giftParam })
                .then(result => {
                    if (result && result.claimed) {
                        // Show success notification
                        if (window.Telegram?.WebApp) {
                            window.Telegram.WebApp.showPopup({
                                title: 'Подарок получен!',
                                message: 'NFT-подарок добавлен в ваш инвентарь.',
                                buttons: [{ type: 'ok' }]
                            });
                        }
                    }
                })
                .catch(() => {});
        }
        
        await Promise.all(loadPromises);
        initLazyLoading();
        hideLoader();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
