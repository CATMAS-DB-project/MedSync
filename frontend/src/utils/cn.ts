type ClassValue = string | number | boolean | undefined | null | ClassValue[];

function flatten(input: ClassValue[], out: string[]): void {
  for (const item of input) {
    if (!item) continue;
    if (Array.isArray(item)) {
      flatten(item, out);
    } else {
      out.push(String(item));
    }
  }
}

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  flatten(inputs, out);
  return out.join(' ');
}
