const MongoClient = require("mongodb").MongoClient;
const assert = require("assert");

// Connection URL
const url = process.env.DBURL || "mongodb://localhost:27017";
const dbUsername = process.env.ME_CONFIG_MONGODB_ADMINUSERNAME;
const dbPass = process.env.ME_CONFIG_MONGODB_ADMINPASSWORD;

// Database Name
const dbName = process.env.DBNAME || "dotvotrr";

// Use connect method to connect to the server
MongoClient.connect(url, function(err, client) {
  assert.equal(null, err);
  console.log("Connected correctly to server");

  const db = client.db(dbName);

  insertDocuments(db, function() {
    findDocuments(db, function() {
      client.close();
    });
  });
});

const createRoom = function(db, room, callback) {
  // Get the documents collection
  const collection = db.collection("rooms");
  // Insert some documents
  collection.insert(room, function(err, result) {
    assert.equal(err, null);
    assert.equal(1, result.result.n);
    assert.equal(1, result.ops.length);
    console.log("Inserted 1 documents into the collection");
    callback(result);
  });
};

const insertDocuments = function(db, callback) {
  // Get the documents collection
  const collection = db.collection("users");
  // Insert some documents
  collection.insertMany(
    [{ name: "Bob" }, { name: "Jeff" }, { name: "George" }],
    function(err, result) {
      assert.equal(err, null);
      assert.equal(3, result.result.n);
      assert.equal(3, result.ops.length);
      console.log("Inserted 3 documents into the collection");
      callback(result);
    }
  );
};

const findDocuments = function(db, callback) {
  // Get the documents collection
  const collection = db.collection("users");
  // Find some documents
  collection.find({ name: "George" }).toArray(function(err, docs) {
    assert.equal(err, null);
    console.log("Found the following records");
    console.log(docs);
    callback(docs);
  });
};

const updateDocument = function(db, callback) {
  // Get the documents collection
  const collection = db.collection("documents");
  // Update document where a is 2, set b equal to 1
  collection.updateOne({ a: 2 }, { $set: { b: 1 } }, function(err, result) {
    assert.equal(err, null);
    assert.equal(1, result.result.n);
    console.log("Updated the document with the field a equal to 2");
    callback(result);
  });
};

const removeDocument = function(db, callback) {
  // Get the documents collection
  const collection = db.collection("documents");
  // Delete document where a is 3
  collection.deleteOne({ a: 3 }, function(err, result) {
    assert.equal(err, null);
    assert.equal(1, result.result.n);
    console.log("Removed the document with the field a equal to 3");
    callback(result);
  });
};
