
import mongoose from "mongoose";

const stateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "main",
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    minimize: false,
    versionKey: false,
  }
);

const State =
  mongoose.models.State || mongoose.model("State", stateSchema);

export async function connectDB() {
  await mongoose.connect(
    process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017/surpluslink"
  );

  console.log("MongoDB connected: surpluslink");
}

export default State;
