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

function markItemSeen(itemId, atIso) {
  // atIso を渡すときはサーバー側の created_at 等、サーバー時刻を使うこと。
  // クライアント時計がサーバーより遅れていると、自分がいま投稿したコメントが
  // 直後に「未読」として表示されてしまうため（new Date() だけに頼らない）。
  const map = getSeenMap();
  map[itemId] = atIso || new Date().toISOString();
  localStorage.setItem(SEEN_KEY, JSON.stringify(map));
}

function isItemUnseen(itemId, lastCommentAt) {
  if (!lastCommentAt) return false;
  const seenAt = getSeenMap()[itemId];
  if (!seenAt) return true;
  return new Date(lastCommentAt) > new Date(seenAt);
}
