const { MongoClient } = require("mongodb");
const config = require('./config/vars');
const axios = require('axios');

const schedule = require('node-schedule');

async function run() {
  // Connection URI
  const uri =
  "mongodb://ocultuz:Ocultuz12@157.230.215.128:27017/OcultuzDB";

  // Create a new MongoClient
  const client = new MongoClient(uri);

  try {
    // Connect the client to the server
    await client.connect();

    // Establish and verify connection
    const database = await client.db("OcultuzDB");
    
    const subscriptions = database.collection("subscriptions");

    const now = new Date();
    const query = { nextPaymentDueDate : { $lt: now } };

    const options = { };

    const subscriptionsDB = await subscriptions.find(query, options);

    if ((await subscriptionsDB.count()) === 0) {

        console.log("No subs to update found! - ", now);
        return;

    }

    console.log('SubscriptionID', ' - ', 'subNextPayment', ' - ', 'dbNextPayment', ' - ', '(subNextPayment > dbNextPayment)');

    const subscriptionsFoundPromises = [];
    await subscriptionsDB.forEach( async (subscription) => {
      subscriptionsFoundPromises.push(verifySubscription(subscription, database));
    });

    await Promise.all(subscriptionsFoundPromises);

  } finally {
    console.log('close');
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

async function updateSub(subId, nextPaymentDueDate, database) {

  return new Promise(async (resolve, reject) => {

    const subscriptions = database.collection("subscriptions");
    const filter = { _id: subId };
  
    const updateDocument = {
      $set: {
          nextPaymentDueDate: nextPaymentDueDate,
      },
    };
  
    await subscriptions.updateOne(filter, updateDocument);
    resolve();

  })
  
}

function verifySubscription(subscription, database) {
  let url = "https://api.mercadopago.com/preapproval/search";
  url += `?access_token=${ config.mpAccessToken }`;
  url += `&preapproval_plan_id=${subscription.paymentData.preapproval_plan_id}`;

  return new Promise((resolve, reject) => {
    axios.get(url, {
      headers: {
          'Content-Type': 'application/json',
      }
    }).then((response) => {
      if(response.data.results.length == 0) {
        console.log('Sub not found on MP - ', subscription.paymentData.preapproval_plan_id);
        resolve();
      }

      const sub = response.data.results[0];
      const subNextPayment = new Date(sub.next_payment_date);
      const dbNextPayment = new Date(subscription.nextPaymentDueDate);

      console.log(subscription._id, ' - ',subNextPayment, ' - ', dbNextPayment, ' - ', (subNextPayment > dbNextPayment));

      if(subNextPayment > dbNextPayment) {

        updateSub(subscription._id, subNextPayment, database).then(() => {
          console.log(subscription._id, ' - ', 'updated')
          resolve();

        }).catch(error => {

          console.log('UpdatingError: ', error);
          reject();

        })

      } else {
        resolve();
      }
    })
    .catch(error => {
      console.log('getSubscriptionInfo: ', error)
      reject();
    });
  })
}

const job = schedule.scheduleJob('* 0 * * *', () => {
  run()
    .catch(console.dir);
});

