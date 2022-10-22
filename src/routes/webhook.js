const express = require("express");
const app = express();

const Subscription = require("../models/subscription");
const Purchase = require("../models/purchase");
const User = require("../models/user");
const { timestampToISODate } = require("../config/functions");

const axios = require("axios");
const config = require("../config/vars");
const { sendEmail } = require("../config/emails");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

function getMPSubscriptionInfo(paymentId) {
  return new Promise((resolve, reject) => {
    let url = "https://api.mercadopago.com/preapproval/search";
    url += `?access_token=${config.mpAccessToken}`;
    url += `&preapproval_plan_id=${paymentId}`;

    axios
      .get(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + config.mpAccessToken,
        },
      })
      .then((response) => {
        resolve(response.data.results[0]);
      })
      .catch((error) => console.log("getSubscriptionInfo ", error));
  });
}

// Sign webhook request for more security
const signWebhookRequest = (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  const signature = req.headers["stripe-signature"];

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed.`);
    console.log(err);
    return res.status(400).json({
      ok: false,
      error: err,
    });
  }
  // Extract the object from the event.
  data = event.data;
  eventType = event.type;

  return {
    data,
    eventType,
  };
};

const addOrRemoveUserSub = async (userId, girlId, remove = false) => {
  const userDB = await User.findById(userId);

  if (userDB.subscriptions.indexOf(girlId) >= 0) {
    if (remove) {
      // If exists remove
      userDB.subscriptions.splice(userDB.subscriptions.indexOf(girlId), 1);
    } else {
      return Promise.resolve();
    }
  }

  if (!remove) {
    // If not exists and remove is false add
    userDB.subscriptions.push(girlId);
  }

  delete userDB._id;
  return userDB.update(userDB);
};

const createSubscription = async (data) => {
  const purchase = new Purchase({
    userId: data.metadata.userId,
    girlId: data.metadata.girlId,
    paymentId: data.id,
    type: "subscription",
    pending: false,
    amount: data.amount_total,
  });

  const purchaseDB = await purchase.save();

  const subscription = new Subscription({
    userId: data.metadata.userId,
    girlId: data.metadata.girlId,
    subscribedSince: timestampToISODate(data.created),
    subscriptionEnds: timestampToISODate(data.expires_at),
    nextPaymentDueDate: timestampToISODate(data.next_payment_attempt),
    paymentId: data.subscription,
    purchaseId: purchaseDB._id,
    active: true,
    status: "completed",
    paymentData: data,
  });

  const subscriptionDB = await subscription.save();

  const userUpdated = await addOrRemoveUserSub(
    data.metadata.userId,
    data.metadata.girlId
  );

  return {
    userUpdated,
    subscriptionDB,
  };
};

const updateSubscription = async (data) => {
  const subscriptionDB = await Subscription.findOne({
    paymentId: data.subscription,
  });

  if (!subscriptionDB) {
    console.log("Subscription not found");
    return;
  }

  subscriptionDB.active = true;
  subscriptionDB.status = "completed";
  subscriptionDB.subscriptionEnds = timestampToISODate(data.expires_at);
  subscriptionDB.nextPaymentDueDate = timestampToISODate(
    data.next_payment_attempt
  );
  subscriptionDB.paymentData = data;
  delete subscriptionDB._id;

  const subscriptionUpdated = await subscriptionDB.update(subscriptionDB);

  await addOrRemoveUserSub(subscriptionDB.userId, subscriptionDB.girlId);

  return subscriptionUpdated;
};

const cancelSubscription = async (data) => {
  const subscriptionDB = await Subscription.findOne({
    paymentId: data.subscription,
  });

  if (!subscriptionDB) {
    console.log("Subscription not found");
    return;
  }

  subscriptionDB.active = false;
  subscriptionDB.status = "canceled";
  delete subscriptionDB._id;

  const subscriptionUpdated = await subscriptionDB.update(subscriptionDB);

  await addOrRemoveUserSub(subscriptionDB.userId, subscriptionDB.girlId, true);

  return subscriptionUpdated;
};

const sendPaymentFailedEmail = async (data) => {
  const userDB = await User.findById(data.metadata.userId);

  if (!userDB) {
    console.log("User not found");
    return;
  }

  const returnUrl = `${process.env.FRONTEND_URL}/#/mis-subscripciones`;

  var portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  const url = portalSession.url;

  let attachments = [];
  let html = `<!DOCTYPE html><html><head> <meta charset="utf-8"> <meta http-equiv="x-ua-compatible" content="ie=edge"> <title>Pago de subscripción fallido</title> <meta name="viewport" content="width=device-width, initial-scale=1"> <style type="text/css"> /** * Google webfonts. Recommended to include the .woff version for cross-client compatibility. */ @media screen { @font-face { font-family: 'Source Sans Pro'; font-style: normal; font-weight: 400; src: local('Source Sans Pro Regular'), local('SourceSansPro-Regular'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/ODelI1aHBYDBqgeIAH2zlBM0YzuT7MdOe03otPbuUS0.woff) format('woff'); } @font-face { font-family: 'Source Sans Pro'; font-style: normal; font-weight: 700; src: local('Source Sans Pro Bold'), local('SourceSansPro-Bold'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/toadOcfmlt9b38dHJxOBGFkQc6VGVFSmCnC_l7QZG60.woff) format('woff'); } } /** * Avoid browser level font resizing. * 1. Windows Mobile * 2. iOS / OSX */ body, table, td, a { -ms-text-size-adjust: 100%; /* 1 */ -webkit-text-size-adjust: 100%; /* 2 */ } /** * Remove extra space added to tables and cells in Outlook. */ table, td { mso-table-rspace: 0pt; mso-table-lspace: 0pt; } /** * Better fluid images in Internet Explorer. */ img { -ms-interpolation-mode: bicubic; } .showy{height:100% !important;  width: 300px !important;} .no-showy{display: none} /** * Remove blue links for iOS devices. */ a[x-apple-data-detectors] { font-family: inherit !important; font-size: inherit !important; font-weight: inherit !important; line-height: inherit !important; color: inherit !important; text-decoration: none !important; } /** * Fix centering issues in Android 4.4. */ div[style*="margin: 16px 0;"] { margin: 0 !important; } body { width: 100% !important; height: 100% !important; padding: 0 !important; margin: 0 !important; } /** * Collapse table borders to avoid space between cells. */ table { border-collapse: collapse !important; } a { color: #1a82e2; } img { height: auto; max-height: 80px; line-height: 100%; text-decoration: none; border: 0; outline: none; } </style></head><body style="background-color: #e9ecef;"> <!-- start preheader --> <div class="preheader" style="display: none; max-width: 0; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;"> A preheader is the short summary text that follows the subject line when an email is viewed in the inbox. </div> <!-- end preheader --> <!-- start body --> <table border="0" cellpadding="0" cellspacing="0" width="100%"> <!-- start logo --> <tr> <td align="center" bgcolor="#e9ecef"> <!--[if (gte mso 9)|(IE)]> <table align="center" border="0" cellpadding="0" cellspacing="0" width="600"> <tr> <td align="center" valign="top" width="600"> <![endif]--> <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;"> <tr> <td align="center" valign="top" style="padding: 36px 24px;"> <a href="${url}" target="_blank" style="display: inline-block;"> `;

  if (email.indexOf("@gmail.") > 0) {
    html += `<img class="main-img" src="cid:id1">`;
  } else {
    html += `<img class="showy" width="0" height="0" src="https://ocultuz.com/assets/graphics/Logo.svg"><img class="no-showy" src="https://ocultuz.com/assets/graphics/Logo.jpg">`;
  }

  html += ` </a> </td> </tr> </table> <!--[if (gte mso 9)|(IE)]> </td> </tr> </table> <![endif]--> </td> </tr> <!-- end logo --> <!-- start hero --> <tr> <td align="center" bgcolor="#e9ecef"> <!--[if (gte mso 9)|(IE)]> <table align="center" border="0" cellpadding="0" cellspacing="0" width="600"> <tr> <td align="center" valign="top" width="600"> <![endif]--> <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;"> <tr> <td align="left" bgcolor="#ffffff" style="padding: 36px 24px 0; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; border-top: 3px solid #d4dadf;"> <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 48px;">Pago de subscripción fallido</h1> </td> </tr> </table> <!--[if (gte mso 9)|(IE)]> </td> </tr> </table> <![endif]--> </td> </tr> <!-- end hero --> <!-- start copy block --> <tr> <td align="center" bgcolor="#e9ecef"> <!--[if (gte mso 9)|(IE)]> <table align="center" border="0" cellpadding="0" cellspacing="0" width="600"> <tr> <td align="center" valign="top" width="600"> <![endif]--> <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;"> <!-- start copy --> <tr> <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;"> <p style="margin: 0;">Podrás ingresar a la sección de subscripciones y dentro de la opción "Facturación" cambiar tu método de pago, o haz clic en el botón a continuación para ser enviado al administrador de facturación de Stripe.</p> </td> </tr> <!-- end copy --> <!-- start button --> <tr> <td align="left" bgcolor="#ffffff"> <table border="0" cellpadding="0" cellspacing="0" width="100%"> <tr> <td align="center" bgcolor="#ffffff" style="padding: 12px;"> <table border="0" cellpadding="0" cellspacing="0"> <tr> <td align="center" bgcolor="#1a82e2" style="border-radius: 6px;"> <a href="${url}" target="_blank" style="display: inline-block; padding: 16px 36px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; color: #ffffff; text-decoration: none; border-radius: 6px;">Administrar facturación</a> </td> </tr> </table> </td> </tr> </table> </td> </tr> <!-- end button --> <!-- start copy --> <tr> <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;"> <p style="margin: 0;">Si el botón anterior no llegara a funcionar simplemente copia y pega el siguiente link en tu navegador</p> <p style="margin: 0;"><a href="${url}" target="_blank">${url}</a></p> </td> </tr> <!-- end copy --> <!-- start copy --> <tr> <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px; border-bottom: 3px solid #d4dadf"> <p style="margin: 0;">Un saludo,<br> Equipo de Ocultuz</p> </td> </tr> <!-- end copy --> </table> <!--[if (gte mso 9)|(IE)]> </td> </tr> </table> <![endif]--> </td> </tr> <!-- end copy block --> <!-- start footer --> <tr> <td align="center" bgcolor="#e9ecef" style="padding: 24px;"> <!--[if (gte mso 9)|(IE)]> <table align="center" border="0" cellpadding="0" cellspacing="0" width="600"> <tr> <td align="center" valign="top" width="600"> <![endif]--> <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;"> <!-- start permission --> <tr> <td align="center" bgcolor="#e9ecef" style="padding: 12px 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #666;"> <p style="margin: 0;">Haz recibido este correo ya que se ha realizado una subscripción en Ocultuz.com con este correo</p> </td> </tr> <!-- end permission --> <!-- start unsubscribe --> <tr> <td align="center" bgcolor="#e9ecef" style="padding: 12px 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #666;"> <p style="margin: 0;">Si no fuiste tú quien realizo dicha petición simplemente ignora este mensaje.</p> <p style="margin: 0;">&copy; Ocultuz 2022</p> </td> </tr> <!-- end unsubscribe --> </table> <!--[if (gte mso 9)|(IE)]> </td> </tr> </table> <![endif]--> </td> </tr> <!-- end footer --> </table> <!-- end body --></body></html>`;

  const emailData = {
    to: email,
    subject: "Pago de subscripción fallido | Ocultuz",
    html,
    attachments,
  };

  return sendEmail(emailData);
};

app.post("/card-payments", async (req, res) => {
  let { data, eventType } = signWebhookRequest(req, res);

  try {
    switch (eventType) {
      case "checkout.session.completed":
        console.log(eventType);
        await createSubscription(data.object);
        break;

      case "invoice.paid":
        console.log(eventType);
        await updateSubscription(data.object);
        break;

      case "invoice.payment_failed":
        await sendPaymentFailedEmail(data.object);
        await cancelSubscription(data.object);
        break;

      default:
      // Unhandled event type
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      ok: false,
      error,
    });
  }

  res.status(200).json({
    ok: true,
  });
});

module.exports = app;
