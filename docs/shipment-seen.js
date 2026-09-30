// 出船管理專用的「已讀」追蹤，跟品項的 seen.js 分開存放，避免命名空間混在一起。
const SHIPMENT_SEEN_KEY = "meikanShipmentSeenAt";

function getShipmentSeenMap() {
  try {
    return JSON.parse(localStorage.getItem(SHIPMENT_SEEN_KEY)) || {};
  } catch {
    return {};
  }
}

function markShipmentSeen(shipmentId, atIso) {
  // atIso を渡すときはサーバー側の created_at 等、サーバー時刻を使うこと。
  // クライアント時計がサーバーより遅れていると、自分がいま投稿したコメントが
  // 直後に「未読」として表示されてしまうため（new Date() だけに頼らない）。
  const map = getShipmentSeenMap();
  map[shipmentId] = atIso || new Date().toISOString();
  localStorage.setItem(SHIPMENT_SEEN_KEY, JSON.stringify(map));
}

function isShipmentUnseen(shipmentId, lastCommentAt) {
  if (!lastCommentAt) return false;
  const seenAt = getShipmentSeenMap()[shipmentId];
  if (!seenAt) return true;
  return new Date(lastCommentAt) > new Date(seenAt);
}
