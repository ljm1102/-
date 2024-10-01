import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const commentSchema = new mongoose.Schema({
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Post' // 댓글이 속한 게시글과 연결
    },
    nickname: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    commentPassword: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// 비밀번호 저장 전 해시 처리
commentSchema.pre('save', async function(next) {
    if (this.isModified('commentPassword')) {
        this.commentPassword = await bcrypt.hash(this.commentPassword, 10);
    }
    next();
});

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
