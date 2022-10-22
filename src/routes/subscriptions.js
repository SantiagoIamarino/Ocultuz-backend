const express = require("express");
const axios = require("axios");

const mdAuth = require("../middlewares/auth").verifyToken;
const mdSameUser = require("../middlewares/same-user").verifySameUserOrAdmin;

const Subscription = require("../models/subscription");
const Purchase = require("../models/purchase");
const User = require("../models/user");

const config = require("../config/vars");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

app.get("/user-subscriptions/:userId", [mdAuth, mdSameUser], (req, res) => {
  const userId = req.params.userId;
  Subscription.find({ userId: userId, active: true })
    .populate("userId")
    .populate("girlId")
    .exec((err, subscriptions) => {
      if (err) {
        return res.status(500).json({
          ok: false,
          error: err,
        });
      }

      return res.status(200).json({
        ok: true,
        subscriptions,
      });
    });
});

app.post("/girl-subscriptions/:userId", [mdAuth, mdSameUser], (req, res) => {
  const girlId = req.params.userId;
  const limit = req.body.limit;
  const page = req.body.page;

  const mongooseFilters = {
    girlId: girlId,
    pending: false,
    type: "subscription",
  };

  if (req.body.filter && req.body.filter.from && req.body.filter.to) {
    mongooseFilters.$and = [
      { subscribedSince: { $gte: req.body.filter.from } },
      { subscribedSince: { $lte: req.body.filter.to } },
    ];
  }

  Purchase.find(mongooseFilters)
    .populate("userId")
    .skip(page * limit - limit)
    .limit(limit)
    .exec((err, subscriptions) => {
      if (err) {
        return res.status(500).json({
          ok: false,
          error: err,
        });
      }

      Purchase.count(mongooseFilters, (errCount, total) => {
        return res.status(200).json({
          ok: true,
          total,
          subscriptions,
        });
      });
    });
});

function updateUserSubs(userToUpdate) {
  return new Promise((resolve, reject) => {
    User.findById(userToUpdate._id, (err, userDB) => {
      if (err) {
        reject(err);
      }

      userDB.subscriptions = userToUpdate.subscriptions;
      userDB.update(userDB, (errUpdt, userUpdated) => {
        if (errUpdt) {
          reject(errUpdt);
        }

        resolve(userDB);
      });
    });
  });
}

app.post("/", (req, res) => {
  const body = req.body;

  User.findById(body.user._id, async (findErr, userDB) => {
    if (findErr) {
      return res.status(500).json({
        ok: false,
        error: findErr,
      });
    }

    if (!userDB) {
      return res.status(400).json({
        ok: false,
        message: "No existe un usuario con ese ID",
      });
    }

    if (!body.girl._id) {
      console.log(body);
      return res.status(400).json({
        ok: false,
        message: "No has seleccionado una chica",
      });
    }

    if (
      !userDB.subscriptions ||
      userDB.subscriptions.indexOf(body.girl._id) < 0
    ) {
      return res.status(400).json({
        ok: false,
        message: "Ya te has subscrito a esta creadora",
      });
    }

    try {
      const planId = await createPlan(body.amount);

      const subscriptionRequest = {
        preapproval_plan_id: planId,
        card_token_id: body.cardToken,
        payer_email: userDB.email,
      };

      axios
        .post("https://api.mercadopago.com/preapproval", subscriptionRequest, {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + config.mpAccessToken,
          },
        })
        .then((response) => {
          const subscription = response.data;
          const daysBeforeCancell = config.daysBeforeCancell + 2;

          let subscriptionEnds = new Date(subscription.date_created);
          subscriptionEnds.setMonth(subscriptionEnds.getMonth() + 1);
          subscriptionEnds.setDate(
            subscriptionEnds.getDate() + daysBeforeCancell
          );

          const subscriptionData = {
            userId: body.user._id,
            girlId: body.girl._id,
            type: "subscription",
            subscribedSince: new Date(subscription.date_created),
            subscriptionEnds,
            nextPaymentDueDate: new Date(subscription.date_created),
            paymentId: subscription.id,
            paymentData: subscription,
            status:
              subscription.status === "authorized" ? "completed" : "pending",
          };

          const newSubscription = new Subscription(subscriptionData);

          newSubscription.save((err, subscriptionSaved) => {
            if (err) {
              console.log(err);
              return res.status(500).json({
                ok: false,
                error: err,
              });
            }

            // Creating purchase
            const purchaseData = {
              ...subscriptionData,
              date: new Date(subscription.date_created),
              amount: body.girl.subscriptionPrice,
            };

            const purchase = new Purchase(purchaseData);

            purchase.save(async (purchaseErr, purchaseSaved) => {
              if (purchaseErr) {
                return res.status(500).json({
                  ok: false,
                  error: purchaseErr,
                });
              }

              userDB.subscriptions.push(body.girl._id);

              await updateUserSubs(userDB);

              return res.status(201).json({
                ok: true,
                user: userDB,
                message: "Te has subscripto correctamente a esta creadora",
              });
            });
          });
        })
        .catch((error) => {
          console.log(error);
          return res.status(200).json({
            ok: false,
            error: error,
          });
        });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        ok: false,
        message: "Ha ocurrido un error al procesar el pago",
      });
    }
  });
});

app.post("/unsubscribe/:userId", [mdAuth, mdSameUser], async (req, res) => {
  const body = req.body;
  const userId = req.params.userId;

  try {
    const userDB = await User.findById(userId);
    if (!userDB) {
      return res.status(400).json({
        ok: false,
      });
    }

    if (userDB.subscriptions && userDB.subscriptions.indexOf(body.girlId) < 0) {
      return res.status(400).json({
        ok: false,
        message: "No te encuentras subscripto",
      });
    }

    const subscriptionDB = await Subscription.findById(body.subscriptionId);

    await stripe.subscriptions.update(subscriptionDB.paymentId, {
      cancel_at_period_end: true,
    });

    delete subscriptionDB._id;
    subscriptionDB.status = "cancelled";
    await subscriptionDB.update();

    return res.status(200).json({
      ok: true,
      message:
        "Has cancelado tu subscripción correctamente, la misma dejará de estar vigente al finalizar el periodo actual",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error,
    });
  }
});

module.exports = app;
