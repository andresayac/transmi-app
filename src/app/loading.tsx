export default function HomeLoading() {
    return (
        <div className="animate-fade-in">
            {/* Header skeleton */}
            <div className="sticky top-0 z-40 glass">
                <div className="flex items-center justify-between max-w-lg mx-auto px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <div className="skeleton w-9 h-9 rounded-xl" />
                        <div>
                            <div className="skeleton w-20 h-4 mb-1 rounded" />
                            <div className="skeleton w-16 h-3 rounded" />
                        </div>
                    </div>
                    <div className="skeleton w-10 h-10 rounded-xl" />
                </div>
            </div>

            {/* Hero skeleton */}
            <div className="px-4 pt-5 pb-2">
                <div className="skeleton w-48 h-8 rounded-lg mb-2" />
                <div className="skeleton w-64 h-4 rounded" />
            </div>

            {/* Search bar skeleton */}
            <div className="px-4 pb-3">
                <div className="skeleton w-full h-12 rounded-2xl" />
            </div>

            {/* Saldo card skeleton */}
            <div className="px-4 pb-3">
                <div className="skeleton w-full h-16 rounded-2xl" />
            </div>

            {/* Quick chips skeleton */}
            <div className="px-4 pb-3 flex gap-2">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="skeleton w-16 h-8 rounded-xl flex-shrink-0" />
                ))}
            </div>
        </div>
    );
}
