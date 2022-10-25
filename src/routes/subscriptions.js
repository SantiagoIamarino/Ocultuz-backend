const express = require("express");

const mdAuth = require("../middlewares/auth").verifyToken;
const mdSameUser = require("../middlewares/same-user").verifySameUserOrAdmin;

const Subscription = require("../models/subscription");
const Purchase = require("../models/purchase");
const User = require("../models/user");

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
