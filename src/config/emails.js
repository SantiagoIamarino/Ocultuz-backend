const EMAIL_SENDER = "soporte@ocultuz.com";

const mailjet = require("node-mailjet").connect(
  process.env.KEY_MAILJET,
  process.env.SECRET_MAILJET
);

const imageToBase64 = require("image-to-base64");

function toBase64(path) {
  return new Promise((resolve, reject) => {
    imageToBase64(path)
      .then((response) => {
        resolve(response);
      })
      .catch((error) => {
        console.log(error);
        resolve(null);
      });
  });
}

function sendEmail(data) {
  const request = mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: {
          Email: EMAIL_SENDER,
          Name: "Ocultuz",
        },
        To: [
          {
            Email: data.to,
            Name: "Usuario Ocultuz",
          },
        ],
        Subject: data.subject,
        HTMLPart: data.html,
        Attachments: data.attachments ? data.attachments : [],
      },
    ],
  });

  return request;
}

module.exports = {
  toBase64,
  sendEmail,
};
