const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const { RoomStatuses } = require("../enums");
const schedule = require("node-schedule");
const mongoose = require("mongoose");
const history = require("connect-history-api-fallback");
const { nameChanger } = require("./nameChanger");

const OptionModel = require("./models/Option");
const UserModel = require("./models/User");
const RoomModel = require("./models/Room");

const PORT = process.env.PORT || 3000;
app.use(history());

app.use(cors());
app.use(bodyParser.json());

const dbUrl = process.env.DB_URL || "mongodb://127.0.0.1:27017";

mongoose.connect(`${dbUrl}/${process.env.DB}`, { useNewUrlParser: true });
var db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function() {
  console.log("Connected to database");
  // we're connected!
});

let Rooms = [];

schedule.scheduleJob("00 * * * *", function() {
  var cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 3);
  console.log(
    "roomcount before: ",
    RoomModel.estimatedDocumentCount()
      .lean()
      .exec((err, res) => {
        return res;
      })
  );
  RoomModel.deleteMany({ createdAtDate: { $lt: cutoff } }, err => {
    console.log(err);
  }).then(() =>
    console.log(
      "roomcount after: ",
      RoomModel.estimatedDocumentCount()
        .lean()
        .exec((err, res) => {
          return res;
        })
    )
  );
});

app.use("/", express.static("../dist"));
app.get("/", (req, res) => {
  const path = require("path");
  res.sendFile(path.resolve("../dist/index.html"));
});

const generateRoomNumber = () => {
  let newRoomNumber;
  do {
    newRoomNumber = Math.floor(1000 + Math.random() * 9000);
  } while (Rooms.filter(rm => rm.roomNumber === newRoomNumber).length !== 0);
  return newRoomNumber;
};

const roomRoutes = express.Router();
app.use("/NewRoom", roomRoutes);
roomRoutes.route("/").post((req, res) => {
  const RoomName = req.body.RoomName;
  const adminName = nameChanger(req.body.UserName);
  const votesPerPerson = req.body.selectedVoteNumber;
  const newRoom = {
    roomName: RoomName,
    adminName: adminName,
    votesPerPerson: votesPerPerson,
    roomNumber: generateRoomNumber(),
    roomStatus: RoomStatuses.addingOptions,
    options: [],
    users: []
  };
  RoomModel.create(newRoom);
  res.json(newRoom);
});

roomRoutes.route("/").get((req, res) => {
  const path = require("path");
  res.sendFile(path.resolve("../dist/index.html"));
});

roomRoutes.route("/:roomNumber").get((req, res) => {
  const foundRoom = RoomModel.find({
    roomNumber: parseInt(req.params.roomNumber)
  })
    .lean()
    .exec((err, room) => {
      return JSON.stringify(room);
    });
  if (!foundRoom) {
    res.json(false);
  } else {
    res.json(foundRoom);
  }
});

const resultBuilder = roomNumber => {
  const foundRoom = RoomModel.find({ roomNumber: parseInt(roomNumber) })
    .lean()
    .exec((err, room) => {
      return JSON.stringify(room);
    });
  if (!foundRoom) {
    return;
  }

  const combinedVotes = foundRoom.users.reduce((accumulator, currentValue) => {
    const retValue = accumulator.concat(currentValue.votes);
    return retValue;
  }, []);

  const result = foundRoom.options
    .map(opt => {
      return {
        name: opt,
        count: combinedVotes.filter(cv => cv === opt).length
      };
    })
    .sort((a, b) => b.count - a.count);
  return result;
};

const server = app.listen(PORT, function() {
  console.log("Server is running on Port: " + PORT);
});

