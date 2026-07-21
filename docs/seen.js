// 這台瀏覽器最後一次「打開過」某品項的時間，用來在列表頁標示「有新留言」，
// 不需要任何通知服務，純本機判斷。
const SEEN_KEY = "meikanSeenAt";

function getSeenMap() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY)) || {};
  } catch {
    return {};
  }
}

function markItemSeen(itemId) {
  const map = getSeenMap();
  map[itemId] = new Date().toISOString();
  localStorage.setItem(SEEN_KEY, JSON.stringify(map));
}

function isItemUnseen(itemId, lastCommentAt) {
  if (!lastCommentAt) return false;
  const seenAt = getSeenMap()[itemId];
  if (!seenAt) return true;
  return new Date(lastCommentAt) > new Date(seenAt);
}
