import mongoose from "mongoose";
import data from './mock.js';
import Group from "../models/group.js";
import { DATABASE_URL } from "../env.js";

mongoose.connect(DATABASE_URL);

await Group.deleteMany({});
await Group.insertMany(data);

mongoose.connection.close();
