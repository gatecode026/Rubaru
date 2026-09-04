const ImageKit = require('imagekit');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'public_CpBAKCTW3cCxoXfvAOOu0jAEUbk=',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'private_cTMR4l13s8ZwjOKZY8VDagZLYt8=',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/zjd5xircoy',
});

const FOLDERS = {
  AVATARS: '/rubaru/avatars',
  PHOTOS: '/rubaru/photos',
  POSTS: '/rubaru/posts',
  REELS: '/rubaru/reels',
  STORIES: '/rubaru/stories',
  CHAT: '/rubaru/chat',
  MEDIA: '/rubaru/media',
};

module.exports = {
  imagekit,
  FOLDERS,
};
