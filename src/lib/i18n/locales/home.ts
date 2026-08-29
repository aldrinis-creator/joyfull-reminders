import type { Namespace } from "../types";

const home: Namespace = {
  en: {
    title: "Your timeline",
    greeting: "Hello, {name}",
    subtitleOne: "1 thing coming up",
    subtitleMany: "{count} things coming up",
    subtitleEmpty: "Nothing pending — enjoy the calm",
    streak: "{count}-day on-time streak. Keep it going!",
    emptyTitle: "Nothing pending",
    emptyBody:
      "Add your first reminder — a birthday, a bill, a PUC renewal or an exam form deadline.",
    emptyCta: "Add a reminder",
    doneNext: "Done! Next one on {date}.",
    doneOnce: "Nice! Marked as done.",
    updateFailed: "Could not update that reminder.",

    // Reminder card
    forMember: "for {name}",
    markDone: "Mark done",
    sendGreeting: "Send greeting",
    addToCalendar: "Add to calendar",
    sendGift: "Send a gift",

    // Alarm overlay
    alarmAria: "Reminder due: {title}",
    alarmKicker: "{category} reminder",
    dismissDone: "Dismiss & mark done",
    orderCake: "Order cake or flowers",
    takeAction: "Take action now",
    snooze15: "15 min",
    snooze60: "1 hour",
    snoozeTomorrow: "Tomorrow",
  },
  hi: {
    title: "आपकी समय-सूची",
    greeting: "नमस्ते, {name}",
    subtitleOne: "1 काम आने वाला है",
    subtitleMany: "{count} काम आने वाले हैं",
    subtitleEmpty: "कुछ भी बाकी नहीं — निश्चिंत रहिए",
    streak: "{count} दिन से समय पर! ऐसे ही जारी रखिए।",
    emptyTitle: "कुछ भी बाकी नहीं",
    emptyBody:
      "अपना पहला रिमाइंडर जोड़िए — जन्मदिन, बिल, PUC नवीनीकरण या परीक्षा फ़ॉर्म की अंतिम तारीख़।",
    emptyCta: "रिमाइंडर जोड़ें",
    doneNext: "हो गया! अगला {date} को।",
    doneOnce: "बढ़िया! पूरा हुआ के रूप में दर्ज किया।",
    updateFailed: "यह रिमाइंडर अपडेट नहीं हो सका।",

    forMember: "{name} के लिए",
    markDone: "पूरा हुआ",
    sendGreeting: "शुभकामना भेजें",
    addToCalendar: "कैलेंडर में जोड़ें",
    sendGift: "उपहार भेजें",

    alarmAria: "रिमाइंडर का समय: {title}",
    alarmKicker: "{category} रिमाइंडर",
    dismissDone: "बंद करें और पूरा करें",
    orderCake: "केक या फूल मँगाएँ",
    takeAction: "अभी कार्रवाई करें",
    snooze15: "15 मिनट",
    snooze60: "1 घंटा",
    snoozeTomorrow: "कल",
  },
};

export default home;
