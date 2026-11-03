(function () {
  "use strict";

  const state = {
    isShortening: false,
    isAuthenticating: false,
    authMode: "signin",
    currentShortUrl: "",
    currentOrigUrl: "",
    copyTimer: null,
    sheenTimer: null,
    history: []
  };

  const dom = {
    // Shortener page elements
    shortenForm: document.getElementById("shorten-form"),
    shortenShell: document.getElementById("shorten-shell"),
    shortenInput: document.getElementById("shorten-input"),
    shortenSubmit: document.getElementById("shorten-submit"),
    shortenSubmitLabel: document.getElementById("shorten-submit-label"),
    shortenFeedback: document.getElementById("shorten-feedback"),
    clearInputBtn: document.getElementById("clear-input-btn"),
    inputKbdHint: document.getElementById("input-kbd-hint"),
    outputResult: document.getElementById("output-result"),
    resultShortLink: document.getElementById("result-short-link"),
    resultOrigUrl: document.getElementById("result-orig-url"),
    resultBadge: document.getElementById("result-compression-badge"),
    copyBtn: document.getElementById("copy-btn"),
    copyBtnText: document.getElementById("copy-btn-text"),
    testRedirectLink: document.getElementById("test-redirect-link"),
    sessionHistory: document.getElementById("session-history"),
    historyList: document.getElementById("history-list"),
    clearHistoryBtn: document.getElementById("clear-history-btn"),

    // Auth page elements
    authCard: document.getElementById("auth-card"),
    authTitleGroup: document.getElementById("auth-title-group"),
    authEyebrowText: document.getElementById("auth-eyebrow-text"),
    authTitle: document.getElementById("auth-title"),
    authSubtitle: document.getElementById("auth-subtitle"),
    authTabs: document.getElementById("auth-tabs"),
    tabSignin: document.getElementById("tab-signin"),
    tabSignup: document.getElementById("tab-signup"),
    authFormPanel: document.getElementById("auth-form-panel"),
    authForm: document.getElementById("auth-form"),
    authEmail: document.getElementById("auth-email"),
    authPassword: document.getElementById("auth-password"),
    togglePasswordBtn: document.getElementById("toggle-password-btn"),
    togglePasswordLabel: document.getElementById("toggle-password-label"),
    authSubmit: document.getElementById("auth-submit"),
    authSubmitLabel: document.getElementById("auth-submit-label"),
    authFeedback: document.getElementById("auth-feedback")
  };

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function animateElement(el, keyframes, options) {
    if (!el || typeof el.animate !== "function" || prefersReducedMotion()) {
      return null;
    }
    try {
      return el.animate(keyframes, options);
    } catch (_) {
      return null;
    }
  }

  function triggerValidationShake(el) {
    if (!el) return;
    animateElement(
      el,
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(-1.5px)" },
        { transform: "translateX(0)" }
      ],
      {
        duration: 360,
        easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)"
      }
    );
  }

  function triggerResultSheen() {
    if (!dom.outputResult || prefersReducedMotion()) return;
    dom.outputResult.classList.remove("is-sweeping");
    void dom.outputResult.offsetWidth;
    dom.outputResult.classList.add("is-sweeping");
    if (state.sheenTimer) clearTimeout(state.sheenTimer);
    state.sheenTimer = setTimeout(function () {
      if (dom.outputResult) {
        dom.outputResult.classList.remove("is-sweeping");
      }
    }, 800);
  }

  function setButtonLabel(buttonEl, labelSpanEl, text) {
    if (labelSpanEl) {
      labelSpanEl.textContent = text;
    } else if (buttonEl) {
      buttonEl.textContent = text;
    }
  }

  function validateUrl(raw) {
    const trimmed = (raw || "").trim();
    if (!trimmed) {
      return { valid: false, message: "Please enter a URL." };
    }

    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch (_) {
      return { valid: false, message: "Enter a full URL starting with https:// or http://." };
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, message: "Only http:// and https:// links are supported." };
    }

    if (!parsed.hostname || (!parsed.hostname.includes(".") && parsed.hostname !== "localhost")) {
      return { valid: false, message: "Please enter a valid domain." };
    }

    return { valid: true, url: trimmed };
  }

  function validateAuth(email, password) {
    const trimmedEmail = (email || "").trim();
    if (!trimmedEmail) {
      return { valid: false, message: "Please enter your email." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return { valid: false, message: "Please enter a valid email address." };
    }
    if (!password) {
      return { valid: false, message: "Please enter your password." };
    }
    return { valid: true, email: trimmedEmail, password: password };
  }

  function formatAuthError(rawError, mode) {
    if (!rawError) {
      return "Something went wrong. Please try again.";
    }
    const lower = rawError.toLowerCase();
    if (lower.includes("invalid password")) {
      return "Incorrect password.";
    }
    if (lower.includes("failed to get user")) {
      return "No account found with this email.";
    }
    if (lower.includes("failed to save user")) {
      return "Could not create account. This email may already be in use.";
    }
    return mode === "signup" ? "Could not sign up." : "Could not sign in.";
  }

  function showFeedback(el, isError, message) {
    if (!el) return;
    el.className = isError ? "feedback is-error" : "feedback";
    el.textContent = message;
    el.hidden = false;

    animateElement(
      el,
      [
        { opacity: 0, transform: "translateY(-4px) scale(0.98)" },
        { opacity: 1, transform: "translateY(0) scale(1)" }
      ],
      {
        duration: 220,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)"
      }
    );
  }

  function hideFeedback(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
    if (dom.shortenShell) {
      dom.shortenShell.classList.remove("is-error-state");
    }
  }

  async function copyToClipboard(text) {
    if (!text) return false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {}
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("aria-hidden", "true");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      ta.style.left = "-9999px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus({ preventScroll: true });
      ta.select();
      ta.setSelectionRange(0, text.length);
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch (_) {
      return false;
    }
  }

  function computeCompressionLabel(origUrl, shortUrl) {
    if (!origUrl || !shortUrl) return "Direct 302";
    const origLen = origUrl.length;
    const shortLen = shortUrl.length;
    if (origLen > shortLen && origLen > 0) {
      const savedPct = Math.round(((origLen - shortLen) / origLen) * 100);
      if (savedPct >= 5) {
        return "-" + savedPct + "% shorter";
      }
    }
    return shortLen + " chars";
  }

  function updateInputChrome() {
    if (!dom.shortenInput) return;
    const raw = dom.shortenInput.value || "";
    const hasValue = raw.length > 0;

    if (dom.clearInputBtn) {
      const wasHidden = dom.clearInputBtn.hidden;
      dom.clearInputBtn.hidden = !hasValue;
      if (hasValue && wasHidden) {
        animateElement(
          dom.clearInputBtn,
          [
            { opacity: 0, transform: "scale(0.75)" },
            { opacity: 1, transform: "scale(1)" }
          ],
          { duration: 160, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
        );
      }
    }

    if (dom.inputKbdHint) {
      dom.inputKbdHint.hidden = hasValue;
    }

    if (dom.shortenShell) {
      const isValid = hasValue && validateUrl(raw).valid;
      dom.shortenShell.classList.toggle("is-valid-url", isValid);
    }
  }

  function renderSessionHistory() {
    if (!dom.sessionHistory || !dom.historyList) return;
    const pastItems = state.history.slice(1, 4);
    if (pastItems.length === 0) {
      dom.sessionHistory.hidden = true;
      dom.historyList.innerHTML = "";
      return;
    }

    dom.sessionHistory.hidden = false;
    dom.historyList.innerHTML = "";

    pastItems.forEach(function (item, idx) {
      const li = document.createElement("li");
      li.className = "history-item";

      const linksWrap = document.createElement("div");
      linksWrap.className = "history-item-links";

      const shortAnchor = document.createElement("a");
      shortAnchor.className = "history-short";
      shortAnchor.href = "/" + encodeURIComponent(item.code);
      shortAnchor.target = "_blank";
      shortAnchor.rel = "noopener noreferrer";
      shortAnchor.textContent = item.shortUrl.replace(/^https?:\/\//, "");

      const origSpan = document.createElement("span");
      origSpan.className = "history-orig";
      origSpan.textContent = item.originalUrl;

      linksWrap.appendChild(shortAnchor);
      linksWrap.appendChild(origSpan);

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "history-copy-btn";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", async function () {
        const ok = await copyToClipboard(item.shortUrl);
        if (ok) {
          copyBtn.textContent = "Copied";
          animateElement(
            copyBtn,
            [
              { transform: "scale(0.92)" },
              { transform: "scale(1.04)" },
              { transform: "scale(1)" }
            ],
            { duration: 220, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
          );
          setTimeout(function () {
            copyBtn.textContent = "Copy";
          }, 1600);
        }
      });

      li.appendChild(linksWrap);
      li.appendChild(copyBtn);
      dom.historyList.appendChild(li);

      animateElement(
        li,
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        {
          duration: 240,
          delay: idx * 40,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "both"
        }
      );
    });
  }

  async function handleShorten(e) {
    e.preventDefault();
    if (state.isShortening) return;

    hideFeedback(dom.shortenFeedback);

    const check = validateUrl(dom.shortenInput.value);
    if (!check.valid) {
      if (dom.shortenShell) {
        dom.shortenShell.classList.add("is-error-state");
      }
      showFeedback(dom.shortenFeedback, true, check.message);
      triggerValidationShake(dom.shortenShell || dom.shortenForm);
      dom.shortenInput.focus();
      return;
    }

    state.isShortening = true;
    document.body.classList.add("is-processing");
    dom.shortenForm.setAttribute("aria-busy", "true");
    dom.shortenInput.disabled = true;
    dom.shortenSubmit.disabled = true;
    dom.shortenSubmit.classList.add("is-loading");
    setButtonLabel(dom.shortenSubmit, dom.shortenSubmitLabel, "Shortening...");

    try {
      const res = await fetch("/api/v1/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ original_url: check.url })
      });

      let data = null;
      try {
        data = await res.json();
      } catch (_) {}

      if (!res.ok || !data || !data.short_code) {
        if (dom.shortenShell) {
          dom.shortenShell.classList.add("is-error-state");
        }
        showFeedback(
          dom.shortenFeedback,
          true,
          (data && data.error) || "Could not shorten link."
        );
        triggerValidationShake(dom.shortenShell || dom.shortenForm);
        return;
      }

      const shortUrl = window.location.origin + "/" + data.short_code;
      const resolvedOrig = data.original_url || check.url;
      state.currentShortUrl = shortUrl;
      state.currentOrigUrl = resolvedOrig;

      dom.resultShortLink.href = "/" + encodeURIComponent(data.short_code);
      dom.resultShortLink.textContent = shortUrl;
      dom.resultOrigUrl.textContent = resolvedOrig;
      dom.testRedirectLink.href = "/" + encodeURIComponent(data.short_code);

      if (dom.resultBadge) {
        dom.resultBadge.textContent = computeCompressionLabel(resolvedOrig, shortUrl);
      }

      dom.copyBtn.classList.remove("is-copied");
      setButtonLabel(dom.copyBtn, dom.copyBtnText, "Copy");

      const wasHidden = dom.outputResult.hidden;
      dom.outputResult.hidden = false;

      // Orchestrate centerpiece entrance & sheen
      animateElement(
        dom.outputResult,
        wasHidden
          ? [
              { opacity: 0, transform: "translateY(12px) scale(0.96)" },
              { opacity: 1, transform: "translateY(0) scale(1)" }
            ]
          : [
              { transform: "scale(0.985)" },
              { transform: "scale(1)" }
            ],
        {
          duration: wasHidden ? 380 : 240,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)"
        }
      );

      triggerResultSheen();

      // Record in session history (deduplicated by short code)
      state.history = state.history.filter(function (entry) {
        return entry.code !== data.short_code;
      });
      state.history.unshift({
        code: data.short_code,
        shortUrl: shortUrl,
        originalUrl: resolvedOrig
      });
      renderSessionHistory();
    } catch (_) {
      showFeedback(dom.shortenFeedback, true, "Unable to reach the server.");
      triggerValidationShake(dom.shortenShell || dom.shortenForm);
    } finally {
      state.isShortening = false;
      document.body.classList.remove("is-processing");
      dom.shortenForm.setAttribute("aria-busy", "false");
      dom.shortenInput.disabled = false;
      dom.shortenSubmit.disabled = false;
      dom.shortenSubmit.classList.remove("is-loading");
      setButtonLabel(dom.shortenSubmit, dom.shortenSubmitLabel, "Shorten");
    }
  }

  function switchAuthMode(mode, animateTransition) {
    const prevMode = state.authMode;
    state.authMode = mode;
    const isSignin = mode === "signin";

    if (dom.authTabs) {
      dom.authTabs.setAttribute("data-active-mode", mode);
    }

    if (dom.authEyebrowText) {
      dom.authEyebrowText.textContent = isSignin ? "Account Access" : "New Account";
    }

    if (dom.authTitle) {
      dom.authTitle.textContent = isSignin ? "Sign in" : "Create account";
    }
    if (dom.authSubtitle) {
      dom.authSubtitle.textContent = isSignin
        ? "Enter your email and password to continue."
        : "Register with your email and a password.";
    }

    dom.tabSignin.classList.toggle("is-active", isSignin);
    dom.tabSignin.setAttribute("aria-selected", isSignin ? "true" : "false");

    dom.tabSignup.classList.toggle("is-active", !isSignin);
    dom.tabSignup.setAttribute("aria-selected", !isSignin ? "true" : "false");

    dom.authFormPanel.setAttribute("aria-labelledby", isSignin ? "tab-signin" : "tab-signup");
    setButtonLabel(dom.authSubmit, dom.authSubmitLabel, isSignin ? "Sign in" : "Create account");
    dom.authPassword.setAttribute("autocomplete", isSignin ? "current-password" : "new-password");

    hideFeedback(dom.authFeedback);

    if (animateTransition && prevMode !== mode) {
      const dir = isSignin ? -1 : 1;
      animateElement(
        dom.authTitleGroup,
        [
          { opacity: 0.3, transform: "translateX(" + (dir * 8) + "px)" },
          { opacity: 1, transform: "translateX(0)" }
        ],
        { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      );
      animateElement(
        dom.authFormPanel,
        [
          { opacity: 0.45, transform: "translateY(4px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      );
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    if (state.isAuthenticating) return;

    hideFeedback(dom.authFeedback);

    const check = validateAuth(dom.authEmail.value, dom.authPassword.value);
    if (!check.valid) {
      showFeedback(dom.authFeedback, true, check.message);
      triggerValidationShake(dom.authCard || dom.authForm);
      if (!dom.authEmail.value.trim()) {
        dom.authEmail.focus();
      } else {
        dom.authPassword.focus();
      }
      return;
    }

    const endpoint = state.authMode === "signin" ? "/api/v1/signin" : "/api/v1/signup";
    state.isAuthenticating = true;
    document.body.classList.add("is-processing");
    dom.authForm.setAttribute("aria-busy", "true");
    dom.authEmail.disabled = true;
    dom.authPassword.disabled = true;
    dom.authSubmit.disabled = true;
    dom.authSubmit.classList.add("is-loading");
    setButtonLabel(dom.authSubmit, dom.authSubmitLabel, "Please wait...");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: check.email, password: check.password })
      });

      if (!res.ok) {
        let errData = null;
        try {
          errData = await res.json();
        } catch (_) {}
        showFeedback(
          dom.authFeedback,
          true,
          formatAuthError(errData && errData.error, state.authMode)
        );
        triggerValidationShake(dom.authCard || dom.authForm);
        return;
      }

      // Redirect to the core URL shortener page upon successful authentication
      window.location.href = "/";
    } catch (_) {
      showFeedback(dom.authFeedback, true, "Unable to reach the server.");
      triggerValidationShake(dom.authCard || dom.authForm);
    } finally {
      state.isAuthenticating = false;
      document.body.classList.remove("is-processing");
      dom.authForm.setAttribute("aria-busy", "false");
      dom.authEmail.disabled = false;
      dom.authPassword.disabled = false;
      dom.authSubmit.disabled = false;
      dom.authSubmit.classList.remove("is-loading");
      setButtonLabel(
        dom.authSubmit,
        dom.authSubmitLabel,
        state.authMode === "signin" ? "Sign in" : "Create account"
      );
    }
  }

  function initAmbientInteractions() {
    let rafPending = false;
    window.addEventListener(
      "pointermove",
      function (e) {
        if (rafPending || prefersReducedMotion()) return;
        rafPending = true;
        window.requestAnimationFrame(function () {
          const xPct = Math.round((e.clientX / window.innerWidth) * 100);
          const yPct = Math.round((e.clientY / window.innerHeight) * 100);
          document.documentElement.style.setProperty("--spotlight-x", xPct + "%");
          document.documentElement.style.setProperty("--spotlight-y", yPct + "%");
          rafPending = false;
        });
      },
      { passive: true }
    );
  }

  function initShortenerPage() {
    if (!dom.shortenForm) return;

    dom.shortenForm.addEventListener("submit", handleShorten);

    dom.shortenInput.addEventListener("input", function () {
      if (!dom.shortenFeedback.hidden) {
        hideFeedback(dom.shortenFeedback);
      }
      updateInputChrome();
    });

    if (dom.clearInputBtn) {
      dom.clearInputBtn.addEventListener("click", function () {
        dom.shortenInput.value = "";
        hideFeedback(dom.shortenFeedback);
        updateInputChrome();
        dom.shortenInput.focus();
      });
    }

    if (dom.clearHistoryBtn) {
      dom.clearHistoryBtn.addEventListener("click", function () {
        state.history = state.history.slice(0, 1);
        renderSessionHistory();
      });
    }

    // Keyboard shortcut: press "/" to focus URL input
    document.addEventListener("keydown", function (e) {
      if (
        e.key === "/" &&
        document.activeElement !== dom.shortenInput &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (document.activeElement && document.activeElement.tagName) || ""
        ) &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        dom.shortenInput.focus();
        dom.shortenInput.select();
      } else if (e.key === "Escape" && document.activeElement === dom.shortenInput) {
        if (!dom.shortenFeedback.hidden) {
          hideFeedback(dom.shortenFeedback);
        } else {
          dom.shortenInput.blur();
        }
      }
    });

    dom.copyBtn.addEventListener("click", async function () {
      if (!state.currentShortUrl) return;
      const ok = await copyToClipboard(state.currentShortUrl);
      if (ok) {
        dom.copyBtn.classList.add("is-copied");
        setButtonLabel(dom.copyBtn, dom.copyBtnText, "Copied");
        animateElement(
          dom.copyBtn,
          [
            { transform: "scale(0.94)" },
            { transform: "scale(1.03)" },
            { transform: "scale(1)" }
          ],
          { duration: 260, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
        );
        triggerResultSheen();
        if (state.copyTimer) clearTimeout(state.copyTimer);
        state.copyTimer = setTimeout(function () {
          dom.copyBtn.classList.remove("is-copied");
          setButtonLabel(dom.copyBtn, dom.copyBtnText, "Copy");
        }, 2000);
      }
    });

    updateInputChrome();
  }

  function initAuthPage() {
    if (!dom.authForm) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup" || window.location.pathname === "/signup") {
      switchAuthMode("signup", false);
    }

    dom.tabSignin.addEventListener("click", function () {
      switchAuthMode("signin", true);
    });

    dom.tabSignup.addEventListener("click", function () {
      switchAuthMode("signup", true);
    });

    dom.togglePasswordBtn.addEventListener("click", function () {
      const hidden = dom.authPassword.type === "password";
      dom.authPassword.type = hidden ? "text" : "password";
      setButtonLabel(
        dom.togglePasswordBtn,
        dom.togglePasswordLabel,
        hidden ? "Hide" : "Show"
      );
      dom.togglePasswordBtn.setAttribute("aria-pressed", hidden ? "true" : "false");
    });

    dom.authEmail.addEventListener("input", function () {
      if (!dom.authFeedback.hidden) {
        hideFeedback(dom.authFeedback);
      }
    });

    dom.authPassword.addEventListener("input", function () {
      if (!dom.authFeedback.hidden) {
        hideFeedback(dom.authFeedback);
      }
    });

    dom.authForm.addEventListener("submit", handleAuth);
  }

  function init() {
    initAmbientInteractions();
    initShortenerPage();
    initAuthPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
