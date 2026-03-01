export default function FavoritosLoading() {
    return (
        <div className="safe-bottom animate-fade-in">
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

            <div className="px-4 pt-4 pb-2">
                <div className="skeleton w-36 h-8 rounded-lg mb-1" />
                <div className="skeleton w-24 h-4 rounded mt-1" />
            </div>

            {/* List skeleton */}
            <div className="px-4 py-4 space-y-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton w-full h-20 rounded-2xl" />
                ))}
            </div>
        </div>
    );
}
