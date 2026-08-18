let currentStoryUri = null;

export const setStoryUri = (uri) => {
  currentStoryUri = uri;
};

export const getStoryUri = () => {
  return currentStoryUri;
};
