/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable require-jsdoc */
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const webpush = require("web-push");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

const publicVapidKey = "BH2O-Az9MeKMLO8HFIGIM7PyBI45Wllp_TlUfnMxBHk19wU66pI7jP7ozsUFbONTVJOaMy4kh4SdZZ571r8GowQ";
const privateVapidKey = "EoZLrgQQc6EQN9Jtd5ohIFRoMntKvFmtE7GHojVjFiY";

webpush.setVapidDetails(
    "mailto:hoanghamail@gmail.com",
    publicVapidKey,
    privateVapidKey,
);

exports.subscribeToNotifications = onRequest((req, res) => {
    cors(req, res, async () => {
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

exports.checkPatientEvaluationDeadlines = onSchedule("0 * * * *", async () => {
    try {
        const now = new Date();
        const thresholdTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        const snapshot = await db.collection("patients")
            .where("evaluationResult", "==", null)
            .get();

        const notificationsToSend = [];

        snapshot.forEach((doc) => {
            const patient = doc.data();
            const createdAt = new Date(patient.createdAt);
            if (createdAt <= thresholdTime) {
                const lastNotified = patient.lastNotifiedAt ? new Date(patient.lastNotifiedAt) : null;
                const hoursSinceNotified = lastNotified ? (now.getTime() - lastNotified.getTime()) / (1000 * 60 * 60) : 999;
                if (hoursSinceNotified > 12) {
                    notificationsToSend.push({
                        patientId: doc.id,
                        doctorId: patient.doctorId,
                        patientData: patient,
                    });
                }
            }
        });

        if (notificationsToSend.length === 0) {
            console.log("No patients require notifications at this time.");
            return;
        }

        const notificationsByDoctor = notificationsToSend.reduce((acc, note) => {
            acc[note.doctorId] = acc[note.doctorId] || [];
            acc[note.doctorId].push(note.patientId);
            return acc;
        }, {});

        const promises = Object.keys(notificationsByDoctor).map(async (doctorId) => {
            const subDoc = await db.collection("subscriptions").doc(doctorId).get();
            if (!subDoc.exists) {
                return;
            }
            const subscription = subDoc.data().subscription;
            const patientListStr = notificationsByDoctor[doctorId].join(", ");
            const messageTotal = notificationsByDoctor[doctorId].length;

            let title, body, url;

            if (messageTotal === 1) {
                const singleId = notificationsByDoctor[doctorId][0];
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

            try {
                await webpush.sendNotification(subscription, payload);
                const updatePromises = notificationsByDoctor[doctorId].map((pId) => {
                    return db.collection("patients").doc(pId).update({
                        lastNotifiedAt: now.toISOString(),
                    });
                });
                await Promise.all(updatePromises);
                console.log(`Notification sent to doctor ${doctorId} for patients: ${patientListStr}`);
            } catch (err) {
                console.error(`Error sending push to doctor ${doctorId}:`, err);
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await db.collection("subscriptions").doc(doctorId).delete();
                }
            }
        });
        await Promise.all(promises);
        console.log("Cron job execution completed.");
    } catch (error) {
        console.error("Error in cron job:", error);
    }
});
