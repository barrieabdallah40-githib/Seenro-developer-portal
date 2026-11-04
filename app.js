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
    const main = document.querySelector("main");
    if (!main) return;

    const section = element("section", {
      className: "section portal-console",
      id: "developer-console"
    });

    section.append(
      element("p", { className: "eyebrow" }, "DEVELOPER WORKSPACE"),
      element("h2", {}, "Your developer account")
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

    function renderAuth() {
      panel.replaceChildren();

      const tabs = element("div", { className: "portal-actions" });
      const form = element("form", { className: "portal-form" });
      let mode = "login";

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

      tabs.append(
        button("Sign in", () => setMode("login")),
        button("Register", () => setMode("register"))
      );

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
            setMode("login");
            showMessage(result.message ||
              "Registration received. Check your email for a verification link before signing in.");
            return;
          }

          const token = result.token;
          if (!token) {
            throw new Error(
              "The login response did not contain the expected token field. No session was saved."
            );
          }

          session.set(token);
          await renderWorkspace();
          showMessage("Signed in successfully.");
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

      recovery.append(forgotForm, resendForm);
      panel.append(tabs, form, recovery);
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
        button("Back to sign in", () => renderAuth(), "portal-secondary-button")
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
          showMessage(result.message || "Password reset successfully. You can now sign in.");
          renderAuth();
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
        renderAuth();
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

    async function renderWorkspace() {
      if (!session.get()) {
        panel.replaceChildren();
        renderAuth();
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
        scopeCheckbox("notes:read", true),
        scopeCheckbox("notes:write")
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
        renderAuth();
        showMessage("Signed out.");
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
          showMessage(error.message, true);
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
          keyForm.querySelector('input[value="notes:read"]').checked = true;
          showMessage("API key created. Copy the secret now.");
          await loadKeys();
        } catch (error) {
          showMessage(error.message, true);
        } finally {
          submit.disabled = false;
        }
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
                  showMessage(error.message, true);
                }
              }, "portal-danger"));
            }

            keyList.append(row);
          }
        } catch (error) {
          keyList.replaceChildren();
          showMessage(error.message, true);

          if (/unauthorized|invalid session/i.test(error.message)) {
            session.clear();
            renderAuth();
          }
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

          for (const project of projects) {
            projectSelect.append(
              element(
                "option",
                { value: String(project.id) },
                project.name
              )
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

            row.append(button("Delete", async () => {
              if (!window.confirm(`Delete project "${project.name}"?`)) {
                return;
              }

              try {
                await api(
                  `/developer/projects/${encodeURIComponent(project.id)}`,
                  { method: "DELETE" }
                );
                showMessage("Project deleted.");
                await loadProjects();
              } catch (error) {
                showMessage(error.message, true);
              }
            }, "portal-danger"));

            projectList.append(row);
          }
        } catch (error) {
          projectList.replaceChildren();
          showMessage(error.message, true);

          if (/unauthorized|invalid session/i.test(error.message)) {
            session.clear();
            renderAuth();
          }
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

      if (session.get()) {
        renderWorkspace().catch((error) => {
          session.clear();
          renderAuth();
          showMessage(error.message, true);
        });
      } else {
        renderAuth();
      }
    }).catch((error) => {
      session.clear();
      renderAuth();
      showMessage(error.message || "Unable to process the email link.", true);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
