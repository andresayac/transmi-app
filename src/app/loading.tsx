import SystemStripe from '@/components/brand/SystemStripe';

export default function HomeLoading() {
    return (
        <div className="animate-fade-in" aria-busy="true" aria-label="Cargando">
            <div className="h-14" />
            <SystemStripe animated />
            <div className="px-4 pt-5 space-y-7">
                <div className="flex items-center justify-between">
                    <div className="skeleton w-28 h-4 rounded" />
                    <div className="skeleton w-36 h-8 rounded-full" />
                </div>
                <div className="skeleton w-full h-[68px] rounded-2xl" />
                <div className="flex gap-2">
                    {[1, 2, 3].map((i) => <div key={i} className="skeleton w-28 h-9 rounded-full" />)}
                </div>
                <div className="skeleton w-full h-72 rounded-2xl" />
                <div className="skeleton w-full h-40 rounded-2xl" />
            </div>
        </div>
    );
}
