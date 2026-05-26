/** App-side unique id (matches the existing repo/queue id format; not RFC-4122). */
export function uuid(): string {
  return (
    Date.now().toString(16) +
    '-' +
    Math.random().toString(16).slice(2, 10) +
    '-' +
    Math.random().toString(16).slice(2, 10)
  );
}
