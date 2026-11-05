// Vercel reports its deployment context independently of NODE_ENV. A stray
// NODE_ENV=development in the project settings must not disable production
// security checks (CORS, rate limiting, webhook verification).
export const isProductionRuntime = () =>
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
