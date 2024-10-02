import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Comment from './Comment.js';

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
    postlikeCount: {
        type: Number,
        default: 0,  // 초기값은 0
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
    commentCount: {
        type: Number,
        default: 0,
    }
});

// 비밀번호 저장 전 해시 처리
postSchema.pre('save', async function(next) {
    if (this.isModified('postPassword')) {
        this.postPassword = await bcrypt.hash(this.postPassword, 10);
    }
    next();
});

// 게시글이 삭제되기 전에 해당 게시글에 속한 모든 댓글 삭제
postSchema.pre('findByIdAndDelete', async function(next) {
    const postId = this.getQuery().id;
    await Comment.deleteMany({ postId });
    next();
  });

const Post = mongoose.model('Post', postSchema);
export default Post;
