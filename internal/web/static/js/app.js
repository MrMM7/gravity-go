(function () {
  "use strict";

  // =========================================================================
  // Application State (Strictly Ephemeral In-Memory — No localStorage Tokens)
  // =========================================================================
  const state = {
    isShortening: false,
    isAuthenticating: false,
    authMode: "signin", // "signin" | "signup"
    currentShortUrl: "",
    copyResetTimer: null,
    sessionItems: [] // Ephemeral tab buffer of shortened URLs
  };

  // =========================================================================
  // DOM References
  // =========================================================================
  const dom = {
    // Header
    headerAuthStatus: document.getElementById("header-auth-status"),
    navAuthTrigger: document.getElementById("nav-auth-trigger"),

    // Shortener Module
    shortenForm: document.getElementById("shorten-form"),
    shortenInput: document.getElementById("shorten-input"),
    shortenSubmit: document.getElementById("shorten-submit"),
    shortenSubmitLabel: document.getElementById("shorten-submit-label"),
    shortenFeedback: document.getElementById("shorten-feedback"),
    pasteBtn: document.getElementById("paste-btn"),
    clearBtn: document.getElementById("clear-btn"),

    // Output Module
    outputStatusBadge: document.getElementById("output-status-badge"),
    outputEmpty: document.getElementById("output-empty"),
    outputResult: document.getElementById("output-result"),
    resultShortLink: document.getElementById("result-short-link"),
    copyBtn: document.getElementById("copy-btn"),
    copyBtnText: document.getElementById("copy-btn-text"),
    testRedirectLink: document.getElementById("test-redirect-link"),
    compressionDeltaBadge: document.getElementById("compression-delta-badge"),
    vectorFillBar: document.getElementById("vector-fill-bar"),
    vectorNode: document.getElementById("vector-node"),
    metricShortcode: document.getElementById("metric-shortcode"),
    metricOrigLen: document.getElementById("metric-orig-len"),
    metricShortLen: document.getElementById("metric-short-len"),
    metricOrigUrl: document.getElementById("metric-orig-url"),
    sessionLogContainer: document.getElementById("session-log-container"),
    sessionLogList: document.getElementById("session-log-list"),

    // Auth Module
    tabSignin: document.getElementById("tab-signin"),
    tabSignup: document.getElementById("tab-signup"),
    authEndpointMeta: document.getElementById("auth-endpoint-meta"),
    authFormPanel: document.getElementById("auth-form-panel"),
    authForm: document.getElementById("auth-form"),
    authEmail: document.getElementById("auth-email"),
    authPassword: document.getElementById("auth-password"),
    togglePasswordBtn: document.getElementById("toggle-password-btn"),
    authSubmit: document.getElementById("auth-submit"),
    authSubmitLabel: document.getElementById("auth-submit-label"),
    authFeedback: document.getElementById("auth-feedback"),
    authActivePanel: document.getElementById("auth-active-panel"),
    sessionUserEmail: document.getElementById("session-user-email"),
    authSwitchBtn: document.getElementById("auth-switch-btn")
  };

  // =========================================================================
  // Validation Helpers
  // =========================================================================

  /**
   * Validates that the input is a well-formed HTTP or HTTPS URL.
   * Matches Go's validator `binding:"required,url"` expectation.
   */
  function validateDestinationUrl(raw) {
    const trimmed = (raw || "").trim();
    if (!trimmed) {
      return { valid: false, message: "Enter a destination URL to shorten." };
    }

    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch (_) {
      return {
        valid: false,
        message: "Include a valid scheme such as https:// (e.g. https://example.com)."
      };
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        valid: false,
        message: "Only http:// and https:// destination URLs are supported."
      };
    }

    if (!parsed.hostname || !parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
      return {
        valid: false,
        message: "Enter a complete hostname (e.g. https://example.com/path)."
      };
    }

    return { valid: true, url: trimmed };
  }

  /**
   * Validates email and password inputs before calling /api/v1/signin or /api/v1/signup.
   */
  function validateAuthCredentials(email, password) {
    const trimmedEmail = (email || "").trim();
    if (!trimmedEmail) {
      return { valid: false, message: "Email address is required." };
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      return { valid: false, message: "Enter a valid email address (e.g. operator@domain.com)." };
    }

    if (!password || password.length === 0) {
      return { valid: false, message: "Password is required." };
    }

    return { valid: true, email: trimmedEmail, password: password };
  }

  /**
   * Maps raw backend error strings into clear, actionable user guidance.
   */
  function formatAuthError(rawError, mode) {
    if (!rawError) {
      return "Authentication request failed. Verify server status and try again.";
    }
    const lower = rawError.toLowerCase();
    if (lower.includes("invalid password")) {
      return "Invalid password. Verify your credentials and try again.";
    }
    if (lower.includes("failed to get user")) {
      return "No account found for this email address. Switch to SIGN UP to create one.";
    }
    if (lower.includes("failed to save user")) {
      return "Unable to register email. This address may already have an account.";
    }
    if (lower.includes("failed to validate data")) {
      return "Both email and password are required by the server schema.";
    }
    if (lower.includes("failed to create token")) {
      return "Server could not sign JWT token. Ensure JWT_SECURE_KEY is configured.";
    }
    return mode === "signup"
      ? "Sign up failed: " + rawError
      : "Sign in failed: " + rawError;
  }

  // =========================================================================
  // UI Feedback Rendering
  // =========================================================================

  function showFeedback(element, type, tag, message) {
    if (!element) return;
    element.className = "feedback-banner " + (type === "error" ? "is-error" : "is-success");
    element.textContent = "";

    const tagSpan = document.createElement("span");
    tagSpan.className = "feedback-tag";
    tagSpan.textContent = "[" + tag + "]";

    const msgSpan = document.createElement("span");
    msgSpan.textContent = message;

    element.appendChild(tagSpan);
    element.appendChild(msgSpan);
    element.hidden = false;
  }

  function hideFeedback(element) {
    if (!element) return;
    element.hidden = true;
    element.textContent = "";
  }

  // =========================================================================
  // Clipboard Helper
  // =========================================================================

  async function copyTextToClipboard(text) {
    if (!text) return false;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        // Fall through to legacy textarea copy
      }
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const succeeded = document.execCommand("copy");
      document.body.removeChild(textarea);
      return succeeded;
    } catch (_) {
      return false;
    }
  }

  // =========================================================================
  // URL Shortening Workflow
  // =========================================================================

  function setShorteningLoading(loading) {
    state.isShortening = loading;
    dom.shortenForm.setAttribute("aria-busy", loading ? "true" : "false");
    dom.shortenInput.disabled = loading;
    dom.shortenSubmit.disabled = loading;
    dom.pasteBtn.disabled = loading;
    dom.clearBtn.disabled = loading;
    dom.shortenSubmitLabel.textContent = loading ? "COMPRESSING..." : "SHORTEN";
  }

  function renderShortenedOutput(originalUrl, shortCode) {
    const origin = window.location.origin;
    const fullShortUrl = origin + "/" + shortCode;
    state.currentShortUrl = fullShortUrl;

    const origLen = originalUrl.length;
    const shortLen = fullShortUrl.length;
    const ratio = origLen > 0 ? Math.min(100, Math.max(8, Math.round((shortLen / origLen) * 100))) : 50;
    const deltaChars = origLen - shortLen;
    const deltaPct = origLen > 0 ? Math.round(((shortLen - origLen) / origLen) * 100) : 0;

    // Update status badge
    dom.outputStatusBadge.textContent = "201 CREATED";
    dom.outputStatusBadge.classList.add("is-inverted");

    // Populate primary link & actions
    dom.resultShortLink.href = "/" + encodeURIComponent(shortCode);
    dom.resultShortLink.textContent = fullShortUrl;
    dom.testRedirectLink.href = "/" + encodeURIComponent(shortCode);

    // Reset copy button label
    dom.copyBtn.classList.remove("is-copied");
    dom.copyBtnText.textContent = "COPY URL";

    // Update Gravitational Compression Vector
    if (deltaChars > 0) {
      dom.compressionDeltaBadge.textContent = deltaPct + "% MASS (-" + deltaChars + " CHARS)";
    } else {
      dom.compressionDeltaBadge.textContent = "FIXED 11-CHAR CODE (" + shortLen + " CHARS)";
    }

    dom.vectorFillBar.style.width = ratio + "%";
    dom.vectorNode.style.left = ratio + "%";

    // Populate telemetry metrics
    dom.metricShortcode.textContent = shortCode;
    dom.metricOrigLen.textContent = origLen + " CHARS";
    dom.metricShortLen.textContent = shortLen + " CHARS";
    dom.metricOrigUrl.textContent = originalUrl;
    dom.metricOrigUrl.title = originalUrl;

    // Reveal output panel
    dom.outputEmpty.hidden = true;
    dom.outputResult.hidden = false;

    // Prepend to ephemeral current-tab log
    state.sessionItems.unshift({
      shortCode: shortCode,
      shortUrl: fullShortUrl,
      originalUrl: originalUrl
    });
    if (state.sessionItems.length > 5) {
      state.sessionItems.pop();
    }
    renderSessionLog();
  }

  function renderSessionLog() {
    if (state.sessionItems.length === 0) {
      dom.sessionLogContainer.hidden = true;
      return;
    }

    dom.sessionLogList.textContent = "";
    state.sessionItems.forEach(function (item) {
      const li = document.createElement("li");
      li.className = "session-log-item";

      const left = document.createElement("div");
      left.className = "session-log-Main";

      const codeLink = document.createElement("a");
      codeLink.className = "session-log-code";
      codeLink.href = "/" + encodeURIComponent(item.shortCode);
      codeLink.target = "_blank";
      codeLink.rel = "noopener noreferrer";
      codeLink.textContent = "/" + item.shortCode;

      const origSpan = document.createElement("span");
      origSpan.className = "session-log-orig";
      origSpan.textContent = item.originalUrl;
      origSpan.title = item.originalUrl;

      left.appendChild(codeLink);
      left.appendChild(origSpan);

      const rowCopyBtn = document.createElement("button");
      rowCopyBtn.type = "button";
      rowCopyBtn.className = "micro-btn";
      rowCopyBtn.textContent = "COPY";
      rowCopyBtn.setAttribute("aria-label", "Copy short URL for " + item.shortCode);
      rowCopyBtn.addEventListener("click", async function () {
        const ok = await copyTextToClipboard(item.shortUrl);
        if (ok) {
          rowCopyBtn.textContent = "COPIED ✓";
          setTimeout(function () {
            rowCopyBtn.textContent = "COPY";
          }, 1600);
        }
      });

      li.appendChild(left);
      li.appendChild(rowCopyBtn);
      dom.sessionLogList.appendChild(li);
    });

    dom.sessionLogContainer.hidden = false;
  }

  async function handleShortenSubmit(event) {
    event.preventDefault();
    if (state.isShortening) return;

    hideFeedback(dom.shortenFeedback);

    const validation = validateDestinationUrl(dom.shortenInput.value);
    if (!validation.valid) {
      showFeedback(dom.shortenFeedback, "error", "INVALID URI", validation.message);
      dom.shortenInput.focus();
      return;
    }

    setShorteningLoading(true);

    try {
      const response = await fetch("/api/v1/shorten", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({ original_url: validation.url })
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {
        payload = null;
      }

      if (!response.ok || !payload || !payload.short_code) {
        const errMsg = (payload && payload.error)
          ? payload.error
          : "Server rejected URL shortening request (HTTP " + response.status + ").";
        showFeedback(dom.shortenFeedback, "error", "API ERROR", errMsg);
        return;
      }

      renderShortenedOutput(payload.original_url || validation.url, payload.short_code);
      showFeedback(
        dom.shortenFeedback,
        "success",
        "201 CREATED",
        "Short code /" + payload.short_code + " generated and persisted to SQLite."
      );
    } catch (_) {
      showFeedback(
        dom.shortenFeedback,
        "error",
        "NETWORK ERROR",
        "Could not reach Gravity server on same origin. Verify the Go server is running."
      );
    } finally {
      setShorteningLoading(false);
    }
  }

  // =========================================================================
  // Authentication Workflow (Sign In & Sign Up)
  // =========================================================================

  function switchAuthMode(mode) {
    if (mode !== "signin" && mode !== "signup") return;
    state.authMode = mode;

    const isSignin = mode === "signin";
    dom.tabSignin.classList.toggle("is-active", isSignin);
    dom.tabSignin.setAttribute("aria-selected", isSignin ? "true" : "false");

    dom.tabSignup.classList.toggle("is-active", !isSignin);
    dom.tabSignup.setAttribute("aria-selected", !isSignin ? "true" : "false");

    dom.authFormPanel.setAttribute("aria-labelledby", isSignin ? "tab-signin" : "tab-signup");
    dom.authEndpointMeta.textContent = isSignin ? "POST /api/v1/signin" : "POST /api/v1/signup";
    dom.authSubmitLabel.textContent = isSignin ? "SIGN IN TO GRAVITY" : "CREATE GRAVITY ACCOUNT";
    dom.authPassword.setAttribute("autocomplete", isSignin ? "current-password" : "new-password");
    dom.authPassword.placeholder = isSignin ? "Enter password" : "Create a strong password";

    // Ensure form is visible when switching tabs
    dom.authActivePanel.hidden = true;
    dom.authFormPanel.hidden = false;
    hideFeedback(dom.authFeedback);
  }

  function setAuthLoading(loading) {
    state.isAuthenticating = loading;
    dom.authForm.setAttribute("aria-busy", loading ? "true" : "false");
    dom.authEmail.disabled = loading;
    dom.authPassword.disabled = loading;
    dom.authSubmit.disabled = loading;
    dom.tabSignin.disabled = loading;
    dom.tabSignup.disabled = loading;

    if (loading) {
      dom.authSubmitLabel.textContent = state.authMode === "signin" ? "VERIFYING..." : "REGISTERING...";
    } else {
      dom.authSubmitLabel.textContent = state.authMode === "signin"
        ? "SIGN IN TO GRAVITY"
        : "CREATE GRAVITY ACCOUNT";
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (state.isAuthenticating) return;

    hideFeedback(dom.authFeedback);

    const validation = validateAuthCredentials(dom.authEmail.value, dom.authPassword.value);
    if (!validation.valid) {
      showFeedback(dom.authFeedback, "error", "VALIDATION", validation.message);
      if (!dom.authEmail.value.trim()) {
        dom.authEmail.focus();
      } else {
        dom.authPassword.focus();
      }
      return;
    }

    const endpoint = state.authMode === "signin" ? "/api/v1/signin" : "/api/v1/signup";
    setAuthLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/html"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          email: validation.email,
          password: validation.password
        })
      });

      if (!response.ok) {
        let errorPayload = null;
        try {
          errorPayload = await response.json();
        } catch (_) {
          errorPayload = null;
        }
        const rawErr = errorPayload && errorPayload.error ? errorPayload.error : "";
        showFeedback(
          dom.authFeedback,
          "error",
          "AUTH ERROR",
          formatAuthError(rawErr, state.authMode)
        );
        return;
      }

      // Success: Backend issued HttpOnly `token` cookie and redirected (302 -> 200 /)
      dom.authPassword.value = "";
      dom.sessionUserEmail.textContent = validation.email;
      dom.headerAuthStatus.textContent = "AUTH: " + validation.email.toUpperCase();
      dom.authFormPanel.hidden = true;
      dom.authActivePanel.hidden = false;
    } catch (_) {
      showFeedback(
        dom.authFeedback,
        "error",
        "NETWORK ERROR",
        "Unable to contact authentication endpoint. Verify the server is running."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  // =========================================================================
  // Event Listeners & Initialization
  // =========================================================================

  function init() {
    // Input helper buttons
    dom.shortenInput.addEventListener("input", function () {
      const hasVal = dom.shortenInput.value.trim().length > 0;
      dom.clearBtn.hidden = !hasVal;
      if ( !dom.shortenFeedback.hidden && dom.shortenFeedback.classList.contains("is-error")) {
        hideFeedback(dom.shortenFeedback);
      }
    });

    dom.clearBtn.addEventListener("click", function () {
      dom.shortenInput.value = "";
      dom.clearBtn.hidden = true;
      hideFeedback(dom.shortenFeedback);
      dom.shortenInput.focus();
    });

    dom.pasteBtn.addEventListener("click", async function () {
      if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
        try {
          const clipText = await navigator.clipboard.readText();
          if (clipText) {
            dom.shortenInput.value = clipText.trim();
            dom.clearBtn.hidden = dom.shortenInput.value.length === 0;
            hideFeedback(dom.shortenFeedback);
            dom.shortenInput.focus();
            return;
          }
        } catch (_) {
          // Clipboard read permission denied or unsupported
        }
      }
      dom.shortenInput.focus();
      showFeedback(
        dom.shortenFeedback,
        "success",
        "CLIPBOARD",
        "Press Ctrl+V (or Cmd+V) to paste your URL into the input field."
      );
    });

    // URL Shorten form submission
    dom.shortenForm.addEventListener("submit", handleShortenSubmit);

    // Primary Copy Button
    dom.copyBtn.addEventListener("click", async function () {
      if (!state.currentShortUrl) return;
      const copied = await copyTextToClipboard(state.currentShortUrl);
      if (copied) {
        dom.copyBtn.classList.add("is-copied");
        dom.copyBtnText.textContent = "COPIED TO CLIPBOARD ✓";
        if (state.copyResetTimer) {
          clearTimeout(state.copyResetTimer);
        }
        state.copyResetTimer = setTimeout(function () {
          dom.copyBtn.classList.remove("is-copied");
          dom.copyBtnText.textContent = "COPY URL";
        }, 2000);
      } else {
        showFeedback(
          dom.shortenFeedback,
          "error",
          "CLIPBOARD",
          "Automatic copy was blocked. Select and copy the shortened URL directly."
        );
      }
    });

    // Auth Tabs (Click & Keyboard Arrow Navigation)
    dom.tabSignin.addEventListener("click", function () {
      switchAuthMode("signin");
    });

    dom.tabSignup.addEventListener("click", function () {
      switchAuthMode("signup");
    });

    [dom.tabSignin, dom.tabSignup].forEach(function (tab) {
      tab.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const nextMode = state.authMode === "signin" ? "signup" : "signin";
          switchAuthMode(nextMode);
          (nextMode === "signin" ? dom.tabSignin : dom.tabSignup).focus();
        }
      });
    });

    // Password Visibility Toggle
    dom.togglePasswordBtn.addEventListener("click", function () {
      const isHidden = dom.authPassword.type === "password";
      dom.authPassword.type = isHidden ? "text" : "password";
      dom.togglePasswordBtn.textContent = isHidden ? "HIDE" : "SHOW";
      dom.togglePasswordBtn.setAttribute("aria-pressed", isHidden ? "true" : "false");
    });

    // Auth Form Submission
    dom.authForm.addEventListener("submit", handleAuthSubmit);

    // Switch Account Button
    dom.authSwitchBtn.addEventListener("click", function () {
      dom.authActivePanel.hidden = true;
      dom.authFormPanel.hidden = false;
      hideFeedback(dom.authFeedback);
      dom.authEmail.focus();
    });

    // Header "03 // ACCESS" link focuses email input if form is open
    dom.navAuthTrigger.addEventListener("click", function () {
      if (!dom.authFormPanel.hidden) {
        setTimeout(function () {
          dom.authEmail.focus();
        }, 50);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
