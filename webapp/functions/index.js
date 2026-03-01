/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable require-jsdoc */
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const webpush = require("web-push");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// Public key is safe to commit — it's shared with the browser
const publicVapidKey = "BH2O-Az9MeKMLO8HFIGIM7PyBI45Wllp_TlUfnMxBHk19wU66pI7jP7ozsUFbONTVJOaMy4kh4SdZZ571r8GowQ";

// Private key is loaded from Firebase Secret Manager at runtime
// Set it once via: firebase functions:secrets:set VAPID_PRIVATE_KEY
const vapidPrivateKey = defineSecret("VAPID_PRIVATE_KEY");

exports.subscribeToNotifications = onRequest({ secrets: [vapidPrivateKey] }, (req, res) => {
    cors(req, res, async () => {
        webpush.setVapidDetails("mailto:hoanghamail@gmail.com", publicVapidKey, vapidPrivateKey.value());
        if (req.method !== "POST") {
            return res.status(405).send("Method not allowed");
        }
        try {
            const { subscription, uid } = req.body;
            if (!subscription || !uid) {
                return res.status(400).send("Missing subscription or uid");
            }
            await db.collection("subscriptions").doc(uid).set({
                subscription: subscription,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            res.status(200).send("Subscription saved successfully.");
        } catch (error) {
            console.error("Error saving subscription:", error);
            res.status(500).send("Server Error");
        }
    });
});

exports.checkPatientEvaluationDeadlines = onSchedule({ schedule: "0 * * * *", secrets: [vapidPrivateKey] }, async () => {
    webpush.setVapidDetails("mailto:hoanghamail@gmail.com", publicVapidKey, vapidPrivateKey.value());
    try {
        const now = new Date();
        const thresholdTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        // Fetch ALL patients — Firestore where('field', '==', null) does NOT match
        // documents where the field is missing, so we must filter in code
        const snapshot = await db.collection("patients").get();

        const notificationsToSend = [];

        snapshot.forEach((doc) => {
            const patient = doc.data();
            // Skip patients that already have an evaluation result
            if (patient.evaluationResult) return;

            const createdAt = new Date(patient.admissionTime || patient.createdAt);
            if (createdAt <= thresholdTime) {
                notificationsToSend.push({
                    patientId: doc.id,
                    doctorId: patient.doctorId,
                    patientData: patient,
                });
            }
        });

        console.log(`Found ${notificationsToSend.length} overdue patients out of ${snapshot.size} total.`);

        if (notificationsToSend.length === 0) {
            console.log("No patients require notifications at this time.");
            return;
        }

        const notificationsByDoctor = notificationsToSend.reduce((acc, note) => {
            acc[note.doctorId] = acc[note.doctorId] || [];
            acc[note.doctorId].push(note);
            return acc;
        }, {});

        const promises = Object.keys(notificationsByDoctor).map(async (doctorId) => {
            // Read doctor's preferred alert frequency (default: 12h)
            let alertFrequency = 12;
            try {
                const userDoc = await db.collection("users").doc(doctorId).get();
                if (userDoc.exists && userDoc.data().alertFrequency) {
                    alertFrequency = userDoc.data().alertFrequency;
                }
            } catch (e) {
                console.warn(`Could not read alertFrequency for ${doctorId}, using default`);
            }

            // Filter patients that need notification based on this doctor's frequency
            const eligiblePatients = notificationsByDoctor[doctorId].filter((note) => {
                const lastNotified = note.patientData.lastNotifiedAt ? new Date(note.patientData.lastNotifiedAt) : null;
                const hoursSinceNotified = lastNotified ? (now.getTime() - lastNotified.getTime()) / (1000 * 60 * 60) : 999;
                return hoursSinceNotified > alertFrequency;
            });

            if (eligiblePatients.length === 0) return;

            const patientIds = eligiblePatients.map((n) => n.patientId);
            const patientListStr = patientIds.join(", ");
            const messageTotal = patientIds.length;

            // Check if push subscription exists (optional — in-app notification always created)
            const subDoc = await db.collection("subscriptions").doc(doctorId).get();
            const subscription = subDoc.exists ? subDoc.data().subscription : null;

            let title, body, url;

            if (messageTotal === 1) {
                const singleId = patientIds[0];
                title = "Đến hạn đánh giá lâm sàng 🚨";
                body = `Đã qua 24h chờ đối với ca bệnh ${singleId}. Nhấn vào đây để thực hiện Đánh giá Lâm sàng ngay.`;
                url = `/reevaluation/${singleId}`;
            } else {
                title = "Có nhiều ca bệnh cần đánh giá 🚨";
                body = `Bác sĩ có ${messageTotal} bệnh nhân (${patientListStr}) đã quá 24h chờ Đánh giá. Ấn để xem danh sách.`;
                url = "/";
            }

            const payload = JSON.stringify({
                title: title,
                body: body,
                url: url,
            });

            // Always create in-app notification in Firestore
            await db.collection("notifications").add({
                userId: doctorId,
                type: "overdue_reminder",
                title: title,
                message: body,
                patientId: messageTotal === 1 ? patientIds[0] : null,
                isRead: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Send push notification if subscription exists
            if (subscription) {
                try {
                    await webpush.sendNotification(subscription, payload);
                    console.log(`Push sent to doctor ${doctorId} for patients: ${patientListStr}`);
                } catch (err) {
                    console.error(`Error sending push to doctor ${doctorId}:`, err);
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await db.collection("subscriptions").doc(doctorId).delete();
                    }
                }
            }

            // Update lastNotifiedAt on patients
            const updatePromises = patientIds.map((pId) => {
                return db.collection("patients").doc(pId).update({
                    lastNotifiedAt: now.toISOString(),
                });
            });
            await Promise.all(updatePromises);
        });
        await Promise.all(promises);
        console.log("Cron job execution completed.");
    } catch (error) {
        console.error("Error in cron job:", error);
    }
});
