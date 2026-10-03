function isObject(obj: unknown): obj is Record<string, unknown> {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
}

function isArray(obj: unknown): obj is unknown[] {
  return Array.isArray(obj);
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function transformRequestPayload(obj: unknown): unknown {
  if (isArray(obj)) {
    return obj.map(transformRequestPayload);
  }

  if (isObject(obj)) {
    return Object.entries(obj).reduce(
      (acc, [key, value]) => {
        const snakeKey = camelToSnake(key);
        acc[snakeKey] = transformRequestPayload(value);
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  return obj;
}

export function transformResponsePayload(obj: unknown): unknown {
  if (isArray(obj)) {
    return obj.map(transformResponsePayload);
  }

  if (isObject(obj)) {
    return Object.entries(obj).reduce(
      (acc, [key, value]) => {
        const camelKey = snakeToCamel(key);
        acc[camelKey] = transformResponsePayload(value);
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  return obj;
}

export function transformQueryParams(
  params: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!params) return undefined;

  return Object.entries(params).reduce(
    (acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        acc[camelToSnake(key)] = value;
      }
      return acc;
    },
    {} as Record<string, unknown>,
  );
}