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

    if (!["login", "register", "dashboard"].includes(page)) return;

    const main = document.querySelector("main");
    if (!main) return;

    const section = element("section", {
      className: "section portal-console",
      id: "developer-console"
    });

    section.append(
      element(
        "p",
        { className: "eyebrow" },
        page === "dashboard" ? "DEVELOPER WORKSPACE" : "DEVELOPER ACCOUNT"
      ),
      element(
        "h2",
        {},
        page === "dashboard"
          ? "Your developer workspace"
          : page === "register" ? "Create your account" : "Welcome back"
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

      storagePermissions.append(storageReadLabel, storageWriteLabel);

      storageForm.append(
        storageNameField,
        storageProjectField,
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

      const storageUsageHeading = element("h4", {}, "Storage usage");
      const storageUsagePanel = element("div", {
        className: "portal-project-list"
      });
      storageUsagePanel.append(
        element("p", {}, "Select a project to view its storage capacity and usage.")
      );

      const storageSubscriptionHeading = element("h4", {}, "Storage subscriptions");
      const storagePlanSelect = element("select", {
        name: "storage_plan",
        required: "required"
      });

      storagePlanSelect.append(
        element("option", { value: "starter" }, "Starter — 5 GB — SLE 25 / 30 days"),
        element("option", { value: "basic" }, "Basic — 20 GB — SLE 100 / 30 days"),
        element("option", { value: "growth" }, "Growth — 50 GB — SLE 250 / 30 days"),
        element("option", { value: "business" }, "Business — 100 GB — SLE 500 / 30 days")
      );

      const storagePlanField = element("label", {
        className: "portal-field"
      });
      storagePlanField.append(
        element("span", {}, "Choose a monthly storage plan"),
        storagePlanSelect
      );

      const storageCheckoutStatus = element("p", {});
      const storageCheckoutButton = button(
        "Pay with Monime",
        startStorageCheckout
      );

      async function startStorageCheckout() {
        const projectId = storageProjectSelect.value;
        const planCode = storagePlanSelect.value;

        if (!projectId) {
          showMessage("Select a project before purchasing storage.", true);
          return;
        }

        if (!["starter", "basic", "growth", "business"].includes(planCode)) {
          showMessage("Select a valid storage plan.", true);
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
            error.message || "Could not create checkout.";

          showMessage(
            error.message || "Could not create storage checkout.",
            true
          );

          storageCheckoutButton.disabled = false;
          handleWorkspaceError(error);
        }
      }

      const objectManagerHeading = element("h4", {}, "Storage object manager");
      const objectManagerDescription = element(
        "p",
        {},
        "Developer testing tool. Enter a Storage API key with the required permissions. The key stays in this page's memory and is not saved."
      );

      const storageSecretField = element("label", {
        className: "portal-field"
      });
      storageSecretField.append(
        element("span", {}, "Storage API key (st_live_)"),
        element("input", {
          type: "password",
          name: "storage_test_secret",
          autocomplete: "new-password",
          spellcheck: "false",
          placeholder: "Paste a Storage API key"
        })
      );
      const storageSecretInput = storageSecretField.querySelector("input");

      const storageFileField = element("label", {
        className: "portal-field"
      });
      storageFileField.append(
        element("span", {}, "Choose an image, video or other file"),
        element("input", {
          type: "file",
          name: "storage_upload_file"
        })
      );
      const storageFileInput = storageFileField.querySelector("input");

      const uploadStorageButton = button(
        "Upload file",
        uploadStorageObject
      );
      const refreshObjectsButton = button(
        "Refresh objects",
        loadStorageObjects,
        "portal-secondary-button"
      );
      const storageObjectList = element("div", {
        className: "portal-project-list"
      });
      storageObjectList.append(
        element("p", {}, "Enter a Storage API key to list this project's objects.")
      );

      const customerUploadWarning = element("p", {
        className: "storage-security-note"
      },
        "Production integration warning: never put a st_live_ key in browser JavaScript, a mobile app, or code delivered to customers. Customer uploads require a trusted developer server to authorize each upload. This dashboard tool is for developer testing only."
      );

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
        storageSecretInput.value = "";
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

        if (!projectId) {
          showMessage("Select a project for this storage key.", true);
          return;
        }

        if (!canRead && !canWrite) {
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
                can_write: canWrite
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

      function formatStorageBytes(value) {
        const bytes = Number(value);
        if (!Number.isFinite(bytes) || bytes < 0) return "Unavailable";
        if (bytes < 1024) return `${bytes} B`;
        const units = ["KB", "MB", "GB", "TB"];
        let amount = bytes / 1024;
        let unit = 0;
        while (amount >= 1024 && unit < units.length - 1) {
          amount /= 1024;
          unit += 1;
        }
        return `${amount.toFixed(2)} ${units[unit]}`;
      }

      async function loadStorageUsage() {
        const projectId = storageProjectSelect.value;
        if (!projectId) {
          storageUsagePanel.replaceChildren(
            element("p", {}, "Select a project to view storage usage.")
          );
          return;
        }

        storageUsagePanel.replaceChildren(
          element("p", {}, "Loading storage usage…")
        );

        try {
          const usage = await api(
            `/projects/${encodeURIComponent(projectId)}/storage/usage`
          );

          storageUsagePanel.replaceChildren(
            element("span", {}, `Total project capacity: ${formatStorageBytes(usage.total_capacity_bytes)}`),
            element("span", {}, `Used: ${formatStorageBytes(usage.used_bytes)}`),
            element("span", {}, `Available: ${formatStorageBytes(usage.available_bytes)}`),
            element("span", {}, `Account-wide free capacity: ${formatStorageBytes(usage.free_capacity_bytes)}`),
            element("span", {}, `Project paid capacity: ${formatStorageBytes(usage.project_paid_capacity_bytes)}`),
            element("span", {}, `Monthly capacity: ${formatStorageBytes(usage.monthly_capacity_bytes)}`),
            element("p", {}, "Usage may include objects pending deletion.")
          );
        } catch (error) {
          storageUsagePanel.replaceChildren(
            element("p", {}, error.message || "Could not load storage usage.")
          );
          handleWorkspaceError(error);
        }
      }

      function storageObjectUrl(projectId, objectId) {
        return `${API_BASE}/projects/${encodeURIComponent(projectId)}/storage/objects/${encodeURIComponent(objectId)}`;
      }

      async function storageObjectRequest(url, options = {}) {
        const secret = storageSecretInput.value.trim();
        if (!secret || !secret.startsWith("st_live_")) {
          throw new Error("Enter a valid-looking st_live_ Storage API key first.");
        }

        const response = await fetch(url, {
          ...options,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${secret}`,
            ...(options.headers || {})
          }
        });

        const responseText = await response.text();
        let data = null;
        if (responseText) {
          try {
            data = JSON.parse(responseText);
          } catch {
            data = null;
          }
        }

        if (!response.ok) {
          throw new Error(
            data?.error || data?.message || `Storage request failed (${response.status}).`
          );
        }

        return { response, data };
      }

      async function loadStorageObjects() {
        const projectId = storageProjectSelect.value;
        if (!projectId) {
          storageObjectList.replaceChildren(
            element("p", {}, "Select a project first.")
          );
          return;
        }

        if (!storageSecretInput.value.trim()) {
          storageObjectList.replaceChildren(
            element("p", {}, "Enter a Storage API key with read permission to list objects.")
          );
          return;
        }

        storageObjectList.replaceChildren(
          element("p", {}, "Loading storage objects…")
        );

        try {
          const result = await storageObjectRequest(
            `${API_BASE}/projects/${encodeURIComponent(projectId)}/storage/objects`
          );
          const objects = Array.isArray(result.data?.objects)
            ? result.data.objects
            : [];

          storageObjectList.replaceChildren();

          if (objects.length === 0) {
            storageObjectList.append(
              element("p", {}, "No stored objects were returned for this project.")
            );
            return;
          }

          for (const object of objects) {
            const row = element("article", {
              className: "portal-project"
            });

            row.append(
              element("strong", {}, object.filename || object.object_id || "Unnamed object"),
              element("span", {}, `Object ID: ${object.object_id}`),
              element("span", {}, `Type: ${object.content_type || "Unknown"}`),
              element("span", {}, `Size: ${formatStorageBytes(object.size_bytes)}`),
              element("span", {}, `Created: ${object.created_at || "Unknown"}`)
            );

            row.append(
              button("Download", async () => {
                try {
                  const secret = storageSecretInput.value.trim();
                  if (!secret) throw new Error("Enter the Storage API key again.");

                  const response = await fetch(
                    storageObjectUrl(projectId, object.object_id),
                    {
                      headers: { Authorization: `Bearer ${secret}` }
                    }
                  );

                  if (!response.ok) {
                    let message = `Download failed (${response.status}).`;
                    try {
                      const body = await response.json();
                      message = body.error || body.message || message;
                    } catch {}
                    throw new Error(message);
                  }

                  const blob = await response.blob();
                  const objectUrl = URL.createObjectURL(blob);
                  const link = element("a", {
                    href: objectUrl,
                    download: object.filename || "seenro-download"
                  });
                  document.body.append(link);
                  link.click();
                  link.remove();
                  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                } catch (error) {
                  showMessage(error.message, true);
                }
              }, "portal-secondary-button"),
              button("Delete", async () => {
                if (!window.confirm(
                  `Permanently delete "${object.filename || object.object_id}"?`
                )) return;

                try {
                  await storageObjectRequest(
                    storageObjectUrl(projectId, object.object_id),
                    { method: "DELETE" }
                  );
                  showMessage("Storage object deleted.");
                  await loadStorageObjects();
                  await loadStorageUsage();
                } catch (error) {
                  showMessage(error.message, true);
                }
              }, "portal-danger")
            );

            storageObjectList.append(row);
          }
        } catch (error) {
          storageObjectList.replaceChildren(
            element("p", {}, error.message || "Could not load storage objects.")
          );
          showMessage(error.message, true);
        }
      }

      async function uploadStorageObject() {
        const projectId = storageProjectSelect.value;
        const secret = storageSecretInput.value.trim();
        const file = storageFileInput.files?.[0];

        if (!projectId) {
          showMessage("Select a project before uploading.", true);
          return;
        }
        if (!secret || !secret.startsWith("st_live_")) {
          showMessage("Enter a Storage API key with write permission.", true);
          return;
        }
        if (!file) {
          showMessage("Choose a file to upload.", true);
          return;
        }

        uploadStorageButton.disabled = true;
        showMessage("Uploading file…");

        try {
          const response = await fetch(
            `${API_BASE}/projects/${encodeURIComponent(projectId)}/storage/objects`,
            {
              method: "POST",
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${secret}`,
                "X-Filename": file.name,
                "Content-Type": file.type || "application/octet-stream"
              },
              body: file
            }
          );

          const responseText = await response.text();
          let result = null;
          if (responseText) {
            try {
              result = JSON.parse(responseText);
            } catch {
              result = null;
            }
          }

          if (!response.ok) {
            throw new Error(
              result?.error || result?.message ||
              `Upload failed (${response.status}).`
            );
          }

          storageFileInput.value = "";
          showMessage(
            `Upload complete. ${result?.filename || file.name} (${formatStorageBytes(result?.size_bytes ?? file.size)}).`
          );
          await loadStorageObjects();
          await loadStorageUsage();
        } catch (error) {
          showMessage(error.message || "Upload failed.", true);
        } finally {
          uploadStorageButton.disabled = false;
        }
      }

      storageProjectSelect.addEventListener("change", () => {
        storageCreatedPanel.replaceChildren();
        storageSecretInput.value = "";
        storageFileInput.value = "";
        storageObjectList.replaceChildren(
          element("p", {}, "Enter a Storage API key to list this project's objects.")
        );
        loadStorageKeys();
        loadStorageUsage();
      });

      storageSecretInput.addEventListener("input", () => {
        storageObjectList.replaceChildren(
          element("p", {}, "Storage key entered. Refresh objects to load the project's files.")
        );
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

      async function loadProjects() {
        projectList.replaceChildren(
          element("p", {}, "Loading projects…")
        );

        try {
          const result = await api("/developer/projects");
          projectList.replaceChildren();

          const projects = Array.isArray(result.projects)
            ? result.projects
            : [];

          projectSelect.replaceChildren(
            element("option", { value: "" }, "Select a project")
          );
          storageProjectSelect.replaceChildren(
            element("option", { value: "" }, "Select a project")
          );

          for (const project of projects) {
            const option = () => element(
              "option",
              { value: String(project.id) },
              project.name
            );

            projectSelect.append(option());
            storageProjectSelect.append(option());
          }

          if (storageProjectSelect.value) {
            await loadStorageKeys();
          } else {
            storageKeyList.replaceChildren(
              element("p", {}, "Select a project to view its storage keys.")
            );
          }

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
              element("span", {}, `Project ID: ${project.id}`)
            );

            projectList.append(row);
          }
        } catch (error) {
          projectList.replaceChildren();
          handleWorkspaceError(error);

        }
      }

      panel.append(
        heading,
        createForm,
        keyHeading,
        keyForm,
        createdKeyPanel,
        refreshKeys,
        keyList,
        storageHeading,
        storageDescription,
        storageForm,
        storageCreatedPanel,
        refreshStorageKeys,
        storageKeyList,
        storageSubscriptionHeading,
        storagePlanField,
        storageCheckoutButton,
        storageCheckoutStatus,
        storageUsageHeading,
        storageUsagePanel,
        objectManagerHeading,
        objectManagerDescription,
        customerUploadWarning,
        storageSecretField,
        storageFileField,
        uploadStorageButton,
        refreshObjectsButton,
        storageObjectList,
        element("h3", {}, "Project list"),
        refresh,
        projectList,
        signOut
      );

      await loadProjects();
      await loadKeys();
    }

    handleEmailLink().then((handled) => {
      if (handled) return;

      if (page === "dashboard") {
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
      if (page === "dashboard") {
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
