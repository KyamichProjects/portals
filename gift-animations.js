let giftAnimations = {};
let animationCache = {};
let animationCacheKeys = [];
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768);
const ANIMATION_CACHE_LIMIT = isMobile ? 15 : 30;
let giftObserver = null;
let observedContainers = new Set();
let visibleContainers = new Set();
let contentAreaCache = null;

const imagePreloadCache = new Set();
const pendingPreloads = new Map();

function preloadImage(url) {
    if (imagePreloadCache.has(url) || pendingPreloads.has(url)) {
        return pendingPreloads.get(url) || Promise.resolve();
    }
    
    const promise = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            imagePreloadCache.add(url);
            pendingPreloads.delete(url);
            resolve();
        };
        img.onerror = () => {
            pendingPreloads.delete(url);
            resolve();
        };
        img.src = url;
    });
    
    pendingPreloads.set(url, promise);
    return promise;
}

function preloadGiftImages(links) {
    if (!links || links.length === 0) return;
    
    links.forEach(link => {
        const url = getGiftPreviewUrl(link);
        if (url) preloadImage(url);
    });
}

function prefetchAnimation(giftLink) {
    const parsed = parseLink(giftLink);
    if (!parsed) return;
    
    const nameForPreview = parsed.name.toLowerCase();
    const url = `https://nft.fragment.com/gift/${nameForPreview}-${parsed.id}.lottie.json`;
    
    if (animationCache[url]) return;
    
    const existingLink = document.querySelector(`link[href="${url}"]`);
    if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'fetch';
        link.href = url;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    }
}

function getGiftObserverRoot() {
    if (!contentAreaCache) {
        contentAreaCache = document.querySelector('.market-container');
    }
    return contentAreaCache;
}

function cleanupGiftObserver() {
    if (giftObserver) {
        giftObserver.disconnect();
        giftObserver = null;
    }
    observedContainers.clear();
    visibleContainers.clear();
    contentAreaCache = null;
}

function getGiftObserver() {
    if (typeof window === 'undefined') {
        return null;
    }
    if (!giftObserver) {
        const root = getGiftObserverRoot();
        giftObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const id = entry.target.id;
                const anim = giftAnimations[id];
                if (!anim) {
                    return;
                }
                if (entry.isIntersecting) {
                    visibleContainers.add(id);
                    try {
                        anim.play();
                    } catch {}
                } else {
                    visibleContainers.delete(id);
                    try {
                        anim.pause();
                    } catch {}
                }
            });
        }, {
            root,
            threshold: 0.05
        });
    }
    return giftObserver;
}

function observeGiftContainer(container) {
    const observer = getGiftObserver();
    if (!observer || !container) {
        return;
    }
    const root = getGiftObserverRoot();
    if (root && !root.contains(container)) {
        observedContainers.add(container.id);
        visibleContainers.add(container.id);
        return;
    }
    try {
        observer.observe(container);
    } catch (err) {
        console.warn('[GIFTS] Не удалось подписаться на наблюдение:', err.message);
        observedContainers.add(container.id);
        visibleContainers.add(container.id);
    }
    observedContainers.add(container.id);
}

function parseLink(giftLink) {
    try {
        const url = new URL(giftLink);
        const segment = url.pathname.split('/').pop();
        const parts = segment.split('-');
        if (parts.length < 2) return null;
        return {
            name: parts[0],
            id: parts[parts.length - 1]
        };
    } catch {
        return null;
    }
}

function formatGiftName(name) {
    return name.split(/(?=[A-Z])/).map(w =>
        w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
}

function getGiftPreviewUrl(giftLink) {
    const parsed = parseLink(giftLink);
    if (!parsed) {
        return null;
    }
    const nameForPreview = parsed.name.toLowerCase();
    return `https://nft.fragment.com/gift/${nameForPreview}-${parsed.id}.webp`;
}

async function loadGiftAnimation(containerId, giftLink, autoplay = false) {
    const container = document.getElementById(containerId);
    if (!container) {
        return Promise.resolve();
    }

    if (!document.body.contains(container)) {
        return Promise.resolve();
    }

    const existing = giftAnimations[containerId];
    if (existing) {
        return Promise.resolve();
    }

    const parsed = parseLink(giftLink);
    if (!parsed) {
        return Promise.resolve();
    }

    const nameForPreview = parsed.name.toLowerCase();
    const url = `https://nft.fragment.com/gift/${nameForPreview}-${parsed.id}.lottie.json`;

    try {
        let animData;
        
        if (animationCache[url]) {
            animData = animationCache[url];
            const idx = animationCacheKeys.indexOf(url);
            if (idx > -1) {
                animationCacheKeys.splice(idx, 1);
                animationCacheKeys.push(url);
            }
        } else {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Анимация не найдена');
            }
            animData = await response.json();
            animationCache[url] = animData;
            animationCacheKeys.push(url);
            
            while (animationCacheKeys.length > ANIMATION_CACHE_LIMIT) {
                const oldestKey = animationCacheKeys.shift();
                delete animationCache[oldestKey];
            }
        }
        
        let lottieContainer = container.querySelector('.lottie-container');
        if (!lottieContainer) {
            lottieContainer = document.createElement('div');
            lottieContainer.className = 'lottie-container';
            lottieContainer.style.width = '100%';
            lottieContainer.style.height = '100%';
            lottieContainer.style.position = 'absolute';
            lottieContainer.style.top = '0';
            lottieContainer.style.left = '0';
            container.appendChild(lottieContainer);
        }
        
        if (typeof lottie !== 'undefined') {
            const animation = lottie.loadAnimation({
                container: lottieContainer,
                renderer: 'svg',
                loop: true,
                autoplay: false,
                animationData: animData,
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid meet',
                    progressiveLoad: true,
                    hideOnTransparent: true
                }
            });
            giftAnimations[containerId] = animation;
            
            try {
                animation.setSubframe(false);
            } catch {}
            
            if (autoplay) {
                try {
                    animation.play();
                    visibleContainers.add(containerId);
                } catch {}
            }
            
            observeGiftContainer(container);
            
            return Promise.resolve();
        } else {
            return Promise.resolve();
        }
    } catch (e) {
        return Promise.resolve();
    }
}

window.giftAnimations = giftAnimations;
window.parseLink = parseLink;
window.formatGiftName = formatGiftName;
window.getGiftPreviewUrl = getGiftPreviewUrl;
window.loadGiftAnimation = loadGiftAnimation;
window.cleanupGiftObserver = cleanupGiftObserver;
window.preloadGiftImages = preloadGiftImages;
window.prefetchAnimation = prefetchAnimation;
window.preloadImage = preloadImage;
