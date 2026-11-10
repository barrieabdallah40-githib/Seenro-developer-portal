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

    const workspacePages = ["dashboard", "projects", "storage", "api-keys", "storage-keys", "account"];
    if (!["login", "register", ...workspacePages].includes(page)) return;

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
        workspacePages.includes(page) ? "DEVELOPER WORKSPACE" : "DEVELOPER ACCOUNT"
      ),
      element(
        "h2",
        {},
        ({
          dashboard: "Workspace",
          projects: "Projects",
          storage: "Storage",
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
      }, "Pay with Monime");

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

      // Storage object manager: storage credentials stay in memory only.
      let storageSecret = "";
      let storageCanRead = false;
      let storageCanWrite = false;
      let storageConnectionId = 0;
      let storageListRequestId = 0;
      let storageVerificationId = 0;

      const storageFilesHeading = element("h3", {}, "Storage files");
      const storageFilesDescription = element(
        "p", {},
        "Connect a project storage key to manage files. Read permission allows browsing and downloads; write permission allows uploads and deletion. Free storage is 100 MiB shared across your projects. Purchased and monthly subscription capacity belongs to the selected project. Non-video files: maximum 100 MiB. MP4 videos: maximum 250 MB and 5 minutes. Original uploaded bytes are preserved. Keys stay in page memory only."
      );

      const storageKeyConnectForm = element("form", {
        className: "portal-form"
      });
      const storageKeyConnectLabel = element("label", {
        className: "portal-field"
      });
      const storageKeyInput = element("input", {
        type: "password",
        name: "storage_access_key",
        autocomplete: "off",
        autocapitalize: "none",
        spellcheck: "false",
        required: "required"
      });
      storageKeyConnectLabel.append(
        element("span", {}, "Storage key (st_live_…)"),
        storageKeyInput
      );
      storageKeyConnectForm.append(
        storageKeyConnectLabel,
        element("button", {
          type: "submit",
          className: "primary-button"
        }, "Connect storage key")
      );

      const storageConnectionStatus = element("p", {
        role: "status"
      }, "No storage key connected.");

      const storageUploadForm = element("form", {
        className: "portal-form"
      });
      const storageFileLabel = element("label", {
        className: "portal-field"
      });
      const storageFileInput = element("input", {
        type: "file",
        name: "storage_file",
        required: "required"
      });
      storageFileLabel.append(
        element("span", {}, "Choose a file (non-video: 100 MiB; MP4: 250 MB and 5 minutes)"),
        storageFileInput
      );
      storageUploadForm.append(
        storageFileLabel,
        element("button", {
          type: "submit",
          className: "primary-button"
        }, "Upload file")
      );

      const storageObjectList = element("div", {
        className: "portal-project-list"
      });
      storageUploadForm.hidden = true;

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


      async function storageResponseError(response) {
        const responseText = await response.text();
        let data = {};

        if (responseText) {
          try {
            data = JSON.parse(responseText);
          } catch {
            data = { message: responseText };
          }
        }

        const detail = data.error ?? data.message;
        const message = typeof detail === "string"
          ? detail
          : (detail && typeof detail.message === "string")
            ? detail.message
            : `Storage request failed (${response.status})`;

        const error = new Error(message);
        error.status = response.status;
        return error;
      }

      async function storageRequest(
        path,
        options = {},
        secret = storageSecret
      ) {
        if (!secret) {
          throw new Error("Connect a storage key first.");
        }

        const response = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers: {
            "Accept": "application/json",
            ...(options.headers || {}),
            "Authorization": `Bearer ${secret}`
          }
        });

        if (!response.ok) {
          throw await storageResponseError(response);
        }
        if (response.status === 204) return null;

        const responseText = await response.text();
        if (!responseText) return {};

        try {
          return JSON.parse(responseText);
        } catch {
          throw new Error("The storage API returned an invalid response.");
        }
      }

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

      function handleStorageError(error, expectedSecret = storageSecret) {
        if (error.status === 401 && storageSecret === expectedSecret) {
          storageSecret = "";
          storageCanRead = false;
          storageCanWrite = false;
          storageConnectionId++;
          storageVerificationId++;
          storageKeyInput.value = "";
          storageUploadForm.hidden = true;
          storageRefreshButton.disabled = true;
          storageDisconnectButton.disabled = true;
          storageConnectionStatus.textContent =
            "Storage key rejected. Connect a valid key.";
          storageObjectList.replaceChildren(
            element("p", {}, "Connect a storage key to view this project's files.")
          );
        }

        showMessage(error.message || "Storage request failed.", true);
      }

      async function loadStorageObjects() {
        const projectId = storageProjectSelect.value;
        const secret = storageSecret;
        const connectionId = storageConnectionId;
        const requestId = ++storageListRequestId;

        if (!projectId) {
          storageObjectList.replaceChildren(
            element("p", {}, "Select a project first.")
          );
          return;
        }

        if (!secret) {
          storageObjectList.replaceChildren(
            element("p", {}, "Connect a storage key to view this project's files.")
          );
          return;
        }

        if (!storageCanRead) {
          storageObjectList.replaceChildren(
            element("p", {}, "This key is upload-only. Read permission is required to browse or download files.")
          );
          return;
        }

        storageObjectList.replaceChildren(
          element("p", {}, "Loading storage files…")
        );

        try {
          const result = await storageRequest(
            `/projects/${encodeURIComponent(projectId)}/storage/objects`,
            {},
            secret
          );

          if (
            storageProjectSelect.value !== projectId ||
            storageSecret !== secret ||
            storageConnectionId !== connectionId ||
            storageListRequestId !== requestId
          ) {
            return;
          }

          const objects = Array.isArray(result.objects) ? result.objects : [];
          storageObjectList.replaceChildren();

          if (objects.length === 0) {
            storageObjectList.append(
              element("p", {}, "No files in this project yet.")
            );
            return;
          }

          for (const file of objects) {
            const row = element("article", {
              className: "portal-project"
            });

            const details = element("div", {});
            details.append(
              element("strong", {}, file.filename || "Unnamed file"),
              element("span", {}, `${formatStorageSize(file.size_bytes)} · ${file.content_type || "Unknown type"}`),
              element("span", {}, `ID: ${file.object_id || "Unavailable"}`),
              element("span", {}, `SHA-256: ${file.sha256 || "Unavailable"}`)
            );

            if (file.created_at) {
              const created = new Date(Number(file.created_at) * 1000);
              details.append(
                element("span", {}, `Uploaded: ${Number.isNaN(created.getTime()) ? "Unknown" : created.toLocaleString()}`)
              );
            }

            const actions = element("div", {
              className: "portal-actions"
            });

            actions.append(
              button("Download", async () => {
                if (
                  storageProjectSelect.value !== projectId ||
                  storageSecret !== secret ||
                  storageConnectionId !== connectionId
                ) {
                  showMessage("Storage connection changed. Refresh the file list.", true);
                  return;
                }

                try {
                  const response = await fetch(
                    `${API_BASE}/projects/${encodeURIComponent(projectId)}/storage/objects/${encodeURIComponent(file.object_id)}`,
                    {
                      headers: {
                        "Authorization": `Bearer ${secret}`
                      }
                    }
                  );

                  if (!response.ok) {
                    throw await storageResponseError(response);
                  }

                  const blob = await response.blob();

                  if (
                    storageProjectSelect.value !== projectId ||
                    storageSecret !== secret ||
                    storageConnectionId !== connectionId
                  ) {
                    return;
                  }

                  const objectUrl = URL.createObjectURL(blob);
                  const link = element("a", {
                    href: objectUrl,
                    download: file.filename || "download"
                  });

                  document.body.append(link);
                  link.click();
                  link.remove();
                  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                  showMessage(`Downloaded ${file.filename || "file"}.`);
                } catch (error) {
                  if (
                    storageProjectSelect.value === projectId &&
                    storageSecret === secret &&
                    storageConnectionId === connectionId
                  ) {
                    handleStorageError(error, secret);
                  }
                }
              }, "portal-secondary-button")
            );

            if (storageCanWrite) {
              actions.append(
                button("Delete", async () => {
                  if (!window.confirm(
                    `Delete "${file.filename || "this file"}"? This cannot be undone.`
                  )) {
                    return;
                  }

                  if (
                    storageProjectSelect.value !== projectId ||
                    storageSecret !== secret ||
                    storageConnectionId !== connectionId
                  ) {
                    showMessage("Storage connection changed. Refresh the file list.", true);
                    return;
                  }

                  try {
                    await storageRequest(
                      `/projects/${encodeURIComponent(projectId)}/storage/objects/${encodeURIComponent(file.object_id)}`,
                      { method: "DELETE" },
                      secret
                    );

                    if (
                      storageProjectSelect.value !== projectId ||
                      storageSecret !== secret ||
                      storageConnectionId !== connectionId
                    ) {
                      return;
                    }

                    showMessage("File deleted.");
                    await loadStorageObjects();
                  } catch (error) {
                    if (
                      storageProjectSelect.value === projectId &&
                      storageSecret === secret &&
                      storageConnectionId === connectionId
                    ) {
                      handleStorageError(error, secret);
                    }
                  }
                }, "portal-danger")
              );
            }

            row.append(details, actions);
            storageObjectList.append(row);
          }
        } catch (error) {
          if (
            storageProjectSelect.value !== projectId ||
            storageSecret !== secret ||
            storageConnectionId !== connectionId ||
            storageListRequestId !== requestId
          ) {
            return;
          }

          storageObjectList.replaceChildren();
          handleStorageError(error, secret);
        }
      }

      const storageRefreshButton = button(
        "Refresh files",
        loadStorageObjects,
        "portal-secondary-button"
      );
      storageRefreshButton.disabled = true;

      const storageDisconnectButton = button(
        "Disconnect",
        () => {
          storageSecret = "";
          storageCanRead = false;
          storageCanWrite = false;
          storageConnectionId++;
          storageListRequestId++;
          storageVerificationId++;
          storageKeyInput.value = "";
          storageFileInput.value = "";
          storageUploadForm.hidden = true;
          storageRefreshButton.disabled = true;
          storageDisconnectButton.disabled = true;
          storageConnectionStatus.textContent = "Storage key disconnected.";
          storageObjectList.replaceChildren(
            element("p", {}, "Connect a storage key to view this project's files.")
          );
          showMessage("Storage key disconnected.");
        },
        "portal-secondary-button"
      );
      storageDisconnectButton.disabled = true;

      storageKeyConnectForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const verificationId = ++storageVerificationId;

        const candidate = storageKeyInput.value.trim();
        const projectId = storageProjectSelect.value;

        if (!candidate.startsWith("st_live_")) {
          showMessage("That does not look like a SEENRO storage key.", true);
          return;
        }

        if (!projectId) {
          showMessage("Select a project before connecting a storage key.", true);
          return;
        }

        // Clear any previous connection while the new key is being checked.
        storageSecret = "";
        storageCanRead = false;
        storageCanWrite = false;
        storageConnectionId++;
        storageListRequestId++;
        storageKeyInput.value = "";
        storageUploadForm.hidden = true;
        storageRefreshButton.disabled = true;
        storageDisconnectButton.disabled = true;
        storageConnectionStatus.textContent = "Verifying storage key permissions…";
        storageObjectList.replaceChildren(
          element("p", {}, "Verifying storage key…")
        );

        try {
          const result = await api(
            `/projects/${encodeURIComponent(projectId)}/storage/keys`
          );

          if (
            storageProjectSelect.value !== projectId ||
            storageVerificationId !== verificationId
          ) {
            return;
          }

          const keys = Array.isArray(result.keys) ? result.keys : [];
          const matches = keys.filter((key) =>
            !key.revoked_at &&
            typeof key.prefix === "string" &&
            key.prefix.length === 16 &&
            candidate.startsWith(key.prefix)
          );

          if (matches.length !== 1) {
            storageConnectionStatus.textContent = "No storage key connected.";
            storageObjectList.replaceChildren(
              element("p", {}, "The key could not be matched to one active key in this project.")
            );
            showMessage("Storage key could not be verified for this project.", true);
            return;
          }

          const key = matches[0];

          if (
            typeof key.can_read !== "boolean" ||
            typeof key.can_write !== "boolean"
          ) {
            storageConnectionStatus.textContent = "No storage key connected.";
            showMessage("Storage key permissions could not be verified.", true);
            return;
          }

          if (!key.can_read && !key.can_write) {
            storageConnectionStatus.textContent = "This key has no storage permissions.";
            storageObjectList.replaceChildren(
              element("p", {}, "This key has neither read nor write permission.")
            );
            showMessage("This storage key has no usable permissions.", true);
            return;
          }

          storageConnectionId++;
          storageSecret = candidate;
          storageCanRead = key.can_read;
          storageCanWrite = key.can_write;
          storageUploadForm.hidden = !storageCanWrite;
          storageRefreshButton.disabled = !storageCanRead;
          storageDisconnectButton.disabled = false;

          const capabilities = [
            storageCanRead ? "read/download" : null,
            storageCanWrite ? "upload/delete" : null
          ].filter(Boolean).join(" and ");

          storageConnectionStatus.textContent =
            `Storage key connected (${capabilities}). The key stays in this page's memory only.`;

          if (storageCanRead) {
            showMessage("Storage key verified. Loading files…");
            await loadStorageObjects();
          } else {
            storageObjectList.replaceChildren(
              element("p", {}, "This key is upload-only. Read permission is required to browse or download files.")
            );
            showMessage("Storage key verified with upload-only permission.");
          }
        } catch (error) {
          if (
            storageProjectSelect.value !== projectId ||
            storageVerificationId !== verificationId
          ) {
            return;
          }

          storageConnectionStatus.textContent = "Storage key verification failed.";
          storageObjectList.replaceChildren(
            element("p", {}, "Could not verify the storage key. Check your developer session and try again.")
          );
          handleWorkspaceError(error);
        }
      });

      storageUploadForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const projectId = storageProjectSelect.value;
        const secret = storageSecret;
        const connectionId = storageConnectionId;
        const file = storageFileInput.files?.[0];

        if (!projectId) {
          showMessage("Select a project before uploading.", true);
          return;
        }
        if (!secret) {
          showMessage("Connect a storage key before uploading.", true);
          return;
        }
        if (!storageCanWrite) {
          showMessage("This storage key does not have write permission.", true);
          return;
        }
        if (!file) {
          showMessage("Choose a file to upload.", true);
          return;
        }
        const isMp4 = file.type.toLowerCase() === "video/mp4" ||
          file.name.toLowerCase().endsWith(".mp4");

        if (isMp4 && file.size > 250_000_000) {
          showMessage("This MP4 exceeds the 250 MB file-size limit.", true);
          return;
        }

        if (!isMp4 && file.size > 100 * 1024 * 1024) {
          showMessage("This non-video file exceeds the 100 MiB file-size limit.", true);
          return;
        }
        if (
          !/^[ -~]{1,255}$/.test(file.name) ||
          file.name === "." ||
          file.name === ".." ||
          file.name.includes("/") ||
          file.name.includes(String.fromCharCode(92))
        ) {
          showMessage(
            "Use a filename of 1–255 printable ASCII characters, without slashes.",
            true
          );
          return;
        }

        const submit = storageUploadForm.querySelector('button[type="submit"]');
        submit.disabled = true;

        try {
          await storageRequest(
            `/projects/${encodeURIComponent(projectId)}/storage/objects`,
            {
              method: "POST",
              headers: {
                "X-Filename": file.name,
                "Content-Type": file.type || "application/octet-stream"
              },
              body: file
            },
            secret
          );

          if (
            storageProjectSelect.value !== projectId ||
            storageSecret !== secret ||
            storageConnectionId !== connectionId
          ) {
            return;
          }

          storageFileInput.value = "";
          showMessage(`Uploaded ${file.name}.`);

          if (storageCanRead) {
            await loadStorageObjects();
          } else {
            storageObjectList.replaceChildren(
              element("p", {}, "Upload complete. This key does not have read permission to browse files.")
            );
          }
        } catch (error) {
          if (
            storageProjectSelect.value === projectId &&
            storageSecret === secret &&
            storageConnectionId === connectionId
          ) {
            handleStorageError(error, secret);
          }
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

      storageProjectSelect.addEventListener("change", () => {
        storageCreatedPanel.replaceChildren();

        // Never carry a project's storage credential into another project.
        storageSecret = "";
        storageCanRead = false;
        storageCanWrite = false;
        storageConnectionId++;
        storageListRequestId++;
        storageVerificationId++;
        storageKeyInput.value = "";
        storageFileInput.value = "";
        storageUploadForm.hidden = true;
        storageRefreshButton.disabled = true;
        storageDisconnectButton.disabled = true;
        storageConnectionStatus.textContent = "No storage key connected.";
        storageObjectList.replaceChildren(
          element("p", {}, "Connect a storage key to view this project's files.")
        );

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
          usageProjectSelect.replaceChildren(
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
            usageProjectSelect.append(option());
          }

          if (usageProjectSelect.value) {
            await loadStorageUsage();
          } else {
            usagePanel.replaceChildren(
              element("p", {}, "Create a project to start viewing storage usage.")
            );
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

      if (page === "dashboard") {
        panel.append(
          usageProjectField,
          usagePanel,
          heading,
          refresh,
          projectList
        );
      } else if (page === "projects") {
        panel.append(
          heading,
          createForm,
          refresh,
          projectList
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
          storagePlanField,
          storageCheckoutButton,
          storageCheckoutStatus,
          storageProjectField,
          storageFilesHeading,
          storageFilesDescription,
          storageKeyConnectForm,
          storageConnectionStatus,
          storageDisconnectButton,
          storageUploadForm,
          storageRefreshButton,
          storageObjectList
        );
      } else if (page === "account") {
        panel.append(
          element("p", {}, "Manage your signed-in developer session."),
          signOut
        );
      }

      await loadProjects();
      await loadKeys();
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
