import transporter from "./emailService.js";

const sendOtpEmail = async (email, otp) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,

    to: email,

    subject: "Email Verification OTP",

    html: `
      <h2>VELOSHOP OTP</h2>

      <p>Your OTP is:</p>

      <h1>${otp}</h1>

      <p>
      Valid for 1 minute
      </p>
    `,
  });
};

export default sendOtpEmail;
