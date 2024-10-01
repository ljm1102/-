import express from 'express';
import Post from '../models/Post.js';
import Group from '../models/Group.js';
import Comment from '../models/Comment.js';
import bcrypt from 'bcryptjs';
import moment from 'moment';

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

// 배지 조건 체크 및 부여(post)
async function checkAndAwardBadges(groupId) {
    const group = await Group.findById(groupId);
    if (!group) {
        return; // 그룹이 존재하지 않으면 배지 체크를 중단
    }

    // 1. 7일 연속 게시글 등록
    const posts = await Post.find({
        groupId: groupId,
    }).sort({ moment: 1 }); // 게시글들을 날짜 순으로 정렬
    
    let consecutiveDays = 1;
    for (let i = 1; i < posts.length; i++) {
        const prevPostDate = moment(posts[i - 1].moment).startOf('day');
        const currentPostDate = moment(posts[i].moment).startOf('day');
        
        // 두 게시글이 연속된 날에 작성되었는지 확인
        if (currentPostDate.diff(prevPostDate, 'days') === 1) {
            consecutiveDays += 1;
        } else if (currentPostDate.diff(prevPostDate, 'days') > 1) {
            consecutiveDays = 1; // 연속되지 않으면 초기화
        }
    
        // 7일 연속 게시글이 등록된 경우
        if (consecutiveDays === 6) {
            if (!group.badges.includes('7일 연속 추억 등록')) {
                group.badges.push('7일 연속 추억 등록');
                await group.save(); // 배지를 추가하고 그룹 저장
            }
            break; // 조건을 충족하면 반복 종료
        }
    }
    

    // 5. 추억 공감 1만 개 이상 받은 게시글이 있는지 확인
    const postWith10kLikes = await Post.findOne({
        groupId: groupId,
        postlikeCount: { $gte: 10000 }
    });

    if (postWith10kLikes) {
        if (!group.badges.includes('추억 공감 1만 개 이상 받기')) {
            group.badges.push('추억 공감 1만 개 이상 받기');
            await group.save(); // 배지를 추가하고 그룹 저장
        }
    }
}

// 게시글 등록 API
router.post('/groups/:groupId/posts', asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const newPost = new Post({ ...req.body, groupId }); // req.body를 그대로 할당하여 새로운 게시글 생성

    // 그룹 존재 여부 확인
    const groupExists = await Group.findById(groupId);
    if (!groupExists) {
        return res.status(404).send({ message: "존재하지 않는 그룹입니다." });
    }

    // 게시글이 등록된 후 해당 그룹에 배지 조건 확인
    await checkAndAwardBadges(newPost.groupId);

    await newPost.save();
    res.status(200).send(newPost);
}));

// 게시글 목록 조회 API
router.get('/groups/:groupId/posts', asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { page = 1, pageSize = 10, sortBy = 'latest', keyword = '', isPublic } = req.query;

    // 그룹 존재 여부 확인
    const groupExists = await Group.findById(groupId);
    if (!groupExists) {
        return res.status(404).send({ message: "존재하지 않는 그룹입니다." });
    }

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
                             .limit(Number(pageSize))
                             .lean();

    // 각 게시글에 댓글 수 추가
    for (let post of posts) {
        post.commentCount = await Comment.countDocuments({ postId: post._id });
    }

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
            postlikeCount: post.postlikeCount,
            commentCount: post.commentCount,
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
        return res.status(404).send({ message: '게시글이 존재하지 않습니다' });
    }

    // 비밀번호 확인
    const isMatch = await bcrypt.compare(postPassword, post.postPassword);
    if (!isMatch) {
        return res.status(403).send({ message: "비밀번호가 틀렸습니다." });
    }

    // 게시글 수정
    Object.assign(post, updatedData);
    await post.save();

    // 게시글이 수정된 후 해당 그룹에 배지 조건 확인
    await checkAndAwardBadges(post.groupId);

    res.status(200).send(post);
}));

