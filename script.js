(() => {
  "use strict";

  const API_URL = "https://mental-health-prediction-64u1.onrender.com/predict";
  const TIMEOUT_MS = 15000;

  // Mirrors the StudentData Pydantic model in main.py.
  const FIELDS = {
    age:                     { label: "Age", type: "int", min: 0, max: 120 },
    gender:                  { label: "Gender", type: "choice", options: ["Male", "Female", "Other"] },
    country:                 { label: "Country", type: "text" },
    academic_level:          { label: "Academic level", type: "choice",
                               options: ["High School", "Undergraduate", "Graduate", "Postgraduate"] },
    most_used_platform:      { label: "Most used platform", type: "choice",
                               options: ["Facebook", "Instagram", "Twitter", "Snapchat", "TikTok", "YouTube",
                                         "LinkedIn", "LINE", "KakaoTalk", "VKontakte", "WhatsApp", "WeChat", "Other"] },
    purpose_of_use:          { label: "Purpose of use", type: "choice",
                               options: ["Socializing", "Entertainment", "News", "Education", "Work", "Other"] },
    avg_daily_usage_hours:   { label: "Average daily usage", type: "float", min: 0, max: 24 },
    daily_unlocks:           { label: "Daily phone unlocks", type: "int", min: 0 },
    study_hours:             { label: "Study hours", type: "float", min: 0, max: 24 },
    physical_activity_hours: { label: "Physical activity", type: "float", min: 0, max: 24 },
    sleep_hours_per_night:   { label: "Sleep per night", type: "float", min: 0, max: 24 },
    stress_level:            { label: "Stress level", type: "choice", options: ["Low", "Medium", "High", "Very High"] },
  };

  const form = document.getElementById("prediction-form");
  const submitBtn = document.getElementById("submit-btn");
  const btnLabel = submitBtn.querySelector(".btn-label");
  const spinner = submitBtn.querySelector(".spinner");
  const formAlert = document.getElementById("form-alert");
  const statusEl = document.getElementById("status");
  const resultCard = document.getElementById("result-card");
  const resultValue = document.getElementById("result-value");

  /* ---------- Validation ---------- */

  function validateField(name) {
    const rule = FIELDS[name];
    const input = form.elements[name];
    const value = input.value.trim();

    if (value === "") {
      if (input.validity.badInput) return `Enter a valid number for ${rule.label.toLowerCase()}.`;
      return `${rule.label} is required.`;
    }

    if (rule.type === "text") return "";

    if (rule.type === "choice") {
      return rule.options.includes(value) ? "" : "Choose one of the listed options.";
    }

    const num = Number(value);
    if (!Number.isFinite(num)) return "Enter a valid number.";
    if (rule.type === "int" && !Number.isInteger(num)) return "Enter a whole number.";
    if (rule.min !== undefined && num < rule.min) return `Must be ${rule.min} or more.`;
    if (rule.max !== undefined && num > rule.max) return `Must be ${rule.max} or less.`;
    return "";
  }

  function setFieldError(name, message) {
    const input = form.elements[name];
    const errorEl = document.getElementById(`${name}-error`);
    errorEl.textContent = message;
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function clearAllErrors() {
    for (const name of Object.keys(FIELDS)) setFieldError(name, "");
    formAlert.hidden = true;
    formAlert.textContent = "";
  }

  function validateAll() {
    const invalid = [];
    for (const name of Object.keys(FIELDS)) {
      const message = validateField(name);
      setFieldError(name, message);
      if (message) invalid.push(name);
    }
    return invalid;
  }

  // Re-check a field as the user corrects it, but only if it currently shows an error.
  form.addEventListener("input", (event) => {
    const name = event.target.name;
    if (!FIELDS[name]) return;
    if (document.getElementById(`${name}-error`).textContent) {
      setFieldError(name, validateField(name));
    }
  });

  /* ---------- UI helpers ---------- */

  function showAlert(message) {
    formAlert.textContent = message;
    formAlert.hidden = false;
  }

  function announce(message) {
    statusEl.textContent = message;
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    spinner.hidden = !isLoading;
    btnLabel.textContent = isLoading ? "Predicting…" : "Predict score";
    form.setAttribute("aria-busy", String(isLoading));
  }

  function showResult(score) {
    resultValue.textContent = score.toFixed(2);
    resultCard.hidden = false;
    resultCard.focus({ preventScroll: false });
  }

  function hideResult() {
    resultCard.hidden = true;
  }

  function focusFirstInvalid(names) {
    if (names.length) form.elements[names[0]].focus();
  }

  /* ---------- Payload and request ---------- */

  function buildPayload() {
    const payload = {};
    for (const [name, rule] of Object.entries(FIELDS)) {
      const raw = form.elements[name].value.trim();
      if (rule.type === "text" || rule.type === "choice") {
        payload[name] = raw;
      } else if (rule.type === "int") {
        payload[name] = parseInt(raw, 10);
      } else {
        payload[name] = Number(raw);
      }
    }
    return payload;
  }

  async function requestPrediction(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { response, body };
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- Error handling ---------- */

  function handleValidationError(detail) {
    const items = Array.isArray(detail) ? detail : [];
    const fieldErrors = [];
    const generalMessages = [];

    for (const item of items) {
      const loc = Array.isArray(item.loc) ? item.loc : [];
      const field = loc[loc.length - 1];
      const msg = item.msg || "is not valid";
      if (field && FIELDS[field]) {
        setFieldError(field, `Server: ${msg}.`);
        fieldErrors.push(field);
      } else {
        generalMessages.push(msg);
      }
    }

    const count = fieldErrors.length + generalMessages.length;
    showAlert(
      `The server rejected ${count} ${count === 1 ? "value" : "values"}. ` +
      "Correct the highlighted fields and try again. Your entries are still filled in."
    );
    focusFirstInvalid(fieldErrors);
    announce(`The server rejected ${count} ${count === 1 ? "value" : "values"}.`);
  }

  function handleHttpError(status, body) {
    const detailText = typeof body?.detail === "string" ? ` Details: ${body.detail}` : "";

    if (status === 422) {
      handleValidationError(body?.detail);
      return;
    }

    if (status === 405) {
      const msg =
        "The backend does not accept POST on /predict (405 Method Not Allowed). " +
        "Check that the route in main.py is decorated with @app.post. Your entries are still filled in.";
      showAlert(msg);
      announce("The backend does not accept this request method.");
      return;
    }

    if (status >= 500) {
      const msg =
        `The server hit an error (${status}). Check the FastAPI terminal for a traceback, then try again. ` +
        "Your entries are still filled in.";
      showAlert(msg);
      announce("The server returned an error.");
      return;
    }

    showAlert(`The request failed with status ${status}.${detailText} Your entries are still filled in.`);
    announce(`The request failed with status ${status}.`);
  }

  function handleNetworkError(error) {
    if (error && error.name === "AbortError") {
      showAlert("The request timed out. The backend may be busy or stopped responding. Your entries are still filled in.");
      announce("The request timed out.");
      return;
    }
    showAlert(
      `Could not connect to the backend at ${API_URL}. Make sure the FastAPI server is running on port 2200. ` +
      "Your entries are still filled in."
    );
    announce("Could not connect to the backend.");
  }

  /* ---------- Submit ---------- */

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAllErrors();
    hideResult();

    const invalid = validateAll();
    if (invalid.length) {
      showAlert("Please correct the highlighted fields before predicting.");
      focusFirstInvalid(invalid);
      announce(`${invalid.length} ${invalid.length === 1 ? "field needs" : "fields need"} attention.`);
      return;
    }

    setLoading(true);
    announce("Calculating your predicted score. Please wait.");

    try {
      const { response, body } = await requestPrediction(buildPayload());

      if (!response.ok) {
        handleHttpError(response.status, body);
        return;
      }

      const score = body?.predicted_mental_health_score;
      if (typeof score !== "number" || !Number.isFinite(score)) {
        showAlert("The server responded, but the prediction was missing or not a number. Please try again.");
        announce("The prediction response was not in the expected format.");
        return;
      }

      showResult(score);
      announce(`Predicted mental health score: ${score.toFixed(2)}. This is a model estimate.`);
    } catch (error) {
      handleNetworkError(error);
    } finally {
      setLoading(false);
    }
  });
})();