const User = require("../models/user");
const timestampToISODate = (timestamp) => {
  if (!timestamp) {
    return new Date().toISOString();
  }
  const date = new Date(timestamp * 1000);
  return date.toISOString();
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

module.exports = {
  timestampToISODate,
  addOrRemoveUserSub,
};
