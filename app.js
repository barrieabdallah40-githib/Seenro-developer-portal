"use strict";

(() => {
  const API_BASE = "https://api.seenrotech.com/api/v1";
  const SESSION_KEY = "seenro_portal_session";

  const session = {
    get() {
      return sessionStorage.getItem(SESSION_KEY);
    },
    set(token) {
      sessionStorage.setItem(SESSION_KEY, token);
    },
    clear() {
      sessionStorage.removeItem(SESSION_KEY);
    }
  };

  async function api(path, options = {}) {
    const headers = {
      "Accept": "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(session.get()
        ? { "Authorization": `Bearer ${session.get()}` }
        : {}),
      ...options.headers
    };

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    const text = await response.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!response.ok) {
      const detail = data.error ?? data.message;
      let message;

      if (typeof detail === "string") {
        message = detail;
      } else if (detail && typeof detail === "object") {
        message =
          (typeof detail.message === "string" && detail.message) ||
          (typeof detail.error === "string" && detail.error) ||
          JSON.stringify(detail);
      } else {
        message = `Request failed (${response.status})`;
      }

      const error = new Error(message);
      error.status = response.status;
      error.code = typeof data.code === "string" ? data.code : "";
      throw error;
    }

    return data;
  }

  function element(tag, attributes = {}, text = "") {
    const node = document.createElement(tag);

    for (const [key, value] of Object.entries(attributes)) {
      if (key === "className") {
        node.className = value;
      } else {
        node.setAttribute(key, value);
      }
    }

    if (text) node.textContent = text;
    return node;
  }

  function init() {
    const page = document.body.dataset.page || "public";

    if (page === "public") {
      const url = new URL(window.location.href);
      if (
        url.searchParams.has("verify_email") ||
        url.searchParams.has("reset_password")
      ) {
        window.location.replace(
          "login.html" + url.search + url.hash
        );
      }
      return;
    }

    const workspacePages = ["dashboard", "projects", "storage", "customer-auth", "api-keys", "storage-keys", "account"];
    if (!["login", "register", ...workspacePages].includes(page)) return;

    const main = document.querySelector("main");
    if (!main) return;

    // Shared SEENRO developer workspace navigation.
    if (workspacePages.includes(page)) {
      const header = document.querySelector(".topbar");
      if (header) {
        const sidebar = element("aside", {
          className: "portal-sidebar",
          id: "portal-sidebar",
          "aria-label": "Developer workspace sidebar"
        });

        const sidebarBrand = element("a", {
          className: "portal-sidebar-brand",
          href: "dashboard.html"
        });
        sidebarBrand.append(
          element("span", { className: "portal-sidebar-mark" }, "S"),
          element("span", { className: "portal-sidebar-brand-copy" }, "SEENRO")
        );
        sidebar.append(sidebarBrand);

        const sidebarNav = element("nav", {
          className: "portal-sidebar-nav",
          "aria-label": "Main workspace navigation"
        });

        const groups = [
          {
            title: "WORKSPACE",
            links: [
              ["Overview", "dashboard.html", "dashboard"],
              ["Projects", "projects.html", "projects"]
            ]
          },
          {
            title: "BUILD",
            links: [
              ["Customer Authentication", "customer-auth.html", "customer-auth"],
              ["Storage", "storage.html", "storage"]
            ]
          },
          {
            title: "DEVELOP",
            links: [
              ["Integration Guides", "docs.html", "docs"],
              ["API Reference", "docs.html#api-reference", "api-reference"]
            ]
          },
          {
            title: "MANAGE",
            links: [
              ["Developer API keys", "api-keys.html", "api-keys"],
              ["Storage API keys", "storage-keys.html", "storage-keys"],
              ["Account settings", "account.html", "account"]
            ]
          }
        ];

        for (const group of groups) {
          const groupSection = element("section", {
            className: "portal-sidebar-group"
          });
          groupSection.append(
            element("h2", { className: "portal-sidebar-group-title" }, group.title)
          );

          for (const [label, href, key] of group.links) {
            const link = element("a", {
              className: "portal-sidebar-link",
              href,
              title: label
            });
            link.append(
              element("span", { className: "portal-sidebar-link-label" }, label)
            );

            if (key === page) {
              link.classList.add("active");
              link.setAttribute("aria-current", "page");
            }
            groupSection.append(link);
          }

          sidebarNav.append(groupSection);
        }

        const buildStatus = element("div", {
          className: "portal-sidebar-coming-soon"
        });
        buildStatus.append(
          element("span", { className: "portal-sidebar-coming-soon-title" }, "DATABASE"),
          element("span", {}, "Coming soon")
        );

        const sidebarBottom = element("div", {
          className: "portal-sidebar-bottom"
        });
        const docsLink = element("a", {
          href: "docs.html",
          className: "portal-sidebar-bottom-link"
        }, "Documentation");
        sidebarBottom.append(buildStatus, docsLink);

        sidebar.append(sidebarNav, sidebarBottom);
        document.body.insertBefore(sidebar, header);

        const backdrop = element("button", {
          type: "button",
          className: "portal-sidebar-backdrop",
          "aria-label": "Close navigation"
        });
        backdrop.addEventListener("click", () => {
          document.body.classList.remove("portal-sidebar-open");
        });
        document.body.insertBefore(backdrop, header);

        const toggle = element("button", {
          type: "button",
          className: "portal-sidebar-toggle",
          "aria-label": "Toggle workspace navigation",
          "aria-controls": "portal-sidebar",
          "aria-expanded": "false"
        }, "☰");
        toggle.addEventListener("click", () => {
          const mobile = window.matchMedia("(max-width: 760px)").matches;
          const className = mobile
            ? "portal-sidebar-open"
            : "portal-sidebar-collapsed";
          document.body.classList.toggle(className);
          const expanded = mobile
            ? document.body.classList.contains("portal-sidebar-open")
            : !document.body.classList.contains("portal-sidebar-collapsed");
          toggle.setAttribute("aria-expanded", String(expanded));
        });
        header.prepend(toggle);

        for (const link of sidebar.querySelectorAll("a")) {
          link.addEventListener("click", () => {
            document.body.classList.remove("portal-sidebar-open");
          });
        }

        document.body.classList.add("portal-sidebar-shell");
      }
    }

    for (const link of document.querySelectorAll(".portal-page-nav a")) {
      if (link.getAttribute("href") === `${page}.html`) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
    }

    const section = element("section", {
      className: "section portal-console",
      id: "developer-console"
    });

    section.append(
      element(
        "p",
        { className: "eyebrow" },
        workspacePages.includes(page) ? "DEVELOPER WORKSPACE" : "DEVELOPER ACCOUNT"
      ),
      element(
        "h2",
        {},
        ({
          dashboard: "Workspace",
          projects: "Projects",
          storage: "Storage",
          "customer-auth": "Customer Authentication",
          "api-keys": "Developer API keys",
          "storage-keys": "Storage API keys",
          account: "Account",
          register: "Create your account",
          login: "Welcome back"
        })[page] || "Developer workspace"
      )
    );

    const status = element("p", {
      className: "portal-message",
      role: "status",
      "aria-live": "polite"
    });

    const panel = element("div", { className: "portal-panel" });
    section.append(status, panel);
    main.append(section);

    function showMessage(message, isError = false) {
      status.textContent = message;
      status.dataset.state = isError ? "error" : "success";
    }

    function button(label, handler, className = "primary-button") {
      const control = element("button", {
        type: "button",
        className
      }, label);

      control.addEventListener("click", handler);
      return control;
    }

    function field(labelText, name, type = "text") {
      const wrapper = element("label", { className: "portal-field" });
      wrapper.append(
        element("span", {}, labelText),
        element("input", {
          name,
          type,
          required: "required",
          autocomplete:
            name === "password" ? "current-password" : name
        })
      );
      return wrapper;
    }

    function formField(form, name) {
      return form.elements.namedItem(name)?.value.trim() ?? "";
    }

    function renderAuth(initialMode = (page === "register" ? "register" : "login")) {
      panel.replaceChildren();

      const form = element("form", { className: "portal-form" });
      let mode = initialMode === "register" ? "register" : "login";

      const heading = element("h3", {}, "Sign in");
      const email = field("Email address", "email", "email");
      const password = field("Password", "password", "password");
      const submit = element("button", {
        type: "submit",
        className: "primary-button"
      }, "Sign in");

      function setMode(nextMode) {
        mode = nextMode;
        heading.textContent =
          mode === "login" ? "Sign in" : "Create your account";
        submit.textContent =
          mode === "login" ? "Sign in" : "Register";
        password.querySelector("input").autocomplete =
          mode === "login" ? "current-password" : "new-password";
        showMessage("");
      }

      setMode(mode);

      form.append(heading, email, password, submit);

      const recovery = element("div", { className: "portal-auth-tools" });
      const forgotForm = element("form", { className: "portal-form" });
      forgotForm.append(
        element("h3", {}, "Forgot your password?"),
        field("Account email address", "forgot_email", "email"),
        element("button", {
          type: "submit",
          className: "portal-secondary-button"
        }, "Send password reset link")
      );

      forgotForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const control = forgotForm.querySelector('button[type="submit"]');
        control.disabled = true;
        showMessage("Requesting password reset…");
        try {
          const result = await api("/forgot-password", {
            method: "POST",
            body: JSON.stringify({
              email: formField(forgotForm, "forgot_email")
            })
          });
          showMessage(result.message ||
            "If an eligible account exists, password reset instructions will be sent.");
          forgotForm.reset();
        } catch (error) {
          showMessage(error.message, true);
        } finally {
          control.disabled = false;
        }
      });

      const resendForm = element("form", { className: "portal-form" });
      resendForm.append(
        element("h3", {}, "Email verification"),
        element("p", {}, "Didn't receive your verification email? Request another link."),
        field("Account email address", "resend_email", "email"),
        element("button", {
          type: "submit",
          className: "portal-secondary-button"
        }, "Resend verification email")
      );

      resendForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const control = resendForm.querySelector('button[type="submit"]');
        control.disabled = true;
        showMessage("Requesting verification email…");
        try {
          const result = await api("/resend-verification", {
            method: "POST",
            body: JSON.stringify({
              email: formField(resendForm, "resend_email")
            })
          });
          showMessage(result.message ||
            "If verification is required for that account, an email will be sent.");
          resendForm.reset();
        } catch (error) {
          showMessage(error.message, true);
        } finally {
          control.disabled = false;
        }
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        submit.disabled = true;
        showMessage("Contacting SEENRO Core…");

        try {
          const result = await api(
            mode === "login" ? "/login" : "/register",
            {
              method: "POST",
              body: JSON.stringify({
                email: formField(form, "email"),
                password: formField(form, "password")
              })
            }
          );

          if (mode === "register") {
            window.location.replace("login.html?registered=1");
            return;
          }

          const token = result.token;
          if (!token) {
            throw new Error(
              "The login response did not contain the expected token field. No session was saved."
            );
          }

          session.set(token);
          window.location.replace("dashboard.html");
          return;
        } catch (error) {
          if (error.code === "email_not_verified") {
            showMessage(
              "Please verify your email before signing in. You can request another verification email below.",
              true
            );
          } else {
            showMessage(error.message, true);
          }
        } finally {
          submit.disabled = false;
        }
      });

      panel.append(form);

      const switchText = element("p", {
        className: "portal-auth-switch"
      });

      if (mode === "login") {
        switchText.append(
          document.createTextNode("Don't have an account? "),
          element("a", { href: "register.html" }, "Create one")
        );
      } else {
        switchText.append(
          document.createTextNode("Already registered? "),
          element("a", { href: "login.html" }, "Sign in")
        );
      }

      panel.append(switchText);

      if (mode === "login") {
        recovery.append(forgotForm, resendForm);
        panel.append(recovery);
      }

      if (
        mode === "login" &&
        new URLSearchParams(window.location.search).get("registered") === "1"
      ) {
        showMessage("Registration received. Check your email for a verification link before signing in.");
      }
    }

    function renderResetForm(token) {
      panel.replaceChildren();

      const form = element("form", { className: "portal-form" });
      const passwordField = field("New password (8–128 characters)", "password", "password");
      passwordField.querySelector("input").autocomplete = "new-password";

      const confirmationField = field("Confirm new password", "confirm_password", "password");
      confirmationField.querySelector("input").autocomplete = "new-password";

      const submit = element("button", {
        type: "submit",
        className: "primary-button"
      }, "Reset password");

      form.append(
        element("h3", {}, "Choose a new password"),
        passwordField,
        confirmationField,
        submit,
        button("Back to sign in", () => renderAuth("login"), "portal-secondary-button")
      );

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const passwordValue = formField(form, "password");
        const confirmation = formField(form, "confirm_password");

        if (passwordValue !== confirmation) {
          showMessage("The passwords do not match.", true);
          return;
        }

        if (passwordValue.length < 8 || new TextEncoder().encode(passwordValue).length > 128) {
          showMessage("Password must be between 8 and 128 bytes.", true);
          return;
        }

        submit.disabled = true;
        showMessage("Updating your password…");

        try {
          const result = await api("/reset-password", {
            method: "POST",
            body: JSON.stringify({ token, password: passwordValue })
          });
          session.clear();
          renderAuth("login");
          showMessage(result.message || "Password reset successfully. You can now sign in.");
        } catch (error) {
          showMessage(error.message, true);
        } finally {
          submit.disabled = false;
        }
      });

      panel.append(form);
    }

    async function handleEmailLink() {
      const url = new URL(window.location.href);
      const verifyToken = url.searchParams.get("verify_email");
      const resetToken = url.searchParams.get("reset_password");

      if (!verifyToken && !resetToken) return false;

      // Remove sensitive tokens from browser history and the visible URL immediately.
      url.searchParams.delete("verify_email");
      url.searchParams.delete("reset_password");
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);

      if (verifyToken) {
        session.clear();
        renderAuth("login");
        showMessage("Verifying your email…");
        try {
          const result = await api("/verify-email", {
            method: "POST",
            body: JSON.stringify({ token: verifyToken })
          });
          showMessage(result.message || "Email verified successfully. You can now sign in.");
        } catch (error) {
          showMessage(error.message || "This verification link is invalid or expired.", true);
        }
        return true;
      }

      session.clear();
      renderResetForm(resetToken);
      showMessage("Enter and confirm your new password.");
      return true;
    }

    function handleWorkspaceError(error) {
      showMessage(error.message || "The workspace request failed.", true);
      if (error.status === 401) {
        session.clear();
        window.location.replace("login.html");
      }
    }

    async function renderWorkspace() {
      if (!session.get()) {
        window.location.replace("login.html");
        return;
      }

      panel.replaceChildren();

      const heading = element("h3", {}, "Your projects");
      const projectList = element("div", {
        className: "portal-project-list"
      });

      // Project-scoped customer authentication origin management.
      const authOriginsProjectSelect = element("select", {
        name: "auth_origins_project_id",
        "aria-label": "Project for customer authentication origins"
      });
      const authOriginsTextarea = element("textarea", {
        name: "auth_origins",
        rows: "6",
        maxlength: "2550",
        placeholder: "https://example.com\nhttps://app.example.com"
      });
      authOriginsTextarea.disabled = true;

      const authOriginsFeedback = element("p", {
        role: "status",
        "aria-live": "polite"
      });

      const authOriginsSave = button("Save allowed origins", async () => {
        const projectId = authOriginsProjectSelect.value;
        const requestId = authOriginsRequest;

        if (!projectId || authOriginsLoadedProjectId !== projectId) {
          authOriginsFeedback.textContent =
            "Load the selected project's origins before saving.";
          return;
        }

        const origins = authOriginsTextarea.value
          .split(/\r?\n/)
          .map((origin) => origin.trim())
          .filter(Boolean);

        if (origins.length > 10) {
          authOriginsFeedback.textContent =
            "A maximum of 10 allowed origins is permitted.";
          return;
        }

        if (
          origins.length === 0 &&
          !window.confirm(
            "You are about to remove every allowed website origin. Browsers will block cross-origin requests from websites until an origin is added again. This does not restrict non-browser or server-to-server requests. Continue?"
          )
        ) {
          return;
        }

        authOriginsSave.disabled = true;
        authOriginsTextarea.disabled = true;
        authOriginsFeedback.textContent = "Saving allowed origins…";

        try {
          const result = await api(
            `/developer/projects/${encodeURIComponent(projectId)}/auth/origins`,
            {
              method: "PUT",
              body: JSON.stringify({ origins })
            }
          );

          // Ignore stale responses after the user switches projects.
          if (
            requestId !== authOriginsRequest ||
            projectId !== authOriginsProjectSelect.value ||
            authOriginsLoadedProjectId !== projectId
          ) {
            return;
          }

          authOriginsTextarea.value = Array.isArray(result.origins)
            ? result.origins.join("\n")
            : origins.join("\n");

          authOriginsFeedback.textContent =
            "Allowed origins saved successfully.";
          showMessage("Customer authentication origins updated.");
        } catch (error) {
          if (
            requestId === authOriginsRequest &&
            projectId === authOriginsProjectSelect.value &&
            authOriginsLoadedProjectId === projectId
          ) {
            authOriginsFeedback.textContent = error.message;
          }
          if (error.status === 401) {
            handleWorkspaceError(error);
          }
        } finally {
          if (
            requestId === authOriginsRequest &&
            projectId === authOriginsProjectSelect.value &&
            authOriginsLoadedProjectId === projectId
          ) {
            authOriginsTextarea.disabled = false;
            authOriginsSave.disabled = false;
          }
        }
      });

      const authOriginsPanel = element("section", {
        className: "portal-auth-origins"
      });

      authOriginsPanel.append(
        element("h3", {}, "Customer authentication — Allowed origins"),
        element(
          "p",
          {},
          "Choose which websites may make browser-based customer authentication requests for this project. Use one origin per line, with a maximum of 10."
        ),
        element(
          "p",
          {},
          "Production websites must use HTTPS. HTTP is permitted only for localhost and loopback development addresses. Do not include paths or wildcards."
        ),
        element(
          "p",
          {},
          "Saving replaces the complete allowed-origin list for the selected project."
        ),
        element("label", { className: "portal-field" },
          "Select project",
          authOriginsProjectSelect
        ),
        element("label", { className: "portal-field" },
          "Allowed origins",
          authOriginsTextarea
        ),
        authOriginsSave,
        authOriginsFeedback
      );

      const authUnitsQuantityInput = element("input", {
        type: "number", name: "auth_units_quantity",
        min: "1", max: "1000000", step: "1",
        value: "100", inputmode: "numeric"
      });
      const authUnitsQuantityField = element("label", {
        className: "portal-field"
      });
      authUnitsQuantityField.append(
        element("span", {}, "Number of authentication units"),
        authUnitsQuantityInput
      );

      const authUnitsPriceSummary = element(
        "p", {}, "SLE 0.25 per unit. Core confirms the checkout amount."
      );
      const authUnitsCheckoutStatus = element("p", {
        role: "status", "aria-live": "polite"
      }, "Select a project and quantity to continue to Monime.");

      const authUnitsCheckoutButton = element("button", {
        type: "button", className: "primary-button"
      }, "Buy Authentication Units");
      authUnitsCheckoutButton.disabled = true;

      const authUnitsPanel = element("section", {
        className: "portal-auth-billing"
      });
      authUnitsPanel.append(
        element("h3", {}, "Customer Authentication — prepaid units"),
        element("p", {}, "Each project receives its one-time free allocation of 100 units. Additional units are prepaid and separate from Storage subscriptions and credits."),
        element("p", {}, "One unit covers one unique customer active in this project on one UTC calendar day. Repeat sessions by that customer on the same day count once."),
        authUnitsQuantityField,
        authUnitsPriceSummary,
        authUnitsCheckoutButton,
        authUnitsCheckoutStatus
      );

      let authUnitsCheckoutInProgress = false;

      authUnitsQuantityInput.addEventListener("input", () => {
        const quantity = Number(authUnitsQuantityInput.value);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
          authUnitsPriceSummary.textContent =
            "Enter a whole number from 1 to 1,000,000. SLE 0.25 per unit.";
          return;
        }
        authUnitsPriceSummary.textContent =
          `Estimated total: SLE ${(quantity * 25 / 100).toFixed(2)} ` +
          `(${quantity.toLocaleString()} units at SLE 0.25 each). ` +
          "Core confirms the final amount.";
      });

      authUnitsCheckoutButton.addEventListener("click", async () => {
        const projectId = authOriginsProjectSelect.value;
        const quantity = Number(authUnitsQuantityInput.value);

        if (!projectId) {
          authUnitsCheckoutStatus.textContent = "Select a project first.";
          return;
        }
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
          authUnitsCheckoutStatus.textContent =
            "Enter a whole number from 1 to 1,000,000.";
          return;
        }
        if (authUnitsCheckoutInProgress) return;

        authUnitsCheckoutInProgress = true;
        authUnitsCheckoutButton.disabled = true;
        authUnitsCheckoutStatus.textContent =
          "Creating your secure Monime checkout…";

        try {
          const result = await api(
            `/projects/${encodeURIComponent(projectId)}/auth/units/checkout`,
            {
              method: "POST",
              body: JSON.stringify({ quantity })
            }
          );

          // Keep the checkout for the project selected when the request began.
          // A later selector change must not discard the returned checkout URL.

          const checkoutUrl = new URL(result.checkout_url);
          if (
            checkoutUrl.protocol !== "https:" ||
            checkoutUrl.hostname !== "checkout.monime.io" ||
            checkoutUrl.username ||
            checkoutUrl.password ||
            checkoutUrl.port
          ) {
            throw new Error(
              "Core returned a checkout URL that failed Monime security validation."
            );
          }

          const amount = Number(result.amount_minor);
          const currency = typeof result.currency === "string"
            ? result.currency : "SLE";
          const total = Number.isSafeInteger(amount)
            ? `${currency} ${(amount / 100).toFixed(2)}`
            : "the amount confirmed by Core";

          authUnitsCheckoutStatus.textContent =
            projectId !== authOriginsProjectSelect.value
              ? `Checkout created for project ${projectId} (${total}). Opening its Monime checkout…`
              : `Checkout created for ${quantity.toLocaleString()} units ` +
                `(${total}). Redirecting to Monime…`;
          window.location.assign(checkoutUrl.href);
        } catch (error) {
          if (projectId === authOriginsProjectSelect.value) {
            authUnitsCheckoutStatus.textContent =
              error.message || "Could not create checkout. Please try again.";
          }
          if (error.status === 401) handleWorkspaceError(error);
        } finally {
          authUnitsCheckoutInProgress = false;
          authUnitsCheckoutButton.disabled =
            !authOriginsProjectSelect.value;
        }
      });


      // Customer Authentication prepaid-unit balance and history.
      const customerAuthUsagePanel = element("section", {
        className: "portal-auth-usage"
      });
      const customerAuthUsageStatus = element("p", {
        role: "status", "aria-live": "polite"
      }, "Select a project to view its authentication units.");
      const customerAuthBalances = element("div", {
        className: "customer-auth-balances"
      });
      const customerAuthDaily = element("div", {
        className: "customer-auth-history"
      });
      const customerAuthPurchases = element("div", {
        className: "customer-auth-history"
      });
      const customerAuthRefresh = element("button", {
        type: "button", className: "secondary-button"
      }, "Refresh usage");

      customerAuthUsagePanel.append(
        element("h3", {}, "Unit balance"),
        element("p", {}, "One unit is consumed by one unique customer active in this project on one UTC calendar day. Multiple sessions by the same customer that day count once."),
        customerAuthUsageStatus,
        customerAuthBalances,
        customerAuthDaily,
        customerAuthPurchases,
        customerAuthRefresh
      );

      function formatAuthMoney(minor) {
        const amount = Number(minor);
        return Number.isFinite(amount)
          ? `SLE ${(amount / 100).toFixed(2)}`
          : "Unavailable";
      }

      function formatAuthTimestamp(value) {
        const seconds = Number(value);
        return Number.isFinite(seconds)
          ? new Date(seconds * 1000).toLocaleString()
          : "Unknown";
      }

      function formatAuthDay(day) {
        const number = Number(day);
        if (!Number.isInteger(number)) return "Unknown";
        return new Date(number * 86400000).toLocaleDateString(
          undefined,
          { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }
        );
      }

      function authBalanceCard(label, value, detail) {
        const number = Number(value);
        const card = element("article", {
          className: "customer-auth-balance-card"
        });
        card.append(
          element("span", {
            className: "customer-auth-balance-label"
          }, label),
          element("strong", {
            className: "customer-auth-balance-value"
          }, Number.isFinite(number) ? number.toLocaleString() : "Unavailable"),
          element("small", {}, detail)
        );
        return card;
      }

      let customerAuthUsageRequestId = 0;

      async function loadCustomerAuthUsage() {
        const requestId = ++customerAuthUsageRequestId;
        const projectId = authOriginsProjectSelect.value;

        customerAuthBalances.replaceChildren();
        customerAuthDaily.replaceChildren();
        customerAuthPurchases.replaceChildren();

        if (!projectId) {
          delete customerAuthUsageStatus.dataset.state;
          customerAuthUsageStatus.textContent =
            "Create or select a project to view its Customer Authentication units.";
          return;
        }

        customerAuthUsageStatus.dataset.state = "loading";
        customerAuthUsageStatus.textContent = "Loading project usage…";

        try {
          const usage = await api(
            `/projects/${encodeURIComponent(projectId)}/auth/units/usage`
          );

          if (
            requestId !== customerAuthUsageRequestId ||
            authOriginsProjectSelect.value !== projectId
          ) return;

          delete customerAuthUsageStatus.dataset.state;

          customerAuthBalances.replaceChildren(
            authBalanceCard("Free units", usage.free_units, "One-time allocation"),
            authBalanceCard("Purchased units", usage.purchased_units, "Settled purchases"),
            authBalanceCard("Total units", usage.total_units, "Free + purchased"),
            authBalanceCard("Used units", usage.used_units, "Billable customer-days"),
            authBalanceCard("Remaining units", usage.remaining_units, "Available balance")
          );

          customerAuthUsageStatus.textContent =
            `Billing: prepaid daily active customer units · ` +
            `Timezone: ${usage.usage_timezone || "UTC"} · ` +
            `Unit price: ${formatAuthMoney(usage.unit_price_minor)}.`;

          customerAuthDaily.append(
            element("h4", {}, "Daily usage (latest 30 days)")
          );

          const days = Array.isArray(usage.daily_usage)
            ? usage.daily_usage : [];

          if (!days.length) {
            customerAuthDaily.append(
              element("p", {}, "No billable usage recorded yet.")
            );
          }

          for (const item of days) {
            const row = element("div", {
              className: "customer-auth-history-row"
            });
            row.append(
              element("span", {}, formatAuthDay(item.usage_day)),
              element("strong", {}, `${Number(item.units).toLocaleString()} units`)
            );
            customerAuthDaily.append(row);
          }

          customerAuthPurchases.append(
            element("h4", {}, "Purchase history (latest 25)")
          );

          const purchases = Array.isArray(usage.purchases)
            ? usage.purchases : [];

          if (!purchases.length) {
            customerAuthPurchases.append(
              element("p", {}, "No purchases recorded yet.")
            );
          }

          for (const purchase of purchases) {
            const row = element("div", {
              className: "customer-auth-history-row"
            });
            const details = element("span");
            details.append(
              element("strong", {}, `${Number(purchase.quantity).toLocaleString()} units`),
              element("small", {}, ` · ${formatAuthTimestamp(purchase.created_at)}`)
            );
            row.append(
              details,
              element("span", {}, `${formatAuthMoney(purchase.amount_minor)} · ${String(purchase.status || "unknown")}`)
            );
            customerAuthPurchases.append(row);
          }
        } catch (error) {
          if (
            requestId !== customerAuthUsageRequestId ||
            authOriginsProjectSelect.value !== projectId
          ) return;

          customerAuthBalances.replaceChildren();
          customerAuthDaily.replaceChildren();
          customerAuthPurchases.replaceChildren();
          customerAuthUsageStatus.textContent =
            error.message || "Could not load Customer Authentication usage.";
          customerAuthUsageStatus.dataset.state = "error";

          if (error.status === 401) handleWorkspaceError(error);
        }
      }

      customerAuthRefresh.addEventListener("click", loadCustomerAuthUsage);

      let authOriginsLoadedProjectId = "";
      let authOriginsRequest = 0;

      async function loadAuthOrigins() {
        const projectId = authOriginsProjectSelect.value;
        authUnitsCheckoutButton.disabled =
          !projectId || authUnitsCheckoutInProgress;
        const requestId = ++authOriginsRequest;

        authOriginsLoadedProjectId = "";
        authOriginsTextarea.value = "";
        authOriginsTextarea.disabled = true;
        authOriginsSave.disabled = true;

        if (!projectId) {
          authOriginsFeedback.textContent =
            "Select a project to manage its allowed origins.";
          return;
        }

        authOriginsFeedback.textContent = "Loading allowed origins…";

        try {
          const result = await api(
            `/developer/projects/${encodeURIComponent(projectId)}/auth/origins`
          );

          if (
            requestId !== authOriginsRequest ||
            projectId !== authOriginsProjectSelect.value
          ) {
            return;
          }

          const origins = Array.isArray(result.origins)
            ? result.origins
            : [];

          authOriginsTextarea.value = origins.join("\n");
          authOriginsLoadedProjectId = projectId;
          authOriginsTextarea.disabled = false;
          authOriginsSave.disabled = false;

          authOriginsFeedback.textContent = origins.length
            ? `${origins.length} allowed origin(s) loaded.`
            : "No allowed origins are configured for this project.";
        } catch (error) {
          if (requestId !== authOriginsRequest) return;

          authOriginsFeedback.textContent = error.message;
          if (error.status === 401) {
            handleWorkspaceError(error);
          }
        }
      }

      authOriginsProjectSelect.addEventListener(
        "change",
        loadAuthOrigins
      );

      const usageProjectSelect = element("select", {
        name: "usage_project_id",
        "aria-label": "Project storage usage"
      });
      usageProjectSelect.append(
        element("option", { value: "" }, "Select a project")
      );
      const usageProjectField = element("label", {
        className: "portal-field"
      });
      usageProjectField.append(
        element("span", {}, "Storage usage for project"),
        usageProjectSelect
      );
      const usagePanel = element("div", {
        className: "portal-usage-grid"
      });

      // Storage subscription checkout is created and verified by SEENRO Core.
      const storagePlanSelect = element("select", {
        name: "storage_plan",
        required: "required"
      });
      storagePlanSelect.append(
        element("option", { value: "starter" }, "Starter — 5 GB — SLE 25 / month"),
        element("option", { value: "basic" }, "Basic — 20 GB — SLE 100 / month"),
        element("option", { value: "growth" }, "Growth — 50 GB — SLE 250 / month"),
        element("option", { value: "business" }, "Business — 100 GB — SLE 500 / month")
      );

      const storagePlanField = element("label", {
        className: "portal-field"
      });
      storagePlanField.append(
        element("span", {}, "Choose a monthly storage plan"),
        storagePlanSelect
      );

      const storageCheckoutStatus = element("p", {
        role: "status",
        "aria-live": "polite"
      }, "Choose a project and storage plan to continue.");

      const storageCheckoutButton = element("button", {
        type: "button",
        className: "primary-button"
      }, "Subscribe with Monime");

      const keyHeading = element("h3", {}, "API keys");
      const keyList = element("div", {
        className: "portal-project-list"
      });
      const createdKeyPanel = element("div", {
        className: "portal-project-list"
      });

      // Storage API keys are separate from Developer API keys.
      const storageHeading = element("h3", {}, "Storage API keys");
      const storageDescription = element(
        "p",
        {},
        "Create project-bound credentials for file storage. Secrets are displayed only once."
      );
      const storageForm = element("form", {
        className: "portal-form"
      });
      const storageNameField = field("Storage key name", "storageKeyName");
      const storageProjectSelect = element("select", {
        name: "storage_project_id",
        required: "required"
      });
      storageProjectSelect.append(
        element("option", { value: "" }, "Select a project")
      );

      const storageProjectField = element("label", {
        className: "portal-field"
      });
      storageProjectField.append(
        element("span", {}, "Project"),
        storageProjectSelect
      );

      const storagePermissions = element("div", {
        className: "portal-actions"
      });

      const storageReadLabel = element("label", {
        className: "portal-field"
      });
      const storageRead = element("input", {
        type: "checkbox",
        name: "storage_can_read"
      });
      storageRead.checked = true;
      storageReadLabel.append(
        storageRead,
        element("span", {}, "Read storage objects")
      );

      const storageWriteLabel = element("label", {
        className: "portal-field"
      });
      const storageWrite = element("input", {
        type: "checkbox",
        name: "storage_can_write"
      });
      storageWriteLabel.append(
        storageWrite,
        element("span", {}, "Write storage objects")
      );

      const storageUploadLabel = element("label", {
        className: "portal-field"
      });
      const storageCanIssueUploads = element("input", {
        type: "checkbox",
        name: "storage_can_issue_uploads"
      });
      storageUploadLabel.append(
        storageCanIssueUploads,
        element("span", {}, "Issue customer upload authorizations")
      );
      storagePermissions.append(
        storageReadLabel,
        storageWriteLabel,
        storageUploadLabel
      );

      storageForm.append(
        storageNameField,
        storagePermissions,
        element("button", {
          type: "submit",
          className: "primary-button"
        }, "Generate storage key")
      );

      const storageCreatedPanel = element("div", {
        className: "portal-project-list"
      });
      const storageKeyList = element("div", {
        className: "portal-project-list"
      });

      const keyForm = element("form", {
        className: "portal-form"
      });
      const keyNameField = field("API key name", "keyName");
      const projectSelect = element("select", {
        name: "project_id",
        required: "required"
      });
      projectSelect.append(
        element("option", { value: "" }, "Select a project")
      );
      const projectField = element("label", {
        className: "portal-field"
      });
      projectField.append(
        element("span", {}, "Project"),
        projectSelect
      );

      const scopeFields = element("div", {
        className: "portal-actions"
      });

      function scopeCheckbox(scope, checked = false) {
        const label = element("label", {
          className: "portal-field"
        });
        const checkbox = element("input", {
          type: "checkbox",
          name: "scope",
          value: scope
        });
        checkbox.checked = checked;
        label.append(checkbox, element("span", {}, scope));
        return label;
      }

      scopeFields.append(
        scopeCheckbox("projects:read", true),
        scopeCheckbox("projects:write"),
        scopeCheckbox("data:read"),
        scopeCheckbox("data:write"),
        scopeCheckbox("auth:read"),
        scopeCheckbox("auth:write")
      );

      keyForm.append(
        keyNameField,
        projectField,
        scopeFields,
        element("button", {
          type: "submit",
          className: "primary-button"
        }, "Create API key")
      );

      const refreshKeys = button("Refresh API keys", loadKeys);
      const refreshStorageKeys = button(
        "Refresh storage keys",
        loadStorageKeys,
        "portal-secondary-button"
      );

      const createForm = element("form", {
        className: "portal-form"
      });

      createForm.append(
        field("New project name", "name"),
        element("button", {
          type: "submit",
          className: "primary-button"
        }, "Create project")
      );

      const refresh = button("Refresh projects", loadProjects);
      const signOut = button("Sign out", async () => {
        try {
          await api("/logout", { method: "POST" });
        } catch {
          // Clear the local session even if the server logout request fails.
        }
        session.clear();
        window.location.replace("login.html");
      });

      createForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submit = createForm.querySelector('button[type="submit"]');
        submit.disabled = true;

        try {
          const name = formField(createForm, "name");
          await api("/developer/projects", {
            method: "POST",
            body: JSON.stringify({ name })
          });
          createForm.reset();
          showMessage("Project created.");
          await loadProjects();
        } catch (error) {
          handleWorkspaceError(error);
        } finally {
          submit.disabled = false;
        }
      });

      keyForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const submit = keyForm.querySelector('button[type="submit"]');
        const name = formField(keyForm, "keyName");
        const scopes = Array.from(
          keyForm.querySelectorAll('input[name="scope"]:checked')
        ).map((checkbox) => checkbox.value);

        submit.disabled = true;

        try {
          const result = await api("/keys", {
            method: "POST",
            body: JSON.stringify({
            name,
            project_id: Number(projectSelect.value),
            scopes
          })
          });

          createdKeyPanel.replaceChildren(
            element("h4", {}, "Your new API key — copy it now"),
            element("p", {}, result.warning ||
              "This secret will not be shown again.")
          );

          const secretInput = element("input", {
            type: "text",
            readOnly: "readonly",
            autocomplete: "off",
            "aria-label": "New API key secret"
          });
          secretInput.value = result.api_key || "";

          const copyKey = button("Copy API key", async () => {
            try {
              await navigator.clipboard.writeText(secretInput.value);
              showMessage("API key copied. Keep it private.");
            } catch {
              secretInput.focus();
              secretInput.select();
              showMessage("Select and copy the API key manually.");
            }
          });

          createdKeyPanel.append(secretInput, copyKey);
          keyForm.reset();
          keyForm.querySelector('input[value="projects:read"]').checked = true;
          showMessage("API key created. Copy the secret now.");
          await loadKeys();
        } catch (error) {
          handleWorkspaceError(error);
        } finally {
          submit.disabled = false;
        }
      });

      storageForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const submit = storageForm.querySelector('button[type="submit"]');
        const name = formField(storageForm, "storageKeyName");
        const projectId = storageProjectSelect.value;
        const canRead = storageRead.checked;
        const canWrite = storageWrite.checked;
        const canIssueUploads = storageCanIssueUploads.checked;

        if (!projectId) {
          showMessage("Select a project for this storage key.", true);
          return;
        }

        if (!canRead && !canWrite && !canIssueUploads) {
          showMessage("Select at least one storage permission.", true);
          return;
        }

        submit.disabled = true;
        storageCreatedPanel.replaceChildren();
        showMessage("Generating storage key…");

        try {
          const result = await api(
            `/projects/${encodeURIComponent(projectId)}/storage/keys`,
            {
              method: "POST",
              body: JSON.stringify({
                name,
                can_read: canRead,
                can_write: canWrite,
                can_issue_uploads: canIssueUploads
              })
            }
          );

          if (
            typeof result.secret !== "string" ||
            !result.secret ||
            result.id === undefined
          ) {
            throw new Error(
              "The server response did not contain the expected one-time secret. Check the storage key list before trying again."
            );
          }

          const secretInput = element("input", {
            type: "text",
            readOnly: "readonly",
            autocomplete: "off",
            spellcheck: "false",
            "aria-label": "One-time storage API key secret"
          });
          secretInput.value = result.secret;

          const secretPanel = element("article", {
            className: "portal-project"
          });

          secretPanel.append(
            element("strong", {}, "Your new storage key"),
            element("p", {}, result.warning ||
              "This secret is shown only once. Store it securely."),
            element("span", {}, `Name: ${result.name || name}`),
            element("span", {}, `Prefix: ${result.prefix || "Unavailable"}`),
            secretInput
          );

          const copyStorageKey = button(
            "Copy storage key",
            async () => {
              try {
                await navigator.clipboard.writeText(secretInput.value);
                showMessage("Storage key copied. Keep it private.");
              } catch {
                secretInput.focus();
                secretInput.select();
                showMessage("Select and copy the storage key manually.");
              }
            }
          );

          const dismissSecret = button(
            "Hide secret",
            () => {
              secretInput.value = "";
              storageCreatedPanel.replaceChildren();
              showMessage("Secret hidden. It cannot be retrieved again.");
            },
            "portal-secondary-button"
          );

          secretPanel.append(copyStorageKey, dismissSecret);
          storageCreatedPanel.replaceChildren(secretPanel);

          storageForm.reset();
          storageRead.checked = true;
          storageWrite.checked = false;

          showMessage("Storage key created. Copy and store the secret now.");
          await loadStorageKeys();
        } catch (error) {
          handleWorkspaceError(error);
        } finally {
          submit.disabled = false;
        }
      });


      function formatStorageSize(bytes) {
        const value = Number(bytes);
        if (!Number.isFinite(value) || value < 0) return "Unknown size";
        if (value < 1024) return `${value} B`;

        const units = ["KB", "MB", "GB", "TB"];
        let size = value / 1024;
        let unit = 0;

        while (size >= 1024 && unit < units.length - 1) {
          size /= 1024;
          unit++;
        }

        return `${size.toFixed(2)} ${units[unit]}`;
      }

      let usageRequestId = 0;

      async function loadStorageUsage() {
        const projectId = usageProjectSelect.value;
        const requestId = ++usageRequestId;

        if (!projectId) {
          usagePanel.replaceChildren(
            element("p", {}, "Select a project to view storage usage.")
          );
          return;
        }

        usagePanel.replaceChildren(
          element("p", {}, "Loading verified storage usage…")
        );

        try {
          const usage = await api(
            `/projects/${encodeURIComponent(projectId)}/storage/usage`
          );

          if (
            usageProjectSelect.value !== projectId ||
            usageRequestId !== requestId
          ) return;

          const card = (label, value, detail) => {
            const item = element("article", {
              className: "portal-usage-card"
            });
            item.append(
              element("span", { className: "portal-usage-label" }, label),
              element("strong", { className: "portal-usage-value" }, value),
              element("span", { className: "portal-usage-detail" }, detail)
            );
            return item;
          };

          const freeUsed = Number(usage.account_free_used_bytes);
          const freeCapacity = Number(usage.account_free_capacity_bytes);
          const paidUsed = Number(usage.project_paid_used_bytes);
          const paidCapacity = Number(usage.project_paid_capacity_bytes);
          const totalUsed = Number(usage.project_used_bytes);
          const available = Number(usage.available_bytes);

          const valid = (...values) =>
            values.every(value => Number.isFinite(value) && value >= 0);

          if (!valid(freeUsed, freeCapacity, paidUsed, paidCapacity, totalUsed, available)) {
            throw new Error("The storage usage response contains invalid values.");
          }

          usagePanel.replaceChildren(
            card(
              "Account-wide free storage",
              `${formatStorageSize(freeUsed)} / ${formatStorageSize(freeCapacity)}`,
              `${formatStorageSize(Math.max(0, freeCapacity - freeUsed))} free remaining across your projects`
            ),
            card(
              "Selected project paid storage",
              paidCapacity > 0
                ? `${formatStorageSize(paidUsed)} / ${formatStorageSize(paidCapacity)}`
                : formatStorageSize(paidUsed),
              paidCapacity > 0
                ? `${formatStorageSize(Math.max(0, paidCapacity - paidUsed))} paid capacity remaining`
                : "No paid capacity"
            ),
            card(
              "Selected project total used",
              formatStorageSize(totalUsed),
              "Total project object usage"
            ),
            card(
              "Combined available storage",
              formatStorageSize(available),
              "Remaining account free and project paid capacity"
            ),
            element(
              "p",
              { className: "portal-usage-note" },
              usage.usage_includes_pending_deletion === true
                ? "Usage figures include objects pending deletion."
                : "Usage figures reflect the storage usage reported by SEENRO Core."
            )
          );
        } catch (error) {
          if (
            usageProjectSelect.value === projectId &&
            usageRequestId === requestId
          ) {
            usagePanel.replaceChildren(
              element("p", {}, error.message || "Unable to load storage usage.")
            );
            handleWorkspaceError(error);
          }
        }
      }

      usageProjectSelect.addEventListener("change", loadStorageUsage);

      async function startStorageCheckout() {
        const projectId = usageProjectSelect.value;
        const planCode = storagePlanSelect.value;

        if (!projectId) {
          storageCheckoutStatus.textContent =
            "Select a project before purchasing storage.";
          return;
        }

        if (!["starter", "basic", "growth", "business"].includes(planCode)) {
          storageCheckoutStatus.textContent = "Select a valid storage plan.";
          return;
        }

        storageCheckoutButton.disabled = true;
        storageCheckoutStatus.textContent = "Creating secure checkout…";

        try {
          const result = await api(
            `/projects/${encodeURIComponent(projectId)}/storage/subscriptions/checkout`,
            {
              method: "POST",
              body: JSON.stringify({ plan_code: planCode })
            }
          );

          if (typeof result.checkout_url !== "string") {
            throw new Error("SEENRO Core did not return a checkout URL.");
          }

          const checkoutUrl = new URL(result.checkout_url);

          if (
            checkoutUrl.protocol !== "https:" ||
            checkoutUrl.hostname !== "checkout.monime.io" ||
            checkoutUrl.username ||
            checkoutUrl.password ||
            checkoutUrl.port
          ) {
            throw new Error("Monime returned an untrusted checkout URL.");
          }

          storageCheckoutStatus.textContent =
            "Checkout created. Redirecting to Monime…";

          window.location.assign(checkoutUrl.href);
        } catch (error) {
          storageCheckoutStatus.textContent =
            error.message || "Could not create storage checkout.";
          storageCheckoutButton.disabled = false;
          handleWorkspaceError(error);
        }
      }

      storageCheckoutButton.addEventListener(
        "click",
        startStorageCheckout
      );

      async function loadStorageKeys() {
        const projectId = storageProjectSelect.value;

        if (!projectId) {
          storageKeyList.replaceChildren(
            element("p", {}, "Select a project to view its storage keys.")
          );
          return;
        }

        storageKeyList.replaceChildren(
          element("p", {}, "Loading storage keys…")
        );

        try {
          const result = await api(
            `/projects/${encodeURIComponent(projectId)}/storage/keys`
          );

          const keys = Array.isArray(result.keys) ? result.keys : [];
          storageKeyList.replaceChildren();

          if (keys.length === 0) {
            storageKeyList.append(
              element("p", {}, "No storage API keys for this project yet.")
            );
            return;
          }

          for (const key of keys) {
            const row = element("article", {
              className: "portal-project"
            });

            row.append(
              element("strong", {}, key.name || "Unnamed storage key"),
              element("span", {}, `Prefix: ${key.prefix || "Unavailable"}`),
              element("span", {}, `Read: ${key.can_read ? "Enabled" : "Disabled"}`),
              element("span", {}, `Write: ${key.can_write ? "Enabled" : "Disabled"}`),
              element("span", {}, `Issue uploads: ${key.can_issue_uploads ? "Enabled" : "Disabled"}`),
              element("span", {}, `Created: ${key.created_at || "Unknown"}`),
              element("span", {}, key.revoked_at
                ? `Revoked: ${key.revoked_at}`
                : "Status: Active")
            );

            if (!key.revoked_at) {
              row.append(button("Revoke storage key", async () => {
                if (!window.confirm(
                  `Revoke storage key "${key.name}"? This cannot be undone.`
                )) {
                  return;
                }

                try {
                  await api(
                    `/projects/${encodeURIComponent(projectId)}/storage/keys/${encodeURIComponent(key.id)}`,
                    { method: "DELETE" }
                  );
                  showMessage("Storage key revoked.");
                  await loadStorageKeys();
                } catch (error) {
                  handleWorkspaceError(error);
                }
              }, "portal-danger"));
            }

            storageKeyList.append(row);
          }
        } catch (error) {
          storageKeyList.replaceChildren();
          handleWorkspaceError(error);
        }
      }

      storageProjectSelect.addEventListener("change", () => {
        storageCreatedPanel.replaceChildren();
        loadStorageKeys();
      });

      async function loadKeys() {
        keyList.replaceChildren(element("p", {}, "Loading API keys…"));

        try {
          const result = await api("/keys");
          const keys = Array.isArray(result.keys) ? result.keys : [];
          keyList.replaceChildren();

          if (keys.length === 0) {
            keyList.append(element("p", {}, "No API keys yet."));
            return;
          }

          for (const key of keys) {
            const row = element("article", {
              className: "portal-project"
            });

            row.append(
              element("strong", {}, key.name),
              element("span", {}, `Prefix: ${key.prefix}`),
              element("span", {}, `Scopes: ${(key.scopes || []).join(", ")}`),
              element("span", {}, `Created: ${key.created_at || "Unknown"}`),
              element("span", {}, `Last used: ${key.last_used_at || "Never"}`),
              element("span", {}, key.revoked_at
                ? `Revoked: ${key.revoked_at}`
                : "Status: Active")
            );

            if (!key.revoked_at) {
              row.append(button("Revoke key", async () => {
                if (!window.confirm(
                  `Revoke API key "${key.name}"? This cannot be undone.`
                )) {
                  return;
                }

                try {
                  await api(`/keys/${encodeURIComponent(key.id)}`, {
                    method: "DELETE"
                  });
                  showMessage("API key revoked.");
                  await loadKeys();
                } catch (error) {
                  handleWorkspaceError(error);
                }
              }, "portal-danger"));
            }

            keyList.append(row);
          }
        } catch (error) {
          keyList.replaceChildren();
          handleWorkspaceError(error);

        }
      }

      authOriginsProjectSelect.addEventListener("change", () => {
        loadCustomerAuthUsage();
      });

      async function loadProjects() {
        const needsProjectList = page === "dashboard" || page === "projects";

        if (needsProjectList) {
          projectList.replaceChildren(
            element("p", {}, "Loading projects…")
          );
        }

        try {
          const result = await api("/developer/projects");
          const projects = Array.isArray(result.projects)
            ? result.projects
            : [];

          // Preserve each page's project selection when refreshing.
          const previous = {
            api: projectSelect.value,
            auth: authOriginsProjectSelect.value,
            storage: storageProjectSelect.value,
            usage: usageProjectSelect.value
          };

          const selectors = [
            projectSelect,
            authOriginsProjectSelect,
            storageProjectSelect,
            usageProjectSelect
          ];

          for (const select of selectors) {
            select.replaceChildren(
              element("option", { value: "" }, "Select a project")
            );
          }

          for (const project of projects) {
            const id = String(project.id);
            const addOption = (select) => {
              select.append(
                element("option", { value: id }, project.name)
              );
            };

            for (const select of selectors) {
              addOption(select);
            }
          }

          const restoreSelection = (select, oldValue, defaultFirst = false) => {
            const exists = projects.some(
              (project) => String(project.id) === oldValue
            );
            select.value = exists
              ? oldValue
              : (defaultFirst && projects.length
                  ? String(projects[0].id)
                  : "");
          };

          restoreSelection(projectSelect, previous.api);
          restoreSelection(authOriginsProjectSelect, previous.auth, true);
          restoreSelection(storageProjectSelect, previous.storage);
          restoreSelection(usageProjectSelect, previous.usage);

          // Load only the service data needed by the current page.
          if (page === "customer-auth") {
            await loadAuthOrigins();
            await loadCustomerAuthUsage();
          }

          if (page === "dashboard" || page === "storage") {
            if (usageProjectSelect.value) {
              await loadStorageUsage();
            } else {
              usagePanel.replaceChildren(
                element(
                  "p",
                  {},
                  "Select a project to view its storage usage."
                )
              );
            }
          }

          if (page === "storage-keys") {
            if (storageProjectSelect.value) {
              await loadStorageKeys();
            } else {
              storageKeyList.replaceChildren(
                element(
                  "p",
                  {},
                  "Select a project to view its storage keys."
                )
              );
            }
          }

          if (!needsProjectList) {
            return;
          }

          projectList.replaceChildren();

          if (projects.length === 0) {
            projectList.append(
              element("p", {}, "No projects yet. Create your first project.")
            );
            return;
          }

          for (const project of projects) {
            const row = element("article", {
              className: "portal-project"
            });

            row.append(
              element("strong", {}, project.name),
              element("span", {}, `Project ID: ${project.id}`),
              element(
                "span",
                {},
                `Public Project ID: ${project.public_id || "Unavailable"}`
              )
            );

            if (
              typeof project.public_id === "string" &&
              project.public_id
            ) {
              row.append(button("Copy public ID", async () => {
                try {
                  if (!navigator.clipboard?.writeText) {
                    throw new Error(
                      "Clipboard access is unavailable in this browser."
                    );
                  }
                  await navigator.clipboard.writeText(project.public_id);
                  showMessage("Public Project ID copied.");
                } catch (error) {
                  showMessage(error.message, true);
                }
              }, "portal-secondary-button"));
            }

            projectList.append(row);
          }
        } catch (error) {
          if (needsProjectList) {
            projectList.replaceChildren();
          }
          handleWorkspaceError(error);
        }
      }

      if (page === "dashboard") {
        // Overview uses the existing project list and Storage usage loaders.
        const overviewHero = element("section", {
          className: "overview-hero"
        });
        overviewHero.append(
          element("p", { className: "overview-eyebrow" }, "SEENRO DEVELOPER WORKSPACE"),
          element("h2", {}, "Build and manage your applications"),
          element(
            "p",
            {},
            "Create a project, configure the services it needs, integrate with your application, and monitor usage from one workspace."
          )
        );

        const overviewActions = element("div", {
          className: "overview-actions"
        });
        overviewActions.append(
          element("a", {
            href: "projects.html",
            className: "overview-action overview-action-primary"
          }, "Create or manage projects"),
          element("a", {
            href: "customer-auth.html",
            className: "overview-action"
          }, "Configure Customer Authentication"),
          element("a", {
            href: "storage.html",
            className: "overview-action"
          }, "Configure Storage"),
          element("a", {
            href: "docs.html",
            className: "overview-action"
          }, "Read integration guides")
        );

        const overviewSectionTitle = element("h3", {}, "Platform services");
        const overviewServices = element("div", {
          className: "overview-services"
        });

        const serviceCard = (title, description, status, href) => {
          const card = element("article", {
            className: "overview-service-card"
          });
          const cardHeading = element("div", {
            className: "overview-service-heading"
          });
          cardHeading.append(
            element("h4", {}, title),
            element("span", {
              className: "overview-service-status"
            }, status)
          );
          card.append(
            cardHeading,
            element("p", {}, description)
          );
          if (href) {
            card.append(element("a", {
              href,
              className: "overview-service-link"
            }, "Open service"));
          }
          return card;
        };

        overviewServices.append(
          serviceCard(
            "Customer Authentication",
            "Configure phone-based customer authentication for applications built with SEENRO.",
            "Configure",
            "customer-auth.html"
          ),
          serviceCard(
            "Storage",
            "Manage project storage settings and review the available usage information.",
            "Configure",
            "storage.html"
          ),
          serviceCard(
            "Database",
            "The managed database service is still under development.",
            "Coming soon",
            null
          ),
          serviceCard(
            "Developer documentation",
            "Explore integration guidance and API information for building with SEENRO.",
            "Documentation",
            "docs.html"
          )
        );

        panel.append(
          overviewHero,
          overviewActions,
          overviewSectionTitle,
          overviewServices,
          heading,
          refresh,
          projectList,
          usageProjectField,
          usagePanel
        );
      } else if (page === "projects") {
        panel.append(
          heading,
          createForm,
          refresh,
          projectList
        );
      } else if (page === "customer-auth") {
        const docsResponse = await fetch("customer-auth-content.html", {
          credentials: "same-origin"
        });

        if (!docsResponse.ok) {
          throw new Error("Customer Authentication documentation could not be loaded.");
        }

        const docsMarkup = await docsResponse.text();
        const parsedDocs = new DOMParser().parseFromString(
          docsMarkup,
          "text/html"
        );
        const sourceDocs = parsedDocs.querySelector(".auth-docs");

        if (!sourceDocs) {
          throw new Error("Customer Authentication documentation is incomplete.");
        }

        const docsPanel = element("div", {
          className: "portal-docs"
        });

        for (const child of sourceDocs.childNodes) {
          docsPanel.append(document.importNode(child, true));
        }

        panel.append(
          docsPanel,
          authUnitsPanel,
          customerAuthUsagePanel,
          authOriginsPanel
        );
      } else if (page === "api-keys") {
        panel.append(
          keyHeading,
          keyForm,
          createdKeyPanel,
          refreshKeys,
          keyList
        );
      } else if (page === "storage-keys") {
        panel.append(
          storageHeading,
          storageDescription,
          storageProjectField,
          storageForm,
          storageCreatedPanel,
          refreshStorageKeys,
          storageKeyList
        );
      } else if (page === "storage") {
        panel.append(
          storageHeading,
          storageDescription,
          usageProjectField,
          usagePanel,
          storagePlanField,
          storageCheckoutButton,
          storageCheckoutStatus
        );
      } else if (page === "account") {
        panel.append(
          element("p", {}, "Manage your signed-in developer session."),
          signOut
        );
      }

      await loadProjects();

      if (page === "api-keys") {
        await loadKeys();
      }
    }

    handleEmailLink().then((handled) => {
      if (handled) return;

      if (workspacePages.includes(page)) {
        if (!session.get()) {
          window.location.replace("login.html");
          return;
        }

        renderWorkspace().catch(() => {
          session.clear();
          window.location.replace("login.html");
        });
        return;
      }

      if (session.get()) {
        window.location.replace("dashboard.html");
        return;
      }

      renderAuth(page);
    }).catch((error) => {
      session.clear();
      if (workspacePages.includes(page)) {
        window.location.replace("login.html");
        return;
      }
      renderAuth("login");
      showMessage(
        error.message || "Unable to process the email link.",
        true
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
