/**
 * Convert a base64-encoded VAPID public key to Uint8Array
 * for the Web Push API's applicationServerKey parameter.
 */
export const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
};

/**
 * VAPID public key for Push Notifications (from env)
 */
export const PUBLIC_VAPID_KEY = import.meta.env.VITE_PUBLIC_VAPID_KEY || '';

/**
 * Confirm dialog helper (returns a Promise for async usage)
 */
export const confirmDialog = (message) => {
    return new Promise((resolve) => {
        resolve(window.confirm(message));
    });
};
