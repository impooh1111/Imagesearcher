const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();

const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'planbmedia.co.th';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails && profile.emails[0] && profile.emails[0].value;

      if (!email) {
        return done(null, false, { message: 'ไม่พบอีเมลจากบัญชี Google' });
      }

      // *** จุดสำคัญข้อ 7: จำกัด login เฉพาะอีเมล @planbmedia.co.th เท่านั้น ***
      // ตรวจสอบฝั่ง server เสมอ ห้ามเชื่อแค่ parameter "hd" ตอนเรียก Google เพียงอย่างเดียว
      // เพราะ hd เป็นแค่ตัวช่วยกรองหน้าเลือกบัญชีของ Google ไม่ใช่การยืนยันความปลอดภัย
      const emailDomain = email.split('@')[1];
      if (emailDomain !== ALLOWED_DOMAIN) {
        return done(null, false, {
          message: `อนุญาตเฉพาะอีเมลโดเมน @${ALLOWED_DOMAIN} เท่านั้น`,
        });
      }

      const user = {
        id: profile.id,
        email,
        name: profile.displayName,
        avatar: profile.photos && profile.photos[0] && profile.photos[0].value,
      };

      return done(null, user);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;
