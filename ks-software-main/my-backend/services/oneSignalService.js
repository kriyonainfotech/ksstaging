const axios = require('axios');

const sendNotification = async (userIds, heading, content, data = {}) => {
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        console.warn("[OneSignal] Missing App ID or REST API Key. Notification skipped.");
        return;
    }

    if (!userIds || userIds.length === 0) {
        return;
    }

    try {
        const payload = {
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: userIds, // We assume external_id is set to user._id on frontend
            headings: { en: heading },
            contents: { en: content },
            data: data,
            // Optional: channel_for_external_user_ids: "push"
        };

        const response = await axios.post(
            'https://onesignal.com/api/v1/notifications',
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
                }
            }
        );

        console.log(`[OneSignal] Notification sent to ${userIds.length} users. ID: ${response.data.id}`);
        return response.data;
    } catch (error) {
        console.error("[OneSignal] Error sending notification:", error.response?.data || error.message);
    }
};

module.exports = {
    sendNotification
};
