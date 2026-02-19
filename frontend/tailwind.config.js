/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                maroon: {
                    DEFAULT: '#800000',
                    dark: '#600000',
                    900: '#800000',
                },
                gold: {
                    DEFAULT: '#FFD700',
                    dark: '#E6C200',
                    500: '#FFD700',
                },
                primary: 'var(--primary)',
                secondary: 'var(--accent)',
                parchment: 'var(--bg-parchment)',
                main: 'var(--text-main)',
                card: 'var(--card-bg)',
                ivory: '#FAF9F6',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))',
                'maroon-gold': 'linear-gradient(135deg, #800000 0%, #FFD700 100%)',
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
}
