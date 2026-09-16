import type { Namespace } from "../types";

const scan: Namespace = {
  en: {
    captureTitle: "Scan a document",
    close: "Close the scanner",
    captureHint:
      "Hold the whole page in frame. PUC, insurance, passport, FD receipt — anything with a date.",
    shutter: "Take the photo",
    shutterHint: "Up to {max} pages or sides of the same paper.",
    confirmKicker: "Read in 2 seconds",
    confirmBody: "Check these, then I'll file it.",
    "field.title": "Document",
    "field.date": "Due or expiry date",
    "field.time": "Time",
    "field.upiPayeeName": "Issued by",
    "field.paymentAmount": "Amount (₹)",
    "field.vehicleNumber": "Vehicle",
    "field.institution": "Institution",
    today: "today",
    inDays: "in {count} days",
    daysAgo: "{count} days ago",
    theDueDate: "the due date",
    nextSteps:
      "Filed under {category}. I'll nudge you 1 day before and ring on {date}. You can change any of this before saving.",
    retake: "Retake",
    save: "Looks right — save it",
    savedTitle: "On the shelf.",
    savedBody: "{title} set to ring on {date}. You have {count} documents on your shelf.",
    scanAnother: "Scan another",
    done: "Done",
  },
  hi: {
    captureTitle: "दस्तावेज़ स्कैन करें",
    close: "स्कैनर बंद करें",
    captureHint:
      "पूरा पन्ना फ़्रेम में रखें। PUC, बीमा, पासपोर्ट, FD रसीद — तारीख वाला कोई भी कागज़।",
    shutter: "फ़ोटो लें",
    shutterHint: "एक ही कागज़ के {max} पन्ने या दोनों तरफ़ तक।",
    confirmKicker: "2 सेकंड में पढ़ लिया",
    confirmBody: "इन्हें जाँच लीजिए, फिर मैं इसे लगा दूँगा।",
    "field.title": "दस्तावेज़",
    "field.date": "आख़िरी या समाप्ति तारीख",
    "field.time": "समय",
    "field.upiPayeeName": "जारीकर्ता",
    "field.paymentAmount": "रकम (₹)",
    "field.vehicleNumber": "गाड़ी",
    "field.institution": "संस्था",
    today: "आज",
    inDays: "{count} दिन में",
    daysAgo: "{count} दिन पहले",
    theDueDate: "नियत तारीख",
    nextSteps:
      "{category} में रखा गया। एक दिन पहले याद दिलाऊँगा और {date} को अलार्म बजेगा। सहेजने से पहले सब कुछ बदला जा सकता है।",
    retake: "फिर से फ़ोटो लें",
    save: "सही है — सहेज दीजिए",
    savedTitle: "शेल्फ़ पर लग गया।",
    savedBody: "{title} के लिए {date} को अलार्म सेट है। आपकी शेल्फ़ पर {count} दस्तावेज़ हैं।",
    scanAnother: "दूसरा स्कैन करें",
    done: "हो गया",
  },
};

export default scan;
