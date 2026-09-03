const interactionService = require('../services/interactionService');

// @desc    Pass candidate (Dating Core)
// @route   POST /v1/discovery/pass
// @access  Private
const passCandidate = async (req, res) => {
  try {
    const result = await interactionService.passCandidate(req.user._id, req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || (error.code === 'RECOMMENDATION_OWNERSHIP_INVALID' ? 403 : 400);
    return res.status(statusCode).json({ success: false, code: error.code || 'PASS_ERROR', message: error.message });
  }
};

// @desc    Remove candidate (Dating Core)
// @route   POST /v1/discovery/remove
// @access  Private
const removeCandidate = async (req, res) => {
  try {
    const result = await interactionService.removeCandidate(req.user._id, req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ success: false, code: error.code || 'REMOVE_ERROR', message: error.message });
  }
};

// @desc    Undo pass (Dating Core)
// @route   POST /v1/discovery/undo
// @access  Private
const undoPass = async (req, res) => {
  try {
    const result = await interactionService.undoLatestPass(req.user._id, req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || (error.code === 'RECOMMENDATION_OWNERSHIP_INVALID' ? 403 : 400);
    return res.status(statusCode).json({ success: false, code: error.code || 'UNDO_ERROR', message: error.message });
  }
};

// @desc    Like post
// @route   POST /v1/content/:contentId/like
// @access  Private
const likeContent = async (req, res) => {
  try {
    const result = await interactionService.likeContent(req.user._id, req.params.contentId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'LIKE_ERROR',
      message: error.message,
    });
  }
};

// @desc    Unlike post
// @route   DELETE /v1/content/:contentId/like
// @access  Private
const unlikeContent = async (req, res) => {
  try {
    const result = await interactionService.unlikeContent(req.user._id, req.params.contentId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'UNLIKE_ERROR',
      message: error.message,
    });
  }
};

// @desc    Create comment or reply
// @route   POST /v1/content/:contentId/comments
// @access  Private
const createComment = async (req, res) => {
  try {
    const result = await interactionService.createComment(req.user._id, req.params.contentId, req.body);
    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'COMMENT_CREATE_ERROR',
      message: error.message,
    });
  }
};

// @desc    Get comments for post
// @route   GET /v1/content/:contentId/comments
// @access  Private / Public-aware
const getComments = async (req, res) => {
  try {
    const viewerId = req.user ? req.user._id : null;
    const result = await interactionService.getComments(viewerId, req.params.contentId, req.query);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'GET_COMMENTS_ERROR',
      message: error.message,
    });
  }
};

// @desc    Get comment replies
// @route   GET /v1/comments/:commentId/replies
// @access  Private / Public-aware
const getCommentReplies = async (req, res) => {
  try {
    const viewerId = req.user ? req.user._id : null;
    const result = await interactionService.getCommentReplies(viewerId, req.params.commentId, req.query);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'GET_REPLIES_ERROR',
      message: error.message,
    });
  }
};

// @desc    Delete comment
// @route   DELETE /v1/comments/:commentId
// @access  Private
const deleteComment = async (req, res) => {
  try {
    const result = await interactionService.deleteComment(req.user._id, req.params.commentId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'DELETE_COMMENT_ERROR',
      message: error.message,
    });
  }
};

// @desc    Like comment
// @route   POST /v1/comments/:commentId/like
// @access  Private
const likeComment = async (req, res) => {
  try {
    const result = await interactionService.likeComment(req.user._id, req.params.commentId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'LIKE_COMMENT_ERROR',
      message: error.message,
    });
  }
};

// @desc    Unlike comment
// @route   DELETE /v1/comments/:commentId/like
// @access  Private
const unlikeComment = async (req, res) => {
  try {
    const result = await interactionService.unlikeComment(req.user._id, req.params.commentId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'UNLIKE_COMMENT_ERROR',
      message: error.message,
    });
  }
};

// @desc    Save content
// @route   POST /v1/content/:contentId/save
// @access  Private
const saveContent = async (req, res) => {
  try {
    const result = await interactionService.saveContent(req.user._id, req.params.contentId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'SAVE_ERROR',
      message: error.message,
    });
  }
};

