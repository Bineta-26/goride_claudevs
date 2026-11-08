import { createContext, useContext } from "react";
import type { Lang } from "./riderData";

// Arabic for the menus, page titles and main buttons. Anything not listed stays in English.
const ar: Record<string, string> = {
  "MENU": "القائمة", "MORE": "المزيد", "Overview": "الرئيسية", "Book a ride": "احجز رحلة", "Your trips": "رحلاتك", "Scheduled": "المجدولة", "Payments": "المدفوعات",
  "Driver mode": "وضع السائق", "Safety & support": "الأمان والدعم", "More": "المزيد", "Profile & settings": "الملف الشخصي والإعدادات", "Support": "الدعم",
  "Transactions": "المعاملات", "Confirm your ride": "تأكيد رحلتك", "On your way": "في الطريق", "Home": "الرئيسية", "Book": "احجز", "Trips": "الرحلات",
  "Let's get you there.": "لنوصلك إلى وجهتك.", "One last look.": "نظرة أخيرة.", "Your ride is in motion.": "رحلتك في الطريق.",
  "Every ride tells a story.": "لكل رحلة قصة.", "The early bird gets the ride.": "خطط لرحلتك مسبقاً.", "Your money, your way.": "أموالك، بطريقتك.",
  "The details that make it yours.": "التفاصيل التي تجعلها لك.", "You ride. We've got your back.": "أنت تركب، ونحن معك.", "Every dirham, accounted for.": "كل درهم في مكانه.",
  "How can we help?": "كيف يمكننا مساعدتك؟", "Your road, your rules.": "طريقك، قواعدك.",
  "Find a ride": "ابحث عن رحلة", "Review your ride": "راجع رحلتك", "Recent destinations": "الوجهات الأخيرة", "See all": "عرض الكل",
  "Payment methods": "طرق الدفع", "Recent transactions": "المعاملات الأخيرة", "Your favourite places": "أماكنك المفضلة", "Preferences": "التفضيلات",
  "Upcoming reservations": "الحجوزات القادمة", "Notifications": "الإشعارات", "Log out": "تسجيل الخروج", "Log in": "تسجيل الدخول", "Change route": "تغيير المسار",
  "Good morning": "صباح الخير", "Good afternoon": "مساء الخير", "Good evening": "مساء الخير", "Where will the day take you?": "إلى أين سيأخذك يومك؟",
};

export const LangContext = createContext<Lang>("en");
export const tr = (lang: Lang, text: string) => (lang === "ar" ? ar[text] ?? text : text);
export function useT() {
  const lang = useContext(LangContext);
  return (text: string) => tr(lang, text);
}
