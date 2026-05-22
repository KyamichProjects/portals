(function() {
    'use strict';

    async function loadTgsAnimation(url, container, options = {}) {
        if (!container) return null;

        container.innerHTML = '';

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to load TGS');

            const arrayBuffer = await response.arrayBuffer();
            const ds = new DecompressionStream('gzip');
            const decompressed = await new Response(
                new Blob([arrayBuffer]).stream().pipeThrough(ds)
            ).arrayBuffer();

            const animationData = JSON.parse(new TextDecoder().decode(decompressed));

            let targetContainer = container;
            if (options.wrapClass) {
                const wrapper = document.createElement('div');
                wrapper.className = options.wrapClass;
                if (options.wrapSize) {
                    wrapper.style.width = options.wrapSize;
                    wrapper.style.height = options.wrapSize;
                }
                container.appendChild(wrapper);
                targetContainer = wrapper;
            }

            if (typeof lottie !== 'undefined') {
                return lottie.loadAnimation({
                    container: targetContainer,
                    renderer: 'svg',
                    loop: options.loop !== false,
                    autoplay: options.autoplay !== false,
                    animationData: animationData
                });
            }
        } catch (error) {
            console.warn(`[TGS] Не удалось загрузить ${url}:`, error);
            if (options.fallbackHtml) {
                container.innerHTML = options.fallbackHtml;
            }
        }
        return null;
    }

    function destroyAnimation(anim) {
        if (anim) {
            try { anim.destroy(); } catch (e) {}
        }
        return null;
    }

    function showTopToast(message) {
        const toast = document.getElementById('withdrawToast');
        const toastText = document.getElementById('withdrawToastText');
        const toastBar = document.getElementById('withdrawToastBar');
        if (!toast || !toastText || !toastBar) return;
        toastText.textContent = message;
        toast.classList.add('show');
        toastBar.style.transition = 'none';
        toastBar.style.transform = 'scaleX(1)';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toastBar.style.transition = 'transform 3s linear';
                toastBar.style.transform = 'scaleX(0)';
            });
        });
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function openErrorPopup(title, message, showSyncButton) {
        title = title || 'Ошибка';
        message = message || '';
        showSyncButton = showSyncButton || false;

        const tg = window.Telegram?.WebApp;
        const errorOverlay = document.getElementById('errorOverlay');
        const errorPopup = document.getElementById('errorPopup');
        const errorTitle = document.getElementById('errorTitle');
        const errorText = document.getElementById('errorText');
        const errorCloseBtn = document.getElementById('errorCloseBtn');
        let syncButton = document.getElementById('errorSyncBtn');

        if (errorTitle) errorTitle.textContent = title;
        if (errorText) errorText.textContent = message;

        if (showSyncButton) {
            if (!syncButton) {
                syncButton = document.createElement('button');
                syncButton.id = 'errorSyncBtn';
                syncButton.className = 'popup-btn';
                syncButton.textContent = (window.MarketApp && window.MarketApp.syncButtonText) || 'Синхронизация';
                syncButton.addEventListener('click', () => {
                    closeErrorPopup();
                    if (window.MarketApp && window.MarketApp.switchView) {
                        window.MarketApp.switchView('registration');
                    }
                    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
                });
                if (errorCloseBtn && errorCloseBtn.parentNode) {
                    errorCloseBtn.parentNode.insertBefore(syncButton, errorCloseBtn);
                }
            }
            syncButton.style.display = 'block';
        } else {
            if (syncButton) syncButton.style.display = 'none';
        }

        if (errorOverlay) errorOverlay.classList.add('open');
        if (errorPopup) errorPopup.classList.add('open');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    }

    function closeErrorPopup() {
        const tg = window.Telegram?.WebApp;
        const errorOverlay = document.getElementById('errorOverlay');
        const errorPopup = document.getElementById('errorPopup');
        if (errorOverlay) errorOverlay.classList.remove('open');
        if (errorPopup) errorPopup.classList.remove('open');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    }

    function getNftImageUrl(name, id) {
        return `https://nft.fragment.com/gift/${name}-${id}.webp`;
    }

    window.MarketUtils = {
        loadTgsAnimation,
        destroyAnimation,
        showTopToast,
        openErrorPopup,
        closeErrorPopup,
        getNftImageUrl
    };
})();