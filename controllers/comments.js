const db = require('../models/db');
const CryptoJs = require('crypto-js');
const { getTimeStamp } = require('../utils/timestamp');

exports.getComments = async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM comments");

        return res.status(200).send(result);
    } catch (error) {
        console.log(`Error trying to get comments: ${error}`);
        return res.status(400).send();
    }
}

exports.createComment = async (req, res) => {
    try {
        const username = req.params.user;
        const {content} = req.body;
        const timeStamp = getTimeStamp();

        const bytes = CryptoJs.AES.decrypt(username, 'secret-key');
        const decryptedUsername = bytes.toString(CryptoJs.enc.Utf8);

        const userId = await db.query("SELECT id FROM users WHERE username = ?", [decryptedUsername]);

        const result = await db.query("INSERT INTO `comments`(`userId`, `content`,`createdAt`, `username`) VALUES (?, ?, ?, ?)",
            [userId[0].id, content, timeStamp, decryptedUsername]);

        const id = result.insertId;

        if(result.affectedRows) {
            return res.status(201).json({
                id: id,
                content: content,
                createdAt: timeStamp,
                username: decryptedUsername,
                score: 0
            })
        }
    } catch (error) {
        console.log(`Error trying to create comment: ${error}`);
        return res.status(400).send();
    }
}

exports.editComment = async (req, res) => {
    try {
        const {content, modified} = req.body;
        const id = req.params.id;
        const timeStamp = getTimeStamp();
        const result = await db.query("UPDATE comments SET content = ?, createdAt = ?, modified= ? WHERE id = ?",
            [content, timeStamp, modified, id]);

        if(result.affectedRows) {
            return res.status(200).json({
                content: content,
                createdAt: timeStamp,
                modified: modified,
            })
        }
    } catch (error) {
        console.log(`Error changing comments: ${error}`);
        return res.status(400).send();
    }
}

exports.editScore = async (req, res) => {
    try {
        const {type} = req.body;
        const id = req.params.id;
        const username = req.params.username;

        const bytes = CryptoJs.AES.decrypt(username, 'secret-key');
        const decryptedUsername = bytes.toString(CryptoJs.enc.Utf8);

        const replyingTo = await db.query("SELECT username FROM comments WHERE id = ?", [id]);

        const userId = await db.query("SELECT id from users WHERE username = ?", [decryptedUsername]);
        const commentId = await db.query("SELECT id from comments WHERE id = ?", [id]);

        const existingVote = await db.query("SELECT * FROM `comments_votes` WHERE `userId` = ? AND `commentId` = ?", [userId[0].id, commentId[0].id]);
        if (existingVote.length > 0) {
            if (existingVote[0].type === type) {
                return res.status(400).send('User has already ' + type + 'voted');
            } else {
                const updateVote = await db.query("UPDATE comments_votes SET type = ? WHERE userId = ? AND commentId = ?", [type, userId[0].id, commentId[0].id]);
                await db.query("UPDATE comments SET score = score + ? WHERE id = ?", [type === 'upvote' ? 1 : -1, id]);

                const message = `@${decryptedUsername} ${type}d your comment.`;
                await db.query("INSERT INTO `notifications`(`userId`, `content`, `username`, `type`) VALUES (?, ?, ?, ?)",
                    [userId[0].id, message, replyingTo[0].username, type]);
            }
        } else {
            const setScore = await db.query("INSERT INTO `comments_votes`(`userId`, `commentId`, `type`) VALUES (?, ?, ?)", [userId[0].id, commentId[0].id, type]);
            await db.query("UPDATE comments SET score = score + ? WHERE id = ?", [type === 'upvote' ? 1 : -1, id]);
        }

        return res.status(200).send();

    } catch (error) {
        console.log(`Error changing score: ${error}`);
        return res.status(400).send();
    }
}

exports.deleteComment = async (req, res) => {
    try {
        const id = req.params.id;
        await db.query('DELETE FROM comments WHERE id = ?', [id]);

        return res.status(204).send();
    } catch (error) {
        console.log(`Error trying to delete comment: ${error}`);
        return res.status(400).send();
    }
}