// 게시글 삭제 API
router.delete('/posts/:postId', asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { postPassword } = req.body;

    // 게시글 조회
    const post = await Post.findById(postId);
    if (!post) {
        return res.status(404).send({ message: '게시글이 존재하지 않습니다' });
    }

    // 비밀번호 확인
    const isMatch = await bcrypt.compare(postPassword, post.postPassword);
    if (!isMatch) {
        return res.status(403).send({ message: "비밀번호가 틀렸습니다." });
    }

    // 게시글 삭제
    await Post.findByIdAndDelete(postId);
    res.status(200).send({ message: '게시글 삭제 성공' });
}));


// 게시글 상세 조회 API
router.get('/posts/:postId', asyncHandler(async (req, res) => {
    const { postId } = req.params;

    // 해당 게시글을 찾음
    const post = await Post.findById(postId);

    // 게시글이 없을 경우 404 반환
    if (!post) {
        return res.status(404).send({ message: '게시글이 존재하지 않습니다' });
    }

    // 댓글 수 추가
    const commentCount = await Comment.countDocuments({ postId: post._id });
    post.commentCount = commentCount; // 댓글 수 추가

    // 해당 게시글의 댓글 목록 조회
    const comments = await Comment.find({ postId: post._id })
                                  .select('-password') // 비밀번호 제외
                                  .lean(); // 평범한 JS 객체로 변환

    // 성공적으로 게시글을 찾았을 경우 게시글 정보 반환
    res.status(200).send({
        id: post._id,
        groupId: post.groupId,
        nickname: post.nickname,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl,
        tags: post.tags,
        location: post.location,
        moment: post.moment,
        isPublic: post.isPublic,
        postlikeCount: post.postlikeCount || 0, // 공감수
        commentCount: post.commentCount || 0, // 댓글수
        comments: comments, //댓글 목록
    });
}));


// 게시글 비밀번호 확인 API
router.post('/posts/:postId/verify-password', asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { postPassword } = req.body;

    // 해당 게시글을 찾음
    const post = await Post.findById(postId);

    // 게시글이 없을 경우 404 반환
    if (!post) {
        return res.status(404).send({ message: '게시글이 존재하지 않습니다' });
    }

    // 비밀번호가 일치하는지 확인
    const isMatch = await bcrypt.compare(postPassword, post.postPassword);
    if (!isMatch) {
        // 비밀번호가 일치하면 성공 메시지 반환
        return res.status(200).send({ message: '비밀번호가 확인되었습니다' });
    } else {
        // 비밀번호가 틀리면 401 오류 반환
        return res.status(401).send({ message: '비밀번호가 틀렸습니다' });
    }
}));


// 게시글 공감하기 API
router.post('/posts/:postId/like', asyncHandler(async (req, res) => {
    const { postId } = req.params;

    // 해당 게시글을 찾음
    const post = await Post.findById(postId);

    // 게시글이 없을 경우 404 반환
    if (!post) {
        return res.status(404).send({ message: '게시글이 존재하지 않습니다' });
    }

    // 공감 수 증가
    post.postlikeCount += 1;

    // 게시글 저장
    await post.save();

    // 좋아요가 변경된 후 해당 그룹에 배지 조건 확인
    await checkAndAwardBadges(post.groupId);

    // 성공 메시지 반환
    res.status(200).send({ message: '게시글 공감하기 성공' });
}));


// 게시글 공개 여부 확인 API
router.get('/posts/:postId/is-public', async (req, res) => {
    try {
        const { postId } = req.params;
        const post = await Post.findById(postId).select('isPublic');

        if (!post) {
            return res.status(404).send({ message: '게시글을 찾을 수 없습니다.' });
        }

        res.status(200).send({
            id: postId,
            isPublic: post.isPublic,
        });
    } catch (error) {
        res.status(500).send({ message: '서버 오류입니다.' });
    }
});

export default router;