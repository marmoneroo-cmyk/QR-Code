# 🔐 רוטציית סודות Supabase שנחשפו — מדריך צעד-אחר-צעד

> **למה:** במהלך פיתוח נחשפו בצ'אט בטקסט גלוי שלושה סודות של פרויקט Supabase
> `fihaaolredpqbdrdpuca`: **סיסמת ה-DB**, מפתח **`service_role` (JWT)**, ומפתח **`sb_secret`**.
> סוד שנחשף = סוד שרוף. יש להחליף את שלושתם. עד שתסיים — מי שראה אותם יכול לקרוא/לכתוב
> את כל מסד הנתונים (service_role עוקף RLS לחלוטין).

> ⚠️ אל תדביק אף פעם סודות חזרה לצ'אט/issue/commit. הם חיים רק ב-`.env.local` (שכבר ב-gitignore)
> וב-Environment Variables של Vercel.

---

## 1. סיסמת מסד הנתונים (Database password)
1. Supabase → הפרויקט → **Settings → Database**.
2. תחת **Database password** → **Reset database password** → צור סיסמה חדשה חזקה.
3. אם יש לך `DATABASE_URL` / connection string כלשהו (psql, Prisma, scripts) — עדכן אותו עם
   הסיסמה החדשה ב-`.env.local` ובמשתני הסביבה של Vercel.
4. הערה: רוב האפליקציה משתמשת ב-anon/service keys ולא ישירות בסיסמת ה-DB; עדיין החלף אותה.

## 2. מפתח service_role (וה-anon JWT)
> שניהם חתומים על אותו **JWT secret**. החלפת ה-JWT secret מבטלת את שני הישנים בבת אחת.
1. Supabase → **Settings → API**.
2. אם הפרויקט עדיין על מפתחות JWT הישנים: **Settings → API → JWT Settings → "Generate new JWT secret"**
   (Rotate). זה מנפיק `anon` ו-`service_role` חדשים ומבטל את הישנים מיידית.
3. העתק את ה-`anon` החדש ל-`NEXT_PUBLIC_SUPABASE_ANON_KEY` ואת ה-`service_role` החדש ל-
   `SUPABASE_SERVICE_ROLE_KEY` — ב-`.env.local` וב-Vercel.
4. ⚠️ `service_role` הוא server-only. ודא שהוא **לא** מתחיל ב-`NEXT_PUBLIC_` ולא מיובא לקוד לקוח.

## 3. מפתח sb_secret (Secret API key החדש)
> Supabase עוברת ל-publishable (`sb_publishable_…`) + secret (`sb_secret_…`).
1. Supabase → **Settings → API → API Keys** (מקטע ה-Secret keys).
2. לצד מפתח ה-`sb_secret` שנחשף → **Revoke / Delete**, ואז **Create new secret key**.
3. עדכן את המשתנה שמחזיק אותו ב-`.env.local` וב-Vercel (server-only).

---

## 4. עדכון הסביבות
**מקומי:** ערוך את `.env.local` (לא מקובע ב-git) עם הערכים החדשים.

**Vercel:** Project → **Settings → Environment Variables** → עדכן כל מפתח (Production + Preview),
ואז **Redeploy** כדי שהפריסה תרים את הערכים החדשים:
```
vercel --prod --yes
```

## 5. אימות אחרי הרוטציה
- האתר עדיין נטען וה-API מחזירים 200 (התפריט מוצג, אנליטיקה עובדת).
- הוסף קוקטייל בתור אדמין עם תמונה → נשמר (כרגע ה-store הוא localStorage, אז זה לא תלוי-DB).
- (אופציונלי) אם יש לוגים/דשבורד ב-Supabase — ודא שאין שגיאות auth מהמפתחות הישנים.

## 6. צ'קליסט
- [ ] סיסמת DB הוחלפה + connection strings עודכנו
- [ ] JWT secret סובב → `anon` + `service_role` חדשים, ישנים מבוטלים
- [ ] `sb_secret` בוטל + נוצר חדש
- [ ] `.env.local` עודכן (מקומי)
- [ ] משתני סביבה ב-Vercel עודכנו (Production + Preview)
- [ ] Redeploy בוצע ואומת
- [ ] אין סודות ב-git history / בצ'אט / ב-commits

> 💡 בדיקה מהירה שאין סוד מקובע בטעות:
> ```
> git grep -nE "service_role|sb_secret|eyJ[A-Za-z0-9_-]{20,}" -- . ':!*.md'
> ```
> אמור להחזיר ריק (חוץ מקבצי דוגמה/דוקס).
