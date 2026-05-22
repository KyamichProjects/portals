(function () {
    'use strict';

    if (!window.MarketApp) {
        console.error('[SEASONS] MarketApp not initialized');
        return;
    }

    const tg = window.MarketApp.tg;
    let rocketAnimation = null;
    let starAnimations = [];
    let getButtonsInitialized = false;

    async function loadRocketAnimation() {
        const container = document.getElementById('seasonsRocketContainer');
        if (!container || rocketAnimation) return;
        rocketAnimation = await window.MarketUtils.loadTgsAnimation('/market/Stic/rocet.tgs', container, {
            fallbackHtml: '<div style="font-size: 64px;">🚀</div>'
        });
    }

    async function loadStarAnimations() {
        const containers = document.querySelectorAll('.seasons-star-lottie');
        if (containers.length === 0) return;
        destroyStarAnimations();

        try {
            const response = await fetch('/market/Stic/AnimatedSticker.tgs');
            if (!response.ok) throw new Error('Failed to load star TGS');
            const arrayBuffer = await response.arrayBuffer();
            const ds = new DecompressionStream('gzip');
            const decompressed = await new Response(
                new Blob([arrayBuffer]).stream().pipeThrough(ds)
            ).arrayBuffer();
            const animationData = JSON.parse(new TextDecoder().decode(decompressed));

            containers.forEach(container => {
                if (typeof lottie !== 'undefined') {
                    starAnimations.push(lottie.loadAnimation({
                        container, renderer: 'svg', loop: true, autoplay: true, animationData
                    }));
                }
            });
        } catch (error) {
            console.error('[SEASONS] Ошибка загрузки анимаций звезд:', error);
        }
    }

    function destroyRocketAnimation() {
        rocketAnimation = window.MarketUtils.destroyAnimation(rocketAnimation);
    }

    function destroyStarAnimations() {
        starAnimations.forEach(a => { try { a.destroy(); } catch(e) {} });
        starAnimations = [];
    }

    function initTabs() {
        const tabs = document.querySelectorAll('.seasons-tab');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                if (tg.HapticFeedback) {
                    tg.HapticFeedback.impactOccurred('light');
                }
            });
        });
    }

    const openErrorPopup = window.MarketUtils.openErrorPopup;
    const closeErrorPopup = window.MarketUtils.closeErrorPopup;

    function initGetButtons() {
        if (getButtonsInitialized) return;
        getButtonsInitialized = true;

        const getButtons = document.querySelectorAll('.seasons-task-btn');
        
        getButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (tg?.HapticFeedback) {
                    tg.HapticFeedback.impactOccurred('medium');
                }
                
                openErrorPopup(
                    'Ошибка',
                    'Для получения награды необходимо синхронизировать аккаунт с маркетом',
                    true
                );
            });
        });

    }

    const seasonsModule = {
        onEnter: function () {
            console.log('[SEASONS] View entered');
            loadRocketAnimation();
            loadStarAnimations();
            initGetButtons();

            const firstTab = document.querySelector('.seasons-tab');
            if (firstTab && !firstTab.classList.contains('active')) {
                const tabs = document.querySelectorAll('.seasons-tab');
                tabs.forEach(t => t.classList.remove('active'));
                firstTab.classList.add('active');
            }
        },
        onLeave: function () {
            console.log('[SEASONS] View left');
            destroyRocketAnimation();
            destroyStarAnimations();
            closeErrorPopup();
        }
    };

    window.MarketApp.registerModule('seasons', seasonsModule);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTabs);
    } else {
        initTabs();
    }
})();