// @desc    Unsave content
// @route   DELETE /v1/content/:contentId/save
// @access  Private
const unsaveContent = async (req, res) => {
  try {
    const result = await interactionService.unsaveContent(req.user._id, req.params.contentId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'UNSAVE_ERROR',
      message: error.message,
    });
  }
};

// @desc    Get user's private saved content list
// @route   GET /v1/users/me/saved-content
// @access  Private
const getSavedContent = async (req, res) => {
  try {
    const result = await interactionService.getSavedContent(req.user._id, req.query);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'GET_SAVED_ERROR',
      message: error.message,
    });
  }
};

// @desc    Record share event
// @route   POST /v1/content/:contentId/share
// @access  Private
const recordShare = async (req, res) => {
  try {
    const result = await interactionService.recordShare(req.user._id, req.params.contentId, req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'SHARE_ERROR',
      message: error.message,
    });
  }
};

// @desc    Mark content not interested
// @route   POST /v1/content/:contentId/not-interested
// @access  Private
const markNotInterested = async (req, res) => {
  try {
    const result = await interactionService.markNotInterested(req.user._id, req.params.contentId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'NOT_INTERESTED_ERROR',
      message: error.message,
    });
  }
};

// @desc    Unmark not interested
// @route   DELETE /v1/content/:contentId/not-interested
// @access  Private
const unmarkNotInterested = async (req, res) => {
  try {
    const result = await interactionService.unmarkNotInterested(req.user._id, req.params.contentId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'UNMARK_NOT_INTERESTED_ERROR',
      message: error.message,
    });
  }
};

// @desc    Resolve or create a Content document for a photo URL or ID
// @route   POST /v1/content/resolve-photo
// @access  Private
const resolvePhotoContent = async (req, res) => {
  try {
    const { photoUrl, authorId } = req.body;
    if (!photoUrl) {
      return res.status(400).json({ success: false, message: 'photoUrl is required' });
    }

    const mongoose = require('mongoose');
    const Content = require('../models/Content');
    const ContentLike = require('../models/ContentLike');

    const targetAuthorId = authorId && mongoose.Types.ObjectId.isValid(authorId)
      ? new mongoose.Types.ObjectId(authorId)
      : req.user._id;

    let contentDoc = null;

    const normalizedUrl = photoUrl.includes('/uploads/')
      ? ('/uploads/' + photoUrl.split('/uploads/')[1])
      : photoUrl;

    if (mongoose.Types.ObjectId.isValid(photoUrl)) {
      contentDoc = await Content.findById(photoUrl);
    }

    if (!contentDoc) {
      contentDoc = await Content.findOne({
        $or: [
          { 'mediaItems.originalUrl': photoUrl },
          { 'mediaItems.originalUrl': normalizedUrl },
          { 'mediaItems.thumbnail.url': photoUrl },
          { 'mediaItems.thumbnail.url': normalizedUrl },
          { 'mediaItems.variants.url': photoUrl },
          { 'mediaItems.variants.url': normalizedUrl },
        ],
        status: { $ne: 'DELETED' },
      });
    }

    if (!contentDoc) {
      contentDoc = await Content.create({
        authorId: targetAuthorId,
        contentType: 'POST',
        mediaItems: [{
          mediaType: 'IMAGE',
          originalUrl: normalizedUrl,
          thumbnail: { url: normalizedUrl },
          variants: [{
            name: 'original',
            objectKey: normalizedUrl,
            mimeType: 'image/jpeg',
            url: normalizedUrl,
          }],
        }],
        status: 'PUBLISHED',
        audience: 'PUBLIC',
      });
    }

    const isLiked = await ContentLike.exists({
      userId: req.user._id,
      contentId: contentDoc._id,
      reactionType: 'LIKE',
      status: 'ACTIVE',
    });

    return res.status(200).json({
      success: true,
      data: {
        contentId: contentDoc._id.toString(),
        likesCount: contentDoc.likesCount || 0,
        commentsCount: contentDoc.commentsCount || 0,
        isLiked: Boolean(isLiked),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  passCandidate,
  removeCandidate,
  undoPass,
  likeContent,
  unlikeContent,
  createComment,
  getComments,
  getCommentReplies,
  deleteComment,
  likeComment,
  unlikeComment,
  saveContent,
  unsaveContent,
  getSavedContent,
  recordShare,
  markNotInterested,
  unmarkNotInterested,
  resolvePhotoContent,
};
