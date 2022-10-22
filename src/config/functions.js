const timestampToISODate = (timestamp) => {
  if (!timestamp) {
    return new Date().toISOString();
  }
  const date = new Date(timestamp * 1000);
  return date.toISOString();
};

module.exports = {
  timestampToISODate,
};
