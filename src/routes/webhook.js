const express = require("express");
const app = express();

const Subscription = require("../models/subscription");
const Purchase = require("../models/purchase");

const axios = require("axios");
const mpAccessToken = process.env.MP_ACCESS_TOKEN;

const { addOrRemoveUserSub } = require("../config/functions");

const {
  signWebhookRequest,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  sendPaymentFailedEmail,
  contentBought,
} = require("../methods/webhook-methods");

app.post("/store-payment", async (req, res) => {
  const body = req.body;
  console.log(req.body);

  if (body.type !== "payment") {
    console.log("Not a payment ", body.type);
    return res.status(200).json({
      ok: true,
    });
  }
  const paymentId = body.data.id;
  const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;

  try {
    let paymentData = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + mpAccessToken,
      },
    });

    console.log(`PaymentDataStatus ${paymentId}: `, paymentData.data.status);
    paymentData = paymentData.data;

    if (paymentData.status === "pending") {
      return res.status(200).json({
        ok: true,
      });
    }

    console.log("PaymentData: ", paymentData);

    const purchaseDB = await Purchase.findOne({ paymentId: paymentId });
    if (!purchaseDB) {
      return res.status(200).json({
        ok: true,
      });
    }

    if (purchaseDB.type === "product") {
      if (paymentData.status === "approved") {
        purchaseDB.pending = false;
      }

      await purchaseDB.update(purchaseDB);
      return res.status(200).json({
        ok: true,
      });
    }

    // Is a subscription
    const subscriptionDB = await Subscription.findOne({ paymentId: paymentId });
    if (!subscriptionDB) {
      return res.status(200).json({
        ok: true,
      });
    }

    if (paymentData.status === "approved") {
      subscriptionDB.active = true;
      subscriptionDB.status = "completed";

      await subscriptionDB.update(subscriptionDB);

      await addOrRemoveUserSub(subscriptionDB.userId, subscriptionDB.girlId);
    }

    return res.status(200).json({
      ok: true,
    });
  } catch (error) {
    console.log("Error on store webhooks", error);
    return res.status(200).json({
      ok: true,
    });
  }
});

app.post("/card-payments", async (req, res) => {
  let { data, eventType } = signWebhookRequest(req, res);

  try {
    switch (eventType) {
      case "checkout.session.completed":
        console.log(eventType, data.object.mode);
        if (data.object.mode === "subscription") {
          await createSubscription(data.object);
        } else {
          await contentBought(data.object);
        }
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
