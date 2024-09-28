import mongoose from "mongoose";

// 그룹 스키마 및 모델 정의
const groupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    password: { type: String, required: true },
    imageUrl: { type: String, required: false },
    isPublic: { type: Boolean, required: true, default: true },
    introduction: { type: String, required: false },
    likeCount: { type: Number, default: 0 },
    badges: [{ type: String }],
    postCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const Group = mongoose.model('Group', groupSchema);

export default Group;