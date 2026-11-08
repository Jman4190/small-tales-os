export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installSafeConsole } = await import('./lib/safe-console');
    installSafeConsole();
  }
}
