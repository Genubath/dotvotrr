<template>
  <div class="Room">
    <NavBar />
    <b-card id="cardNew">
      <div class="topStuffHolder">
        <div>
          <H4>Room Number: {{roomNumber}}</H4>
          <div
            v-if="roomStatus===RoomStatuses.addingOptions"
            class="room-subtitle"
          >Hi {{userName}}, add options for: {{roomName}}</div>
          <div
            v-if="roomStatus===RoomStatuses.dotVoting"
            class="room-subtitle"
          >{{userName}}, vote on options for: {{roomName}}</div>
          <div
            v-if="roomStatus===RoomStatuses.results"
            class="room-subtitle"
          >Results for {{roomName}}!</div>
        </div>
        <creator-tools
          v-if="adminName===userName && roomStatus!==RoomStatuses.results"
          :roomNumber="roomNumber"
          :roomStatus="roomStatus"
          :totalVotes="totalVotes"
          :expectedVotes="(userCount*votesPerPerson)"
        />
      </div>
      <div v-if="roomStatus===RoomStatuses.addingOptions">
        <OptionsInputs :roomNumber="roomNumber" :optionList="optionList" />
      </div>
      <div v-if="roomStatus===RoomStatuses.dotVoting">
        <VotingList
          :roomNumber="roomNumber"
          :optionList="optionList"
          :votesPerPerson="votesPerPerson"
        />
      </div>
      <div v-if="roomStatus===RoomStatuses.results">
        <Results :resultsList="resultList" />
      </div>
    </b-card>
  </div>
</template>

<script>
// @ is an alias to /src
import axios from "axios";
import { mapGetters } from "vuex";
import io from "socket.io-client";
import OptionsInputs from "../components/Molecules/OptionsInputs.vue";
import RoomStatuses from "../../enums";
import CreatorTools from "../components/Molecules/CreatorTools.vue";
import VotingList from "../components/Molecules/VotingList.vue";
import Results from "../components/Molecules/Results.vue";
import { api_url, backend_port } from "../config";
import NavBar from "../components/atoms/NavBar.vue";

export default {
  name: "Room",
  computed: {
    ...mapGetters({
      roomNumber: "getRoomNumber",
      userName: "getUserName",
      UUID: "getUUID",
      optionList: "getOptionList",
      resultList: "getResultList"
    }),
    RoomStatuses() {
      return RoomStatuses.RoomStatuses;
    }
  },
  data() {
    return {
      roomName: "",
      socket: io(`${api_url}:${backend_port}`),
      roomStatus: null,
      votesPerPerson: 3,
      adminName: "",
      newUUID: null,
      totalVotes: 0,
      userCount: 1
    };
  },
  components: {
    OptionsInputs,
    CreatorTools,
    VotingList,
    Results,
    NavBar
  },
  methods: {
    getRoomInfo() {
      axios
        .get(`http://${api_url}:${backend_port}/NewRoom/${this.roomNumber}`)
        .then(res => {
          this.roomName = res.data.RoomName;
          this.roomStatus = res.data.roomStatus;
          this.adminName = res.data.adminName;
          this.votesPerPerson = res.data.votesPerPerson;
        });
    },
    createUUID() {
      this.newUUID = Math.random().toString(24) + new Date();
      this.$store.commit("setUUID", this.newUUID);
    }
  },
  mounted() {
    this.getRoomInfo();
    let effectiveUUID;
    if (!this.UUID) {
      this.createUUID();
      effectiveUUID = this.newUUID;
    } else {
      effectiveUUID = this.UUID;
    }
    const { roomNumber, userName } = this;
    this.socket.emit("join", { roomNumber, userName, effectiveUUID });
    this.socket.on("UPDATED_OPTIONS", data => {
      this.$store.commit("setOptionList", data);
    });
    this.socket.on("SET_ROOM_STATUS", data => {
      this.roomStatus = data;
    });
    this.socket.on("FORCE_NAME_CHANGE", data => {
      this.$store.commit("setUserName", data);
    });
    this.socket.on("UPDATE_TOTAL_VOTES", data => {
      this.totalVotes = data;
    });
    this.socket.on("UPDATED_USER_COUNT", data => {
      this.userCount = data;
    });
    this.socket.on("UPDATE_RESULTS", data => {
      this.$store.commit("setResultList", data);
    });
  }
};
</script>

<style>
#cardNew {
  margin: 20px 40px 40px 40px;
  border-color: black;
  border-width: 2px;
  border-radius: 0.25rem;
}
.topStuffHolder {
  padding-bottom: 15px;
  display: flex;
  flex-wrap: wrap;
  flex-grow: 1;
  border-bottom: 2px solid #ccc9c9;
  margin-bottom: 15px;
}
.topStuffHolder > div {
  flex-grow: 1;
}
</style>
