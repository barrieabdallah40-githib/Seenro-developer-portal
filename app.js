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

      throw new Error(message);
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
            showMessage(
              result.message ||
              "Registration request succeeded. Please sign in."
            );
            setMode("login");
            return;
          }

          const token = result.token;

          if (!token) {
            throw new Error(
              "The login response did not contain the expected token field. " +
              "No session was saved. Verify the Core login response format."
            );
          }

          session.set(token);
          await renderWorkspace();
          showMessage("Signed in successfully.");
        } catch (error) {
          showMessage(error.message, true);
        } finally {
          submit.disabled = false;
        }
      });

      panel.append(tabs, form);
    }

    async function renderWorkspace() {
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
            body: JSON.stringify({ name, scopes })
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

    if (session.get()) {
      renderWorkspace().catch((error) => {
        session.clear();
        renderAuth();
        showMessage(error.message, true);
      });
    } else {
      renderAuth();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
