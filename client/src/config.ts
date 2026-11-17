// back-end server url
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// public front-end url, used for invite and archive links
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
