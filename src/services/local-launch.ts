export function resolveLocalPort(args: string[], envPort?: string): string {
  const inline = args.find((arg) => arg.startsWith("--port="));
  if (inline) return inline.slice("--port=".length);

  const index = args.indexOf("--port");
  if (index >= 0 && args[index + 1]) return args[index + 1];

  return envPort ?? "3000";
}
