// Runs once when the server starts: resume watching trips that were in progress (see lib/server/tripAlerts)
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { startTripAlerts } = await import('./lib/server/tripAlerts/store');
    startTripAlerts();
}
