import express from 'express';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// 에러 처리 핸들러
function asyncHandler(handler) {
    return async function (req, res) {
        try {
            await handler(req, res);
        } catch (e) {
            if (e.name === 'ValidationError') {
                res.status(400).send({ message: e.message });
            } else if (e.name === 'CastError') {
                res.status(404).send({ message: 'Cannot find given id.' });
            } else {
                res.status(500).send({ message: e.message });
            }
        }
    };
}

// 댓글 등록 API
router.post('/posts/:postId/comments', asyncHandler(async (req, res) => {
    const { postId } = req.params;

    // 게시글 존재 여부 확인
    const postExists = await Post.findById(postId);
    if (!postExists) {
        return res.status(404).send({ message: "존재하지 않는 게시글입니다." });
    }

    const newComment = new Comment({ 
        ...req.body, // req.body를 그대로 할당하여 새로운 댓글 생성
        postId 
    });

    await newComment.save();

    // 성공 응답
    res.status(200).send({ newComment }); // 전체 newComment 객체 반환
}));


// 댓글 목록 조회 API
router.get('/posts/:postId/comments', asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { page = 1, pageSize = 10 } = req.query; // 기본값 설정

    // 게시글 존재 여부 확인
    const postExists = await Post.findById(postId);
    if (!postExists) {
        return res.status(404).send({ message: "존재하지 않는 게시글입니다." });
    }

    const totalItemCount = await Comment.countDocuments({ postId }); // 해당 게시글의 댓글 수
    const totalPages = Math.ceil(totalItemCount / pageSize); // 전체 페이지 수

    const comments = await Comment.find({ postId })
        .skip((page - 1) * pageSize) // 페이징을 위한 skip
        .limit(Number(pageSize)) // 페이지당 아이템 수 설정
        .sort({ createdAt: -1 }); // 최신 댓글 순으로 정렬

    // 성공 응답
    res.status(200).send({
        currentPage: Number(page),
        totalPages: totalPages,
        totalItemCount: totalItemCount,
        data: comments.map(comment => ({
            id: comment._id,
            nickname: comment.nickname,
            content: comment.content,
            createdAt: comment.createdAt,
        })),
    });
}));



// 댓글 수정 API
router.put('/comments/:commentId', asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { nickname, content, commentPassword } = req.body;

    // 댓글 존재 여부 확인
    const comment = await Comment.findById(commentId);
    if (!comment) {
        return res.status(404).send({ message: "존재하지 않는 댓글입니다." });
    }

    // 비밀번호 확인
    const isMatch = await bcrypt.compare(commentPassword, comment.commentPassword);
    if (!isMatch) {
        return res.status(403).send({ message: "비밀번호가 틀렸습니다." });
    }

    // 댓글 수정
    comment.nickname = nickname;
    comment.content = content;
    await comment.save();

    // 성공 응답
    res.status(200).send({
        id: comment._id,
        nickname: comment.nickname,
        content: comment.content,
        createdAt: comment.createdAt,
    });
}));


// 댓글 삭제 API
router.delete('/comments/:commentId', asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { commentPassword } = req.body;

    // 댓글 존재 여부 확인
    const comment = await Comment.findById(commentId);
    if (!comment) {
        return res.status(404).send({ message: "존재하지 않는 댓글입니다." });
    }

    // 비밀번호 확인
    const isMatch = await bcrypt.compare(commentPassword, comment.commentPassword);
    if (!isMatch) {
        return res.status(403).send({ message: "비밀번호가 틀렸습니다." });
    }

    // 댓글 삭제
    await Comment.findByIdAndDelete(commentId);

    // 성공 응답
    res.status(200).send({ message: "댓글 삭제 성공" });
}));


export default router;