const mongoose = require("mongoose");
const Schema = mongoose.Schema;

var UserSchema = new Schema({
  name: String,
  UUID: String,
  votes: [{ name: String }]
});

module.exports = mongoose.model("UserModel", UserSchema);
