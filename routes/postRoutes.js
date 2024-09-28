import express from 'express';
import Post from '../models/Post.js';

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

// 게시글 등록 API
router.post('/groups/:groupId/posts', asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const newPost = new Post({ ...req.body, groupId }); // req.body를 그대로 할당하여 새로운 게시글 생성

    await newPost.save();
    res.status(200).send(newPost);
}));

// 게시글 목록 조회 API
router.get('/groups/:groupId/posts', asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { page = 1, pageSize = 10, sortBy = 'latest', keyword = '', isPublic } = req.query;

    const query = { groupId };
    if (isPublic !== undefined) query.isPublic = isPublic === 'true';
    if (keyword) {
        query.$or = [
            { title: new RegExp(keyword, 'i') },
            { tags: { $in: [new RegExp(keyword, 'i')] } }
        ];
    }

    const sortOption = sortBy === 'mostCommented' ? { commentCount: -1 } :
                       sortBy === 'mostLiked' ? { likeCount: -1 } :
                       { createdAt: -1 }; // Default: latest

    const skip = (page - 1) * pageSize;
    const posts = await Post.find(query)
                             .sort(sortOption)
                             .skip(skip)
                             .limit(Number(pageSize));

    const totalItemCount = await Post.countDocuments(query);
    const totalPages = Math.ceil(totalItemCount / pageSize);

    res.send({
        currentPage: Number(page),
        totalPages,
        totalItemCount,
        data: posts.map(post => ({
            id: post._id,
            nickname: post.nickname,
            title: post.title,
            imageUrl: post.imageUrl,
            tags: post.tags,
            location: post.location,
            moment: post.moment,
            isPublic: post.isPublic,
            likeCount: post.likeCount,
            commentCount: post.commentCount,
            createdAt: post.createdAt,
        })),
    });
}));

// 게시글 수정 API
router.put('/posts/:postId', asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { postPassword, ...updatedData } = req.body;

    // 게시글 조회
    const post = await Post.findById(postId);
    if (!post) {
        return res.status(404).send({ message: '존재하지 않습니다' });
    }

    // 비밀번호 확인
    if (post.postPassword !== postPassword) {
        return res.status(403).send({ message: '비밀번호가 틀렸습니다' });
    }

    // 게시글 수정
    Object.assign(post, updatedData);
    await post.save();

    res.status(200).send(post);
}));

// 게시글 삭제 API
router.delete('/posts/:postId', asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { postPassword } = req.body;

    // 게시글 조회
    const post = await Post.findById(postId);
    if (!post) {
        return res.status(404).send({ message: '존재하지 않습니다' });
    }

    // 비밀번호 확인
    if (post.postPassword !== postPassword) {
        return res.status(403).send({ message: '비밀번호가 틀렸습니다' });
    }

    // 게시글 삭제
    await Post.findByIdAndDelete(postId);
    res.status(200).send({ message: '게시글 삭제 성공' });
}));


export default router;