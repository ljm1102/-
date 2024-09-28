import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Group' // 해당 그룹과 연결
    },
    nickname: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    postPassword: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
        required: true,
    },
    tags: {
        type: [String],
        default: [],
    },
    location: {
        type: String,
    },
    moment: {
        type: Date,
        required: true,
    },
    isPublic: {
        type: Boolean,
        default: true,
    },
});

const Post = mongoose.model('Post', postSchema);
export default Post;
