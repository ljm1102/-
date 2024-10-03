import express from 'express';
import Group from '../models/Group.js';
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

// 배지 조건 체크 및 부여(group)
async function checkAndAwardBadges(group) {

    // 2. 추억 수 20개 이상 등록
    if (group.postCount >= 20) {
        if (!group.badges.includes('추억 수 20개 이상 등록')) {
            group.badges.push('추억 수 20개 이상 등록');
        }
    }

    // 3. 그룹 생성 후 1년 달성
    if (group.dDay >= 365) {
        if (!group.badges.includes('그룹 생성 후 1년 달성')) {
            group.badges.push('그룹 생성 후 1년 달성');
        }
    }

    // 4. 그룹 공감 1만 개 이상 받기
    if (group.grouplikeCount >= 10000) {
        if (!group.badges.includes('그룹 공감 1만 개 이상 받기')) {
            group.badges.push('그룹 공감 1만 개 이상 받기');
        }
    }


    // 그룹 업데이트
    await group.save();
}

// 그룹 등록 API
router.post('/', asyncHandler(async (req, res) => {
    const newGroup = await Group.create(req.body);
    await newGroup.save();

    // 배지 부여 체크
    await checkAndAwardBadges(newGroup);

    res.status(201).send(newGroup);
}));

// 그룹 목록 조회 API
router.get('/', asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, sortBy = 'latest', keyword = '', isPublic } = req.query;

    // 정렬 옵션 설정
    const sortOption = sortBy === 'mostPosted' ? { postCount: -1 } :
                       sortBy === 'mostLiked' ? { grouplikeCount: -1 } :
                       sortBy === 'mostBadge' ? { badges: -1 } :
                       { createdAt: -1 }; // Default: 최신순

    // 검색 조건 설정
    const query = keyword ? { name: new RegExp(keyword, 'i') } : {};
    if (isPublic !== undefined) query.isPublic = isPublic === 'true';

    // 페이징 처리
    const skip = (page - 1) * pageSize;
    
    // 그룹 조회 (비밀번호 제외, 배지 목록 대신 배지 수로 변환)
    const groups = await Group.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(Number(pageSize))
        .select('-password') // 비밀번호 제외
        .lean() // 리턴된 문서를 평범한 JS 객체로 변환 (수정 가능하게)

    // 각 그룹에 배지 수 추가
    for (const group of groups) {
        group.badgeCount = group.badges.length; // 배지 목록 대신 배지 수
        delete group.badges; // 배지 목록 삭제

        // D-Day 계산
        const today = new Date();
        const createdDate = new Date(group.createdAt);
        const diffTime = Math.abs(today - createdDate);
        group.dDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // 경과한 일수 계산

        // 게시글 수 추가 (게시글 수를 가져오는 쿼리)
        const postCount = await Post.countDocuments({ groupId: group._id });
        group.postCount = postCount; // 게시글 수 추가
    }

    // 총 문서 수 계산
    const totalItemCount = await Group.countDocuments(query);

    // 응답
    res.send({
        currentPage: Number(page),
        totalPages: Math.ceil(totalItemCount / pageSize),
        totalItemCount,
        data: groups
    });
}));

// 그룹 상세 조회 API
router.post('/:id', asyncHandler(async (req, res) => {
    const groupId = req.params.id;
    const { password } = req.body; // 비밀번호를 요청 본문에서 받음

    const group = await Group.findById(groupId);

    if (!group) {
        return res.status(404).send({ message: '존재하지 않는 그룹입니다' });
    }

    if (!group.isPublic) {
        // 비공개 그룹일 경우 비밀번호 확인
        const isMatch = await bcrypt.compare(password, group.password);
        if (!isMatch) {
            return res.status(403).send({ message: '비밀번호가 일치하지 않습니다' });
        }
    }

    // 게시글 수 추가
    const postCount = await Post.countDocuments({ groupId: group._id });
    group.postCount = postCount; // 게시글 수 추가

    // 해당 그룹의 게시글 목록 조회
    const posts = await Post.find({ groupId: group._id })
        .select('-postPassword') // 비밀번호 제외
        .lean(); // 평범한 JS 객체로 변환

    // 비밀번호는 응답에서 제외하고 그룹 정보 전송
    const groupDetails = {
        id: group._id,
        name: group.name,
        imageUrl: group.imageUrl,
        isPublic: group.isPublic,
        grouplikeCount: group.grouplikeCount,
        badges: group.badges,
        postCount: group.postCount,
        createdAt: group.createdAt,
        dDay: group.dDay,
        introduction: group.introduction,
        posts: posts
    };

    

    res.status(200).send(groupDetails);
}));


// 그룹 수정 API
router.put('/:id', asyncHandler(async (req, res) => {
    const id = req.params.id;
    const group = await Group.findById(id);
    const { password } = req.body;
    if (group) {
        // 비밀번호 확인
        const isMatch = await bcrypt.compare(password, group.password);
        if (isMatch) {
            Object.keys(req.body).forEach((key) => {
                if (key !== 'password') group[key] = req.body[key];
            });
            await group.save();

            // 배지 부여 체크
            await checkAndAwardBadges(group);

            res.send(group);
        } else {
            res.status(403).send({ message: '비밀번호가 틀렸습니다' });
        }
    } else {
        res.status(404).send({ message: 'Cannot find given id.' });
    }
}));

// 그룹 삭제 API
router.delete('/:id', asyncHandler(async (req, res) => {
    const id = req.params.id;
    const group = await Group.findById(id);
    const { password } = req.body;
    if (group) {
        // 비밀번호 확인
        const isMatch = await bcrypt.compare(password, group.password);
        if (isMatch) {
            await Group.findOneAndDelete({ _id: id }); // findOneAndDelete로 삭제
            res.send({ message: '그룹 삭제 성공' });
        } else {
            res.status(403).send({ message: '비밀번호가 틀렸습니다' });
        }
    } else {
        res.status(404).send({ message: 'Cannot find given id.' });
    }
}));

// 그룹 공감하기 API
router.post('/:id/like', asyncHandler(async (req, res) => {
    const id = req.params.id;
    const group = await Group.findById(id);
    if (group) {
        group.grouplikeCount += 1;
        await group.save();

        // 배지 부여 체크
        await checkAndAwardBadges(group);

        res.send({ message: '그룹 공감하기 성공' });
    } else {
        res.status(404).send({ message: 'Cannot find given id.' });
    }
}));

// 그룹 공개 여부 확인 API
router.get('/:id/is-public', asyncHandler(async (req, res) => {
    const id = req.params.id;
    const group = await Group.findById(id);
    if (group) {
        res.send({ id: group._id, isPublic: group.isPublic });
    } else {
        res.status(404).send({ message: 'Cannot find given id.' });
    }
}));

// 그룹 조회 권한 확인 API
router.post('/:groupId/verify-password', asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { password } = req.body;

    // 그룹 찾기
    const group = await Group.findById(groupId);

    // 그룹이 존재하지 않을 경우 404 응답
    if (!group) {
        return res.status(404).send({ message: '그룹이 존재하지 않습니다' });
    }

    // 비밀번호 비교
    // 비밀번호 확인
    const isMatch = await bcrypt.compare(password, group.password);
    if (isMatch) {
        res.status(200).send({ message: '비밀번호가 확인되었습니다' });
    } else {
        res.status(401).send({ message: '비밀번호가 틀렸습니다' });
    }
}));

export default router;