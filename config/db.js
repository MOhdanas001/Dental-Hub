const mongoose = require('mongoose');

const connectDB = () => {
  const DB = process.env.MONGO_URI || "mongodb://localhost:27017/denthub_db";

  mongoose.connect(DB, {
    useNewUrlParser: true,
  });

  const db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('open', function () {
    console.log("Connected");
  });
};

module.exports = connectDB;
