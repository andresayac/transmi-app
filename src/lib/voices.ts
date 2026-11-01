/**
 * Neural voices from Microsoft Edge's read-aloud service (via @andresaya/edge-tts).
 * The "Multilingual" voices speak the language of the text they get, so these US
 * voices read Spanish naturally.
 */
export interface TtsVoice {
    id: string;
    name: string;
    gender: 'Mujer' | 'Hombre';
    /** How the voice sounds, in the user's words */
    style: string;
}

export const TTS_VOICES: TtsVoice[] = [
    { id: 'en-US-AvaMultilingualNeural', name: 'Ava', gender: 'Mujer', style: 'Expresiva y cálida' },
    { id: 'en-US-EmmaMultilingualNeural', name: 'Emma', gender: 'Mujer', style: 'Alegre y clara' },
    { id: 'en-US-AndrewMultilingualNeural', name: 'Andrew', gender: 'Hombre', style: 'Cálido y seguro' },
    { id: 'en-US-BrianMultilingualNeural', name: 'Brian', gender: 'Hombre', style: 'Cercano y tranquilo' },
];

export const DEFAULT_TTS_VOICE = TTS_VOICES[0].id;

export function isKnownVoice(id: string | null | undefined): id is string {
    return !!id && TTS_VOICES.some((v) => v.id === id);
}

/** Longest text the /api/voz endpoint accepts in one request (the client splits longer text). */
export const TTS_MAX_CHARS = 600;
