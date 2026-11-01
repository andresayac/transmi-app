import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The app's type scale (text-13 = 13px, see globals.css): tell tailwind-merge these
// are font sizes, otherwise it takes them for colors and drops them next to text-foreground
const twMerge = extendTailwindMerge({
    extend: {
        theme: { text: [(value: string) => /^\d+$/.test(value)] },
    },
})

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
