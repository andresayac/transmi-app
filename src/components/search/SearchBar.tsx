'use client';

import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
    onSearch: (term: string) => void;
    loading?: boolean;
    value?: string;
    onChange?: (value: string) => void;
}

export default function SearchBar({ onSearch, loading, value, onChange }: SearchBarProps) {
    const [localValue, setLocalValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const currentValue = value ?? localValue;

    const handleChange = (v: string) => {
        if (onChange) onChange(v);
        else setLocalValue(v);
    };

    const handleSubmit = () => {
        if (currentValue.trim()) {
            onSearch(currentValue.trim());
        }
    };

    return (
        <div className="px-5 py-3">
            <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <Input
                        ref={inputRef}
                        type="text"
                        value={currentValue}
                        onChange={(e) => handleChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        placeholder="Buscar ruta, estación..."
                        className="pl-9 pr-8 h-11 rounded-xl bg-secondary border-0 text-sm"
                    />
                    {currentValue && (
                        <button
                            onClick={() => handleChange('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
                <Button
                    onClick={handleSubmit}
                    disabled={loading || !currentValue.trim()}
                    className="h-11 px-5 rounded-xl"
                >
                    {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        'Buscar'
                    )}
                </Button>
            </div>
        </div>
    );
}