const io = require("socket.io")(server);
io.on("connection", function(socket) {
  socket.on("join", function(data) {
    const { roomNumber, userName, effectiveUUID } = data;
    const editedName = nameChanger(userName);
    console.log("joining room: ", roomNumber);
    socket.join(roomNumber);
    const foundRoom = RoomModel.find({ roomNumber: parseInt(roomNumber) })
      .lean()
      .exec((err, room) => {
        console.log(JSON.stringify(room));
        return JSON.stringify(room);
      });

    if (!foundRoom) {
      return;
    }

    const foundUser = foundRoom.users.find(u => u.UUID === effectiveUUID);
    if (!foundUser) {
      let isNameGood = false;
      let nameBuilder = editedName;
      let i = 2;
      while (!isNameGood) {
        if (
          foundRoom.users.filter(us => us.name === nameBuilder).length === 0
        ) {
          isNameGood = true;
        } else {
          nameBuilder = editedName + "(" + i + ")";
          i = i + 1;
        }
      }

      const updatedUsers = [
        ...foundRoom.users,
        { name: nameBuilder, UUID: effectiveUUID, votes: [] }
      ];
      const updatedRoom = { ...foundRoom, users: updatedUsers };
      Rooms = Rooms.filter(rm => rm.roomNumber !== roomNumber);
      Rooms.push(updatedRoom);
      console.log("User ", nameBuilder, " Room ", roomNumber);

      io.to(roomNumber).emit("UPDATED_OPTIONS", foundRoom.options);
      io.to(roomNumber).emit("UPDATED_USER_COUNT", updatedUsers.length);
      if (nameBuilder !== userName) {
        console.log("emitting ", nameBuilder);
        socket.emit("FORCE_NAME_CHANGE", nameBuilder);
      }
    }
  });

  socket.on("ADD_OPTION", function(data) {
    console.log("adding option");
    const { newOption, roomNumber } = data;
    const editedNewOption = nameChanger(newOption);
    const foundRoom = Rooms.find(
      room => room.roomNumber === parseInt(roomNumber)
    );
    if (!foundRoom) {
      return;
    }
    if (foundRoom.options.filter(op => op === editedNewOption).length !== 0) {
      return;
    }
    console.log("old Options", foundRoom.options);
    const updatedOptions = [...foundRoom.options, editedNewOption];
    const updatedRoom = {
      ...foundRoom,
      options: updatedOptions
    };
    Rooms = Rooms.filter(rm => rm.roomNumber !== roomNumber);
    Rooms.push(updatedRoom);
    console.log("UpdatedOptions", updatedOptions);
    io.to(roomNumber).emit("UPDATED_OPTIONS", updatedOptions);
  });

  socket.on("ADVANCE_ROOM", function(data) {
    console.log("advancinig", data);
    const foundRoom = Rooms.find(aRoom => aRoom.roomNumber === data.roomNumber);
    if (!foundRoom) {
      return;
    }
    let updatedRoom;
    if (foundRoom.roomStatus === RoomStatuses.addingOptions) {
      updatedRoom = {
        ...foundRoom,
        roomStatus: RoomStatuses.dotVoting
      };
    } else if (foundRoom.roomStatus === RoomStatuses.dotVoting) {
      updatedRoom = {
        ...foundRoom,
        roomStatus: RoomStatuses.results
      };
      const theResults = resultBuilder(data.roomNumber);
      io.to(data.roomNumber).emit("UPDATE_RESULTS", theResults);
    } else {
      return;
    }
    Rooms = Rooms.filter(rm => rm.roomNumber !== data.roomNumber);
    Rooms.push(updatedRoom);
    io.to(data.roomNumber).emit("SET_ROOM_STATUS", updatedRoom.roomStatus);
  });

  socket.on("ADD_VOTE", function(data) {
    const { roomNumber, option, UUID } = data;
    const foundRoom = RoomModel.find({
      roomNumber: roomNumber
    })
      .lean()
      .exec((err, room) => {
        return JSON.stringify(room);
      });
    if (!foundRoom) {
      console.log("no room found");
      return;
    }
    const foundUser = foundRoom.users.find(u => u.UUID === UUID);
    if (!foundUser) {
      console.log("no user");

      return;
    }
    if (foundUser.votes.length >= foundRoom.votesPerPerson) {
      console.log("too many votes");

      return;
    }
    const newVotes = [...foundUser.votes, option];
    const newUser = { ...foundUser, votes: newVotes };
    const filteredUsers = foundRoom.users.filter(u => u.UUID !== UUID);
    const updatedUsers = [...filteredUsers, newUser];
    const newRoom = {
      ...foundRoom,
      users: updatedUsers,
      totalVotes: foundRoom.totalVotes + 1
    };
    Rooms = Rooms.filter(rm => rm.roomNumber !== roomNumber);
    Rooms.push(newRoom);
    socket.emit("UPDATE_OWN_VOTES", newVotes);

    io.to(roomNumber).emit("UPDATE_TOTAL_VOTES", newRoom.totalVotes);
  });
});
