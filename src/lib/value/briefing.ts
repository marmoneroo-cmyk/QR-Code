import type { Bilingual, OpportunityType } from '../opportunities/types';

/**
 * Turns a recommendation into a CONSULTANT'S BRIEFING — a short story about what is
 * happening in the restaurant, not a metric dump. Answers "what's going on in my
 * room?" rather than "what number changed?". Honest: it narrates the real signal
 * behind each opportunity type; it never invents figures.
 *
 * Voice: a seasoned bar manager briefing the owner before service — calm, certain,
 * human. The drink's name is woven in so it reads like a person talking about a drink.
 */
export function buildBriefing(type: OpportunityType, drink: Bilingual): Bilingual {
  const en = drink.en;
  const he = drink.he;
  switch (type) {
    case 'promote_position':
      return {
        en: `Guests keep finding ${en} — but it sits low on the menu, where few of them ever reach. The interest is real; the visibility isn't. Move it up to the top section and that attention should start turning into orders.`,
        he: `אורחים שוב ושוב מגלים את ${he} — אבל הוא יושב נמוך בתפריט, במקום שמעטים מגיעים אליו. העניין אמיתי; החשיפה לא. העלו אותו לראש התפריט, והקשב הזה אמור להתחיל להפוך להזמנות.`,
      };
    case 'fix_offer':
      return {
        en: `${en} is catching eyes but not orders. Guests look, linger, and then hesitate — usually it's the photo, the description, or the price holding them back. Tighten the offer and that interest can finally convert.`,
        he: `${he} מושך עיניים אבל לא הזמנות. אורחים מסתכלים, מתעכבים, ואז מהססים — בדרך כלל זו התמונה, התיאור או המחיר שעוצרים אותם. חדדו את ההצעה, והעניין הזה סוף סוף יכול להפוך להזמנה.`,
      };
    case 'promote_marketing':
      return {
        en: `Guests are sharing ${en} with their friends, yet it hasn't turned into sales. The buzz is already there — a little push behind it can convert that word-of-mouth into orders on the floor.`,
        he: `אורחים משתפים את ${he} עם החברים שלהם, אבל זה עוד לא הפך למכירות. הבאזז כבר קיים — דחיפה קטנה מאחוריו יכולה להפוך את הפֶּה-לאוזן להזמנות באולם.`,
      };
    case 'promotion_candidate':
      return {
        en: `Your regulars keep coming back to ${en}. That kind of loyalty is rare — reward it with a timed offer and you'll likely lift repeat orders from the guests who already love it.`,
        he: `הקבועים שלכם חוזרים שוב ושוב אל ${he}. נאמנות כזו היא נדירה — תגמלו אותה במבצע מתוזמן, וסביר שתעלו את ההזמנות החוזרות מהאורחים שכבר אוהבים אותו.`,
      };
    case 'reengage_returning':
      return {
        en: `Some guests view ${en} again and again but never order it. They're interested — they're just waiting for a reason. A small nudge could be all it takes to close it.`,
        he: `יש אורחים שצופים ב${he} שוב ושוב אבל אף פעם לא מזמינים. הם מעוניינים — הם פשוט מחכים לסיבה. נדנוד קטן יכול להיות כל מה שצריך כדי לסגור את זה.`,
      };
  }
}
