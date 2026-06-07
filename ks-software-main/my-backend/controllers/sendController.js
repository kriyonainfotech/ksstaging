const User = require("../model/user");
const axios = require("axios");


const ONE_SIGNAL_APP_ID = "2ba745e0-3711-4f3e-9960-2430b957b012";
const ONE_SIGNAL_API_KEY = "os_v2_app_fotulybxcfht5glaeqylsv5qci5odxx3kdierhnn62ubshei752os3vmg3dx6mzdgzhfybyl5f4oqk276p6ymsybo2mqshn6g7phzvq";

const sendNotification = async ({
  senderName,
  fcmToken, // OneSignal Player ID
  title,
  message,
  receiverId,
  type,
}) => {
  if (!fcmToken || !title || !message || !senderName || !receiverId) {
    console.log(fcmToken, title, message, senderName, receiverId, "❌ Error: Missing required parameters");
    return { success: false, error: "Missing required fields." };
  }

  try {
    // Store notification in the database (MongoDB)
    await User.updateOne(
      { _id: receiverId },
      {
        $push: {
          notifications: {
            type,
            senderName,
            title,
            message,
            timestamp: new Date(),
          },
        },
      }
    );

    console.log(`✅ Notification saved successfully for receiver: ${receiverId}`);

    // Send notification using OneSignal API
    const notificationPayload = {
      app_id: ONE_SIGNAL_APP_ID,
      include_player_ids: [fcmToken], // OneSignal Player ID
      headings: { en: `${title}` },
      contents: { en: message },
      data: { type, senderName, receiverId },
    //   chrome_web_icon: "https://res.cloudinary.com/dcfm0aowt/image/upload/v1740812199/2000X2000_WITHOUT_EES_lexnov.png", // Web notification icon
      ios_attachments: { "id": "https://res.cloudinary.com/dcfm0aowt/image/upload/v1740812199/2000X2000_WITHOUT_EES_lexnov.png" }, // iOS notification icon

      // large_icon: "https://res.cloudinary.com/dcfm0aowt/image/upload/v1740812199/2000X2000_WITHOUT_EES_lexnov.png", // Android notification icon
    };

    const response = await axios.post(
      "https://onesignal.com/api/v1/notifications",
      notificationPayload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${ONE_SIGNAL_API_KEY}`,
        },
      }
    );

    console.log("📩 OneSignal notification sent:", response.data);
    return { success: true, response: response.data };
  } catch (error) {
    console.error("❌ Error sending OneSignal notification:", error.response?.data || error.message);
    return { success: false, error: "Failed to send notification." };
  }
}; 

module.exports = {
  sendNotification, 
};
