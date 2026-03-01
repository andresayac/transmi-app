'use client';

import { useState, useEffect } from 'react';
import { transmilenioApi } from '@/services/transmilenio';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SaldoEntry {
    numero_tarjeta: string;
    saldo_tarjeta: string;
    tipo: string;
    ultima_transaccion: string;
}

export default function SaldoCard() {
    const [numero, setNumero] = useState('');
    const [loading, setLoading] = useState(false);
    const [entries, setEntries] = useState<SaldoEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('tm_last_card');
        if (saved) setNumero(saved);
    }, []);

    const handleConsultar = async () => {
        if (!numero.trim() || numero.length < 10) return;
        setLoading(true);
        setEntries([]);
        setError(null);
        try {
            localStorage.setItem('tm_last_card', numero);
            const data = await transmilenioApi.consultarSaldo(numero);
            const arr = Array.isArray(data) ? data : [data];
            setEntries(arr);
        } catch {
            setError('No se pudo consultar. Verifica el número de tarjeta.');
        }
        setLoading(false);
    };

    const formatCurrency = (value: string) => {
        const num = parseInt(value);
        if (isNaN(num)) return value;
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(num);
    };

    const formatDate = (date: string) => {
        if (!date) return '';
        try {
            const d = new Date(date.replace(' UTC', 'Z'));
            if (isNaN(d.getTime())) return date;
            const now = new Date();
            const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
            const relative = diff < 60 ? 'Hace un momento'
                : diff < 3600 ? `Hace ${Math.floor(diff / 60)} min`
                    : diff < 86400 ? `Hace ${Math.floor(diff / 3600)}h`
                        : `Hace ${Math.floor(diff / 86400)}d`;
            return `${relative} · ${d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
        } catch {
            return date;
        }
    };

    const saldo = entries[0]?.saldo_tarjeta;
    const lastEntry = entries[0];

    return (
        <div className="mb-3">
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-card border border-border active:scale-[0.98] transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                        <svg className="w-4.5 h-4.5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                    </div>
                    <div className="text-left">
                        <h4 className="text-[13px] font-bold text-foreground">Saldo TuLlave</h4>
                        <p className="text-[11px] text-muted-foreground">
                            {saldo ? formatCurrency(saldo) : 'Consulta el saldo de tu tarjeta'}
                        </p>
                    </div>
                </div>
                <svg className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="mt-2 p-4 rounded-xl bg-card border border-border animate-slide-up">
                    <div className="flex gap-2 mb-3">
                        <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="Número de tarjeta"
                            value={numero}
                            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleConsultar(); }}
                            className="h-10 rounded-lg"
                        />
                        <Button
                            onClick={handleConsultar}
                            disabled={loading || numero.length < 10}
                            className="rounded-lg h-10 px-5"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : 'Consultar'}
                        </Button>
                    </div>

                    {/* Success result */}
                    {lastEntry && !error && (
                        <div className="rounded-xl overflow-hidden">
                            <div className="bg-primary p-5 text-center">
                                <p className="text-primary-foreground/70 text-[11px] font-medium uppercase tracking-wider mb-1">Saldo disponible</p>
                                <p className="text-primary-foreground text-3xl font-black tracking-tight">
                                    {formatCurrency(lastEntry.saldo_tarjeta)}
                                </p>
                            </div>

                            <div className="bg-secondary rounded-b-xl p-3.5 space-y-2.5">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-muted-foreground">Último movimiento</p>
                                        <p className="text-[12px] font-semibold text-foreground truncate">
                                            {formatDate(lastEntry.ultima_transaccion)}
                                        </p>
                                    </div>
                                </div>

                                {lastEntry.tipo && (
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] text-muted-foreground">Tipo</p>
                                            <p className="text-[12px] font-semibold text-foreground">{lastEntry.tipo}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-muted-foreground">Tarjeta</p>
                                        <p className="text-[12px] font-semibold text-foreground font-mono">
                                            •••• •••• •••• {numero.slice(-4)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error state */}
                    {error && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                            <div className="w-8 h-8 rounded-lg bg-destructive/15 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                            </div>
                            <p className="text-destructive text-sm">{error}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
