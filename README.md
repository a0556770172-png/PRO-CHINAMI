# ⚔ חוד החנית — מדריך התקנה מלא

## שלב 1: הרצת SQL בסופאבייס

1. היכנס לאתר https://supabase.com
2. לחץ על הפרויקט שלך
3. בתפריט הצדדי בחר **SQL Editor**
4. לחץ **New Query**
5. העתק את כל התוכן מהקובץ `SUPABASE_SQL.sql`
6. לחץ **Run** (▶)
7. וודא שרואים הודעת הצלחה

---

## שלב 2: הגדרת Authentication בסופאבייס

1. בתפריט הצדדי לחץ **Authentication** → **Providers**
2. וודא ש-**Email** מופעל
3. תחת **Settings** → **Email Auth**:
   - כבה "Confirm email" אם רוצה רישום מיידי (מומלץ לפיתוח)
   - או השאר מופעל לאימות מייל

---

## שלב 3: התקנה והרצה מקומית

```bash
# שכפל את הפרויקט
cd khod-hachanit

# התקן תלויות
npm install

# הרץ בסביבת פיתוח
npm start
```

האתר יפתח ב: http://localhost:3000

---

## שלב 4: כניסה ראשונה כמנהל

1. לך לאתר → **כניסה / הרשמה**
2. הירשם עם המייל: `E0556770172@gmail.com`
3. לאחר ההרשמה תהיה אוטומטית מנהל
4. לחץ **⚙️ ניהול**
5. הזן קוד אבטחה: **26416**

---

## שלב 5: העלאה לאינטרנט (Vercel)

```bash
# התקן Vercel CLI
npm i -g vercel

# בנה את האתר
npm run build

# העלה
vercel --prod
```

או השתמש ב-**Netlify**:
1. בנה: `npm run build`
2. גרור את תיקיית `build/` לאתר Netlify

---

## מבנה המסמכים

```
khod-hachanit/
├── SUPABASE_SQL.sql        ← הרץ ראשון בסופאבייס
├── public/
│   └── index.html
└── src/
    ├── App.js              ← ניתוב ראשי
    ├── App.css             ← עיצוב מלא
    ├── index.js
    ├── contexts/
    │   └── AuthContext.js  ← ניהול משתמשים
    ├── lib/
    │   ├── supabase.js     ← חיבור DB
    │   └── utils.js        ← פונקציות עזר
    ├── components/
    │   └── Layout.js       ← Header + Footer
    └── pages/
        ├── HomePage.js     ← עמוד ראשי
        ├── PostPage.js     ← קריאת פוסט + תגובות
        ├── CategoryPage.js ← רשימת פוסטים לפי קטגוריה
        ├── AuthPage.js     ← כניסה/הרשמה
        ├── ProfilePage.js  ← פרופיל משתמש
        ├── WriterPage.js   ← עורך פוסטים לכתבים
        └── AdminPage.js    ← פאנל ניהול מלא
```

---

## פרטי חיבור סופאבייס

- **Project URL:** https://nepdwxbtaxtocafnpqli.supabase.co
- **Anon Key:** sb_publishable_kfLbUjPgcRXGnscbUenmGg_474wlIIw

---

## מערכת הדרגות

| דרגה | תנאי שדרוג | הרשאות |
|------|-----------|--------|
| 🌱 משתמש חדש | הרשמה | קריאה + לייקים |
| 💬 מגיב מורשה | 5 ימי כניסה + שעה גלישה | + כתיבת תגובות |
| ⭐ נאמן האתר | 20 ימי כניסה + 5 שעות + 10 לייקים | + הצעת פוסטים |
| ✍️ כתב | על ידי מנהל | + פרסום פוסטים |
| 👑 מנהל | אימייל ייעודי + קוד | שליטה מלאה |
