'use client';

import { Clock3 } from 'lucide-react';
import type { Departure } from './utils';
import { cn } from '@/lib/utils';

interface DeparturePickerProps {
    value: Departure;
    /** Today in Bogotá, yyyy-MM-dd — used as the default and minimum date */
    today: string;
    nowTime: string;
    onChange: (value: Departure) => void;
}

/** "Salir ahora" or a scheduled departure (date + time, Bogotá time). */
export default function DeparturePicker({ value, today, nowTime, onChange }: DeparturePickerProps) {
    const scheduled = value.mode === 'at';
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-secondary p-1" role="radiogroup" aria-label="Hora de salida">
                <button
                    type="button"
                    role="radio"
                    aria-checked={!scheduled}
                    onClick={() => onChange({ ...value, mode: 'now' })}
                    className={cn('px-3.5 h-8 rounded-full text-[13px] font-semibold transition-colors', !scheduled ? 'bg-foreground text-background' : 'text-muted-foreground')}
                >
                    Salir ahora
                </button>
                <button
                    type="button"
                    role="radio"
                    aria-checked={scheduled}
                    onClick={() => onChange({ mode: 'at', date: value.date || today, time: value.time || nowTime })}
                    className={cn('px-3.5 h-8 rounded-full text-[13px] font-semibold transition-colors inline-flex items-center gap-1.5', scheduled ? 'bg-foreground text-background' : 'text-muted-foreground')}
                >
                    <Clock3 className="w-3.5 h-3.5" /> Programar
                </button>
            </div>
            {scheduled && (
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={value.date}
                        min={today}
                        onChange={(e) => e.target.value && onChange({ ...value, date: e.target.value })}
                        className="h-9 px-2.5 rounded-lg bg-secondary text-[14px] text-foreground outline-none focus:ring-2 focus:ring-ring tabular"
                        aria-label="Día de salida"
                    />
                    <input
                        type="time"
                        value={value.time}
                        onChange={(e) => e.target.value && onChange({ ...value, time: e.target.value })}
                        className="h-9 px-2.5 rounded-lg bg-secondary text-[14px] text-foreground outline-none focus:ring-2 focus:ring-ring tabular"
                        aria-label="Hora de salida"
                    />
                </div>
            )}
        </div>
    );
}
