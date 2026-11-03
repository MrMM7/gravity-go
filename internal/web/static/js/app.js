(function () {
  "use strict";

  const state = {
    isShortening: false,
    isAuthenticating: false,
    authMode: "signin",
    currentShortUrl: "",
    copyTimer: null
  };

  const dom = {
    // Shortener page elements
    shortenForm: document.getElementById("shorten-form"),
    shortenInput: document.getElementById("shorten-input"),
    shortenSubmit: document.getElementById("shorten-submit"),
    shortenFeedback: document.getElementById("shorten-feedback"),
    outputResult: document.getElementById("output-result"),
    resultShortLink: document.getElementById("result-short-link"),
    resultOrigUrl: document.getElementById("result-orig-url"),
    copyBtn: document.getElementById("copy-btn"),
    testRedirectLink: document.getElementById("test-redirect-link"),

    // Auth page elements
    authTitle: document.getElementById("auth-title"),
    authSubtitle: document.getElementById("auth-subtitle"),
    tabSignin: document.getElementById("tab-signin"),
    tabSignup: document.getElementById("tab-signup"),
    authFormPanel: document.getElementById("auth-form-panel"),
    authForm: document.getElementById("auth-form"),
    authEmail: document.getElementById("auth-email"),
    authPassword: document.getElementById("auth-password"),
    togglePasswordBtn: document.getElementById("toggle-password-btn"),
    authSubmit: document.getElementById("auth-submit"),
    authFeedback: document.getElementById("auth-feedback")
  };

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
  }

  function hideFeedback(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
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
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  }

  async function handleShorten(e) {
    e.preventDefault();
    if (state.isShortening) return;

    hideFeedback(dom.shortenFeedback);

    const check = validateUrl(dom.shortenInput.value);
    if (!check.valid) {
      showFeedback(dom.shortenFeedback, true, check.message);
      dom.shortenInput.focus();
      return;
    }

    state.isShortening = true;
    dom.shortenForm.setAttribute("aria-busy", "true");
    dom.shortenInput.disabled = true;
    dom.shortenSubmit.disabled = true;
    dom.shortenSubmit.textContent = "Shortening...";

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
        showFeedback(
          dom.shortenFeedback,
          true,
          (data && data.error) || "Could not shorten link."
        );
        return;
      }

      const shortUrl = window.location.origin + "/" + data.short_code;
      state.currentShortUrl = shortUrl;

      dom.resultShortLink.href = "/" + encodeURIComponent(data.short_code);
      dom.resultShortLink.textContent = shortUrl;
      dom.resultOrigUrl.textContent = data.original_url || check.url;
      dom.testRedirectLink.href = "/" + encodeURIComponent(data.short_code);
      dom.copyBtn.textContent = "Copy";
      dom.outputResult.hidden = false;
    } catch (_) {
      showFeedback(dom.shortenFeedback, true, "Unable to reach the server.");
    } finally {
      state.isShortening = false;
      dom.shortenForm.setAttribute("aria-busy", "false");
      dom.shortenInput.disabled = false;
      dom.shortenSubmit.disabled = false;
      dom.shortenSubmit.textContent = "Shorten";
    }
  }

  function switchAuthMode(mode) {
    state.authMode = mode;
    const isSignin = mode === "signin";

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
    dom.authSubmit.textContent = isSignin ? "Sign in" : "Create account";
    dom.authPassword.setAttribute("autocomplete", isSignin ? "current-password" : "new-password");

    hideFeedback(dom.authFeedback);
  }

  async function handleAuth(e) {
    e.preventDefault();
    if (state.isAuthenticating) return;

    hideFeedback(dom.authFeedback);

    const check = validateAuth(dom.authEmail.value, dom.authPassword.value);
    if (!check.valid) {
      showFeedback(dom.authFeedback, true, check.message);
      return;
    }

    const endpoint = state.authMode === "signin" ? "/api/v1/signin" : "/api/v1/signup";
    state.isAuthenticating = true;
    dom.authForm.setAttribute("aria-busy", "true");
    dom.authEmail.disabled = true;
    dom.authPassword.disabled = true;
    dom.authSubmit.disabled = true;
    dom.authSubmit.textContent = "Please wait...";

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
        return;
      }

      // Redirect to the core URL shortener page upon successful authentication
      window.location.href = "/";
    } catch (_) {
      showFeedback(dom.authFeedback, true, "Unable to reach the server.");
    } finally {
      state.isAuthenticating = false;
      dom.authForm.setAttribute("aria-busy", "false");
      dom.authEmail.disabled = false;
      dom.authPassword.disabled = false;
      dom.authSubmit.disabled = false;
      dom.authSubmit.textContent = state.authMode === "signin" ? "Sign in" : "Create account";
    }
  }

  function initShortenerPage() {
    if (!dom.shortenForm) return;

    dom.shortenForm.addEventListener("submit", handleShorten);

    dom.shortenInput.addEventListener("input", function () {
      if (!dom.shortenFeedback.hidden) {
        hideFeedback(dom.shortenFeedback);
      }
    });

    dom.copyBtn.addEventListener("click", async function () {
      if (!state.currentShortUrl) return;
      const ok = await copyToClipboard(state.currentShortUrl);
      if (ok) {
        dom.copyBtn.textContent = "Copied";
        if (state.copyTimer) clearTimeout(state.copyTimer);
        state.copyTimer = setTimeout(function () {
          dom.copyBtn.textContent = "Copy";
        }, 2000);
      }
    });
  }

  function initAuthPage() {
    if (!dom.authForm) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup" || window.location.pathname === "/signup") {
      switchAuthMode("signup");
    }

    dom.tabSignin.addEventListener("click", function () {
      switchAuthMode("signin");
    });

    dom.tabSignup.addEventListener("click", function () {
      switchAuthMode("signup");
    });

    dom.togglePasswordBtn.addEventListener("click", function () {
      const hidden = dom.authPassword.type === "password";
      dom.authPassword.type = hidden ? "text" : "password";
      dom.togglePasswordBtn.textContent = hidden ? "Hide" : "Show";
      dom.togglePasswordBtn.setAttribute("aria-pressed", hidden ? "true" : "false");
    });

    dom.authForm.addEventListener("submit", handleAuth);
  }

  function init() {
    initShortenerPage();
    initAuthPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
