const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const RoomStatuses = Object.freeze({
  addingOptions: "ADDING_OPTIONS",
  dotVoting: "DOT_VOTING",
  results: "RESULTS"
});

var RoomSchema = new Schema({
  roomName: String,
  adminName: String,
  votesPerPerson: String,
  roomNumber: String,
  roomStatus: { type: String, enum: Object.values(RoomStatuses) },
  options: [{ name: String }],
  users: [
    {
      name: String,
      UUID: String,
      votes: [{ name: String }]
    }
  ],
  totalVotes: { type: String, default: "0" },
  createdAtDate: { type: Date, default: Date.now }
});

Object.assign(RoomSchema.statics, {
  RoomStatuses
});

module.exports = mongoose.model("RoomModel", RoomSchema);
