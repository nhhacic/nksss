import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { urlBase64ToUint8Array, PUBLIC_VAPID_KEY } from '../lib/utils';

export default function usePushNotification() {
    const { currentUser } = useAuth();
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushSupported, setPushSupported] = useState(false);

    useEffect(() => {
        const supported = 'serviceWorker' in navigator && 'PushManager' in window;
        setPushSupported(supported);
        if (supported && currentUser) {
            checkPushStatus();
        }
    }, [currentUser]);

    const checkPushStatus = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const existingSubscription = await registration.pushManager.getSubscription();
            if (existingSubscription) {
                await saveSubscriptionToDB(existingSubscription);
                setPushEnabled(true);
            } else {
                setPushEnabled(false);
            }
        } catch (error) {
            console.error("Error checking push subscription:", error);
        }
    };

    const saveSubscriptionToDB = async (subscription) => {
        if (!currentUser) return;
        try {
            await setDoc(doc(db, "subscriptions", currentUser.uid), {
                subscription: JSON.parse(JSON.stringify(subscription)),
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error saving subscription to DB:", error);
        }
    };

    const subscribe = useCallback(async () => {
        if (!currentUser || !pushSupported) return { success: false, reason: 'not_supported' };

        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
                });
                await saveSubscriptionToDB(subscription);
                setPushEnabled(true);
                return { success: true };
            } else {
                return { success: false, reason: 'denied' };
            }
        } catch (error) {
            console.error("Error subscribing to push:", error);
            return { success: false, reason: 'error', error };
        }
    }, [currentUser, pushSupported]);

    const unsubscribe = useCallback(async () => {
        if (!currentUser) return false;
        try {
            const registration = await navigator.serviceWorker.ready;
            const existingSubscription = await registration.pushManager.getSubscription();
            if (existingSubscription) {
                await existingSubscription.unsubscribe();
                await deleteDoc(doc(db, "subscriptions", currentUser.uid));
                setPushEnabled(false);
                return true;
            }
        } catch (error) {
            console.error("Error unsubscribing:", error);
        }
        return false;
    }, [currentUser]);

    const toggle = useCallback(async () => {
        if (pushEnabled) {
            return await unsubscribe();
        } else {
            return await subscribe();
        }
    }, [pushEnabled, subscribe, unsubscribe]);

    return { pushEnabled, pushSupported, subscribe, unsubscribe, toggle };
}
