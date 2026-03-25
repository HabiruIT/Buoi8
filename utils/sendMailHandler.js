let nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  secure: false, // Use true for port 465, false for port 587
  auth: {
    user: "f8c0bef42e58a3",
    pass: "35c3442e0fd829",
  },
});
module.exports = {
  sendMail: async function (to, url) {
    await transporter.sendMail({
      from: '"admin@" <admin@nnptud.com>',
      to: to,
      subject: "mail reset passwrod",
      text: "lick vo day de doi passs", // Plain-text version of the message
      html: "lick vo <a href=" + url + ">day</a> de doi passs", // HTML version of the message
    });
  },
  sendPasswordMail: async function (to, username, password) {
    await transporter.sendMail({
      from: '"Admin NNPTUD" <admin@nnptud.com>',
      to: to,
      subject: "Tài khoản của bạn đã được tạo",
      text: `Xin chào ${username},\nTài khoản của bạn đã được tạo.\nUsername: ${username}\nPassword: ${password}\nVui lòng đổi mật khẩu sau khi đăng nhập.`,
      html: `<p>Xin chào <b>${username}</b>,</p><p>Tài khoản của bạn đã được tạo thành công.</p><ul><li><b>Username:</b> ${username}</li><li><b>Password:</b> ${password}</li></ul><p>Vui lòng đổi mật khẩu sau khi đăng nhập.</p>`,
    });
  },
};
