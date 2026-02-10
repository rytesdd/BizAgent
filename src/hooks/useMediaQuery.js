import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive design
 * @param {string} query - CSS media query string (e.g., '(max-width: 768px)')
 * @returns {boolean} - True if the query matches, false otherwise
 */
export function useMediaQuery(query) {
    // Default to false to avoid hydration mismatch (if SSG/SSR were used, though this is SPA)
    // For client-only apps, we can try to set initial state based on window if available
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        // Validation for Window environment
        if (typeof window === 'undefined') return;

        const media = window.matchMedia(query);

        // precise initial value
        if (media.matches !== matches) {
            setMatches(media.matches);
        }

        const listener = () => setMatches(media.matches);

        // Modern browsers
        if (media.addEventListener) {
            media.addEventListener('change', listener);
            return () => media.removeEventListener('change', listener);
        } else {
            // Fallback for older browsers (Safari < 14)
            media.addListener(listener);
            return () => media.removeListener(listener);
        }
    }, [query]);

    return matches;
}
