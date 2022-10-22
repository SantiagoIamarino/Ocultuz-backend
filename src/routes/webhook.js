const express = require("express");
const app = express();

const Subscription = require("../models/subscription");
const Purchase = require("../models/purchase");
const User = require("../models/user");
const { timestampToISODate } = require("../config/functions");

const axios = require("axios");
const config = require("../config/vars");
const { update } = require("../models/subscription");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

function getSubscriptionInfo(paymentId) {
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

app.post("/", (req, res) => {
  const body = req.body;
  console.log(req.body);

  if (body.type == "payment") {
    const paymentId = body.data.id;
    const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;

    axios
      .get(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + config.mpAccessToken,
        },
      })
      .then((response) => {
        console.log("PaymentData", response.data);
        const paymentData = response.data;

        if (paymentData.status == "pending") {
          return res.status(200).json({
            ok: true,
          });
        }

        Purchase.findOne({ paymentId: paymentId }, (err, purchaseDB) => {
          if (!purchaseDB) {
            return res.status(200).json({
              ok: true,
            });
          }

          if (purchaseDB.type == "product") {
            if (err) {
              return res.status(200).json({
                ok: true,
              });
            }

            if (paymentData.status == "approved") {
              purchaseDB.pending = false;
            }

            purchaseDB.update(purchaseDB, (errUpdt, purchaseUpdated) => {
              if (errUpdt) {
                return res.status(200).json({
                  ok: true,
                });
              }
            });
          } else {
            //https://api.mercadopago.com/preapproval/search?access_token=APP_USR-5994785052999824-080720-b06d309f87d8a213c21a8b6676c1543d-803836590&preapproval_plan_id=2c9380847b62931d017b9973f148280d

            Subscription.findOne(
              { paymentId: paymentId },
              async (err, subscriptionDB) => {
                if (err) {
                  return res.status(200).json({
                    ok: true,
                  });
                }

                if (!subscriptionDB) {
                  return res.status(200).json({
                    ok: true,
                  });
                }

                const subscription = await getSubscriptionInfo();
                console.log("Sub", subscription);

                subscriptionDB.active = true;
                subscriptionDB.status = "completed";

                subscriptionDB.update(subscriptionDB, (errUpt, subUpdated) => {
                  return res.status(200).json({
                    ok: true,
                  });
                });
              }
            );
          }
        });
      })
      .catch((error) => {
        console.log(error.data);
        return res.status(200).json({
          ok: true,
        });
      });
  } else {
    return res.status(200).json({
      ok: true,
    });
  }
});

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

  const userDB = await User.findById(data.metadata.userId);

  if (userDB.subscriptions.indexOf(data.metadata.girlId) >= 0) {
    return res.status(200).json({
      ok: true,
      subscription: subscriptionDB,
    });
  }

  userDB.subscriptions.push(data.metadata.girlId);
  const userUpdated = await userDB.save();

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

  subscriptionDB.subscriptionEnds = timestampToISODate(data.expires_at);
  subscriptionDB.nextPaymentDueDate = timestampToISODate(
    data.next_payment_attempt
  );
  subscriptionDB.paymentData = data;
  delete subscriptionDB._id;

  const subscriptionUpdated = await subscriptionDB.update();

  return subscriptionUpdated;
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
        // The payment failed or the customer does not have a valid payment method.
        // The subscription becomes past_due. Notify your customer and send them to the
        // customer portal to update their payment information.
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
