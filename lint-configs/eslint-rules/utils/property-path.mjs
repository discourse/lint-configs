// Utilities for working with property paths used in @discourseComputed
// decorators. These helpers make it easier to reason about and convert
// parameter property paths to `this`-based optional chaining accessors.

// Extract the "clean" attribute path before special tokens like @each, [],
// or template-style placeholders. Example:
// - "items.@each.title" -> "items"
// - "data.0.value" -> "data.0.value" (numeric index preserved)
// - "payload{?}.name" -> "payload"
export function niceAttr(attr) {
  if (!attr || typeof attr !== "string") {
    return "";
  }

  const parts = attr.split(".");
  let i;

  for (i = 0; i < parts.length; i++) {
    if (parts[i] === "@each" || parts[i] === "[]" || parts[i].includes("{")) {
      break;
    }
  }

  return parts.slice(0, i).join(".");
}

// Convert a `propertyPath` (like "model.poll.title" or "data.0.value") into
// a `this`-prefixed access with optional chaining where appropriate.
// Parameters:
// - propertyPath: original path used in the decorator or parameter mapping
// - useOptionalChaining: if true, emit `?.` and `?.[...]` for nested parts
// - needsTrailingChaining: when true and the path requires it, append a
//   trailing `?.` so that subsequent member access becomes part of the chain.
export function propertyPathToOptionalChaining(
  propertyPath,
  useOptionalChaining = true,
  needsTrailingChaining = false
) {
  const cleanPath = niceAttr(propertyPath);
  const wasExtracted = cleanPath !== propertyPath;

  if (!cleanPath) {
    return "this";
  }

  const parts = cleanPath.split(".");
  let result = "this";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (/^\d+$/.test(part)) {
      // Numeric index -> bracket notation
      if (useOptionalChaining) {
        result += `?.[${part}]`;
      } else {
        result += `[${part}]`;
      }
    } else {
      if (i === 0) {
        result += `.${part}`;
      } else {
        result += useOptionalChaining ? `?.${part}` : `.${part}`;
      }
    }
  }

  if (needsTrailingChaining && useOptionalChaining) {
    if (
      (wasExtracted && parts.length === 1) ||
      (!wasExtracted && parts.length > 1)
    ) {
      result += "?.";
    }
  }

  return result;
}
