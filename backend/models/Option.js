const mongoose = require("mongoose");
const Schema = mongoose.Schema;

var OptionSchema = new Schema({ name: String });

module.exports = mongoose.model("OptionModel", OptionSchema);
