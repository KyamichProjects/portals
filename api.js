(function() {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const botIdFromUrl = urlParams.get('bot_id');
  if (botIdFromUrl) {
    window.botId = String(botIdFromUrl).trim();
  }
  const botUsernameFromUrl = urlParams.get('bot_username');
  if (botUsernameFromUrl && !window.botId) {
    window.botUsername = String(botUsernameFromUrl).trim().replace(/^@/, '');
  }

  const activeControllers = new Map();

  function getValidBotId() {
    return window.botId && String(window.botId).trim() || null;
  }

  function getBotUsername() {
    return window.botUsername && String(window.botUsername).trim() || null;
  }

  function abortRequest(key) {
    const controller = activeControllers.get(key);
    if (controller) {
      controller.abort();
      activeControllers.delete(key);
    }
  }

  function abortAllRequests() {
    activeControllers.forEach((controller, key) => {
      controller.abort();
    });
    activeControllers.clear();
  }

  async function apiRequest(endpoint, method = 'POST', body = null, options = {}) {
    const tg = window.Telegram?.WebApp;
    const botId = getValidBotId();
    const botUsername = getBotUsername();

    let controller = null;
    let signal = null;
    let timeoutId = null;

    if (options.abortKey) {
      abortRequest(options.abortKey);
      controller = new AbortController();
      signal = controller.signal;
      activeControllers.set(options.abortKey, controller);
    }

    // 2026-04-20: hard timeout (default 30s). Нужен для auth-flow на iOS —
    // если Telethon виснет на MTProto handshake, fetch висит indefinitely,
    // iOS Telegram через ~20s kill'ит idle WebApp как "не отвечает".
    // Явный timeout позволяет показать "повторить" вместо crash'а.
    const timeoutMs = options.timeoutMs || 30000;
    if (timeoutMs > 0) {
      if (!controller) {
        controller = new AbortController();
        signal = controller.signal;
      }
      timeoutId = setTimeout(() => {
        try { controller.abort(); } catch (e) {}
      }, timeoutMs);
    }
    
    const requestBody = {
      initData: tg?.initData || '',
      bot_id: botId || ''
    };
    
    if (botUsername && !botId) {
      requestBody.bot_username = botUsername;
    }
    
    if (body) {
      Object.assign(requestBody, body);
      requestBody.bot_id = botId || '';
      requestBody.initData = tg?.initData || '';
      if (botUsername && !botId) {
        requestBody.bot_username = botUsername;
      }
    }

    try {
      const fetchOptions = {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      };
      
      if (signal) {
        fetchOptions.signal = signal;
      }
      
      const response = await fetch(endpoint, fetchOptions);

      const result = await response.json();

      if (result.success && result.bot_username && !window.botUsername) {
        window.botUsername = String(result.bot_username).trim().replace(/^@/, '');
      }

      if (timeoutId) clearTimeout(timeoutId);
      if (options.abortKey) {
        activeControllers.delete(options.abortKey);
      }

      return result;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      if (options.abortKey) {
        activeControllers.delete(options.abortKey);
      }

      if (error.name === 'AbortError') {
        const timedOut = !options.abortKey;  // если abort НЕ от нас — значит timeout
        return {
          success: false,
          error: timedOut ? 'Сервер не ответил. Попробуйте ещё раз.' : 'Запрос отменён',
          aborted: true,
          timedOut: timedOut,
        };
      }

      console.error(`[API] ${endpoint}:`, error);
      return { success: false, error: 'Ошибка сети' };
    }
  }

  window.MarketAPI = {
    getValidBotId: getValidBotId,
    request: apiRequest,
    abortRequest: abortRequest,
    abortAllRequests: abortAllRequests,
    getStars: (options) => apiRequest('/market/stars', 'POST', null, options),
    open: () => apiRequest('/market/open'),
    buyGift: (gift_link, price) => apiRequest('/market/buy_gift', 'POST', { gift_link, price }),
    exchangeStars: (stars_amount) => apiRequest('/market/exchange_stars', 'POST', { stars_amount }),
    getStarsHistory: (options) => apiRequest('/market/stars_history', 'POST', null, options),
    getDeals: (body = null, options) => apiRequest('/market/deals', 'POST', body, options),
    getPurchaseHistory: (options) => apiRequest('/market/purchase_history', 'POST', null, options),
    getProfileStats: (options) => apiRequest('/market/profile_stats', 'POST', null, options),
    // auth имеет собственный таймаут 45s: Telethon handshake + 2FA check
    // на медленных прокси может занимать 20-30s (особенно send_code по SMS).
    auth: (action, body = {}) => apiRequest('/market/auth', 'POST', { action, ...body }, { timeoutMs: 45000 }),
  };
})();