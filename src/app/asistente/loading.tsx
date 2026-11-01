import AssistantOrb from '@/components/brand/AssistantOrb';

export default function Loading() {
    return (
        <div className="flex h-dvh items-center justify-center bg-background">
            <AssistantOrb size={64} active />
        </div>
    );
}
