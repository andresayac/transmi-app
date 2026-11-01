export default function Loading() {
    return (
        <div className="min-h-dvh">
            <div className="h-14 flex items-center px-4">
                <div className="h-6 w-40 rounded skeleton" />
            </div>
            <div className="system-stripe h-[3px] w-full" />
            <div className="px-4 pt-4 space-y-3">
                <div className="h-28 rounded-2xl skeleton" />
                <div className="h-9 w-56 rounded-full skeleton" />
                <div className="h-36 rounded-2xl skeleton" />
                <div className="h-36 rounded-2xl skeleton" />
            </div>
        </div>
    );
}
