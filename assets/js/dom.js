export function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element;
}

export function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = String(options.text);
  }

  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value !== undefined && value !== null) {
        element.setAttribute(name, String(value));
      }
    }
  }

  return element;
}

export function clearElement(element) {
  element.replaceChildren();
}

export function setHidden(element, hidden) {
  element.hidden = Boolean(hidden);
}

export function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
  element.hidden = false;
}

export function formatNumber(value) {
  return Number(value).toLocaleString();
}

export function numberOrZero(value) {
  const number = parseInt(value, 10);
  return Number.isNaN(number) ? 0 : number;
}

export function columnIndex(header, columns) {
  return Object.fromEntries(
    Object.entries(columns).map(([key, columnName]) => [key, header.indexOf(columnName)])
  );
}
