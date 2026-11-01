import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * TransMi keeps its little server-side state (shared trips, trip alerts) as JSON
 * files under DATA_DIR (default ./.data): nothing to install, survives restarts.
 */
export const dataPath = (...parts: string[]) => path.join(process.env.DATA_DIR || path.join(process.cwd(), '.data'), ...parts);

/** Write atomically (temp file + rename), so a crash never leaves half a file. */
export async function writeJson(file: string, value: unknown) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(value));
    await fs.rename(temp, file);
}

export async function readJson<T>(file: string): Promise<T | null> {
    try {
        return JSON.parse(await fs.readFile(file, 'utf8')) as T;
    } catch {
        return null;
    }
}

/** Delete the files in a folder not touched for maxAgeMs. */
export async function removeOld(folder: string, maxAgeMs: number, now: number) {
    let names: string[] = [];
    try { names = await fs.readdir(folder); } catch { return; }
    await Promise.all(names.map(async (name) => {
        const full = path.join(folder, name);
        try {
            const { mtimeMs } = await fs.stat(full);
            if (now - mtimeMs > maxAgeMs) await fs.unlink(full);
        } catch { /* already gone */ }
    }));
}
