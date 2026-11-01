'use client';

import { useState } from 'react';
import { CreditCard, Loader2, MapPin, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { transmilenioApi } from '@/services/transmilenio';
import { useLiveData } from '@/hooks/useLiveData';
import { useAppStore, useHydrated } from '@/stores/app';
import { cn } from '@/lib/utils';

interface SaldoEntry {
    numero_tarjeta: string;
    saldo_tarjeta: string;
    tipo: string;
    ultima_transaccion: string;
}

const cop = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

function relative(dateStr: string): string {
    const d = new Date(dateStr.replace(' UTC', 'Z'));
    if (isNaN(d.getTime())) return dateStr;
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    const days = Math.floor(diff / 86400);
    return days === 1 ? 'ayer' : `hace ${days} días`;
}

/**
 * TuLlave balance, shaped like the card itself. Remembers the number, shows
 * how many trips the balance covers at the current fare.
 */
export default function SaldoCard() {
    const hydrated = useHydrated();
    const cardNumber = useAppStore((s) => s.cardNumber);
    const lastBalance = useAppStore((s) => s.lastBalance);
    const setCard = useAppStore((s) => s.setCard);
    const { data: info } = useLiveData<{ fare: number }>('/api/info');
    const fare = info?.fare || 3550;

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [loading, setLoading] = useState(false);
    const [entry, setEntry] = useState<SaldoEntry | null>(null);
    const [error, setError] = useState<string | null>(null);

    const number = editing ? draft : cardNumber;

    const consultar = async (num: string) => {
        if (num.length < 10) {
            setError('El número de la tarjeta tiene al menos 10 dígitos.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await transmilenioApi.consultarSaldo(num);
            const first: SaldoEntry | undefined = Array.isArray(data) ? data[0] : data;
            const value = parseInt(first?.saldo_tarjeta || '');
            if (!first || Number.isNaN(value)) throw new Error('sin saldo');
            setEntry(first);
            setCard(num, value);
            setEditing(false);
        } catch {
            setError('No encontramos esa tarjeta. Revisa el número impreso al respaldo.');
        }
        setLoading(false);
    };

    const balance = entry ? parseInt(entry.saldo_tarjeta) : lastBalance?.value ?? null;
    const trips = balance !== null ? Math.floor(balance / fare) : null;
    const showForm = hydrated && (editing || !cardNumber);

    return (
        <section aria-label="Saldo TuLlave" className="relative overflow-hidden rounded-2xl bg-[#0a0a0a] text-white p-5 ring-1 ring-white/10">
            {/* Card artwork: the system stripe as the card's magnetic band */}
            <div className="absolute inset-x-0 top-0 system-stripe h-[5px]" aria-hidden />

            <div className="flex items-start justify-between">
                <div>
                    <p className="text-13 text-white/60">Saldo TuLlave</p>
                    {balance !== null && !showForm ? (
                        <p className="font-signage text-44 font-bold leading-none tabular mt-1">{cop(balance)}</p>
                    ) : (
                        <p className="font-signage text-26 font-semibold leading-tight mt-1">Consulta tu tarjeta</p>
                    )}
                </div>
                <CreditCard className="w-7 h-7 text-white/40" />
            </div>

            {balance !== null && !showForm && (
                <p className={cn('mt-2 text-14', trips !== null && trips < 2 ? 'text-[#FCBD1B]' : 'text-white/75')}>
                    {trips === 0 ? 'No alcanza para un pasaje. ' : `Alcanza para ${trips} ${trips === 1 ? 'viaje' : 'viajes'} `}
                    <span className="text-white/45">· pasaje {cop(fare)}</span>
                </p>
            )}

            {showForm ? (
                <form
                    className="mt-4 flex gap-2"
                    onSubmit={(e) => { e.preventDefault(); consultar(draft || cardNumber); }}
                >
                    <label className="sr-only" htmlFor="tullave">Número de tarjeta</label>
                    <input
                        id="tullave"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Número de tarjeta"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 20))}
                        className="flex-1 min-w-0 h-11 rounded-xl bg-white/10 px-3.5 text-16 tabular placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40"
                    />
                    <button
                        type="submit"
                        disabled={loading || draft.length < 10}
                        className="h-11 px-4 rounded-xl bg-white text-black text-14 font-semibold disabled:opacity-40 active:scale-95 transition"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Consultar'}
                    </button>
                </form>
            ) : hydrated && (
                <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-13 text-white/55 tabular">
                        •••• {number.slice(-4)}
                        {entry?.ultima_transaccion && <> · último uso {relative(entry.ultima_transaccion)}</>}
                        {!entry && lastBalance && <> · consultado {relative(lastBalance.at)}</>}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => consultar(cardNumber)}
                            disabled={loading}
                            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition"
                            aria-label="Actualizar saldo"
                        >
                            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                        </button>
                        <button
                            onClick={() => { setDraft(''); setEditing(true); }}
                            className="h-9 px-3 rounded-full text-13 font-medium hover:bg-white/10 transition"
                        >
                            Cambiar
                        </button>
                    </div>
                </div>
            )}

            {error && <p className="mt-2 text-13 text-[#ff8a8a]" role="alert">{error}</p>}

            {trips !== null && trips < 2 && !showForm && (
                <Link href="/mapa?capa=recarga" className="mt-3 inline-flex items-center gap-1.5 text-13 font-semibold text-white underline underline-offset-4">
                    <MapPin className="w-3.5 h-3.5" /> Puntos de recarga cerca
                </Link>
            )}
        </section>
    );
}